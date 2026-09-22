"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Hammer,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Filter,
  Train,
  Sliders,
  ShieldAlert,
  ChevronRight,
  Info,
  Calendar,
  X,
  RotateCcw,
} from "lucide-react";

interface Section {
  id: number;
  name: string;
  source_station_id: number;
  target_station_id: number;
  length_km: number;
  max_speed: number;
}

interface MaintenanceRequest {
  id: number;
  request_number: string;
  department_id: number;
  department_name?: string;
  section_id: number;
  section_name?: string;
  work_type: string;
  location_details?: string;
  asset_id?: string;
  priority: string;
  duration_minutes: number;
  preferred_date?: string;
  preferred_start?: string;
  preferred_end?: string;
  required_resources?: string;
  reason: string;
  status: string;
  progress_pct: number;
  progress_notes?: string;
  block_plan_id?: number;
  created_at: string;
}

interface CandidateSlot {
  candidate_id: string | number;
  name?: string;
  window_name?: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  score: number;
  train_impact_minutes: number;
  conflicting_trains?: number;
  conflicts_count?: number;
  passenger_headway_min?: number;
  safety_status: string;
  rationale: string;
  risk_level?: string;
}

const API_BASE = "http://localhost:8000";

const WORK_TYPES = [
  { id: "Tamping", label: "Track Tamping (CSM / Duomatic)" },
  { id: "BallastCleaning", label: "Deep Ballast Cleaning (BCM)" },
  { id: "TrackRenewal", label: "Complete Track Renewal (CTR / TRT)" },
  { id: "USFDScreening", label: "Ultrasonic Flaw Detection (USFD Testing)" },
  { id: "TurnoutOverhaul", label: "Turnout & Diamond Crossover Replacement" },
  { id: "DeStressing", label: "Continuous Welded Rail (CWR) De-Stressing" },
];

export default function EngineeringDashboard() {
  const { user, authFetch } = useAuth();

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Selected candidate slot preview
  const [selectedSectionForSlots, setSelectedSectionForSlots] = useState<number | null>(1);
  const [candidateSlots, setCandidateSlots] = useState<CandidateSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Active progress update modal
  const [updatingReqId, setUpdatingReqId] = useState<number | null>(null);
  const [progressVal, setProgressVal] = useState<number>(50);
  const [progressNotes, setProgressNotes] = useState("");

  // Form State
  const [formSectionId, setFormSectionId] = useState(1);
  const [formWorkType, setFormWorkType] = useState(WORK_TYPES[0].id);
  const [formLine, setFormLine] = useState("UP Main Line");
  const [formKmFrom, setFormKmFrom] = useState("124/2");
  const [formKmTo, setFormKmTo] = useState("127/8");
  const [formMachine, setFormMachine] = useState("CSM 08-32 Tamper + Ballast Regulator");
  const [formGangSize, setFormGangSize] = useState("40 Trackmen");
  const [formPriority, setFormPriority] = useState("HIGH");
  const [formDuration, setFormDuration] = useState(180);
  const [formStartTime, setFormStartTime] = useState("01:30");
  const [formEndTime, setFormEndTime] = useState("04:30");
  const [formReason, setFormReason] = useState(
    "OMS-2000 recorded high vertical acceleration (0.28g) over joints. Urgent tamping and ballast packing required."
  );

  // Fetch sections
  useEffect(() => {
    fetch(`${API_BASE}/api/network/sections`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSections(data);
          if (data.length > 0 && !selectedSectionForSlots) {
            setSelectedSectionForSlots(data[0].id);
          }
        }
      })
      .catch((err) => console.error("Failed to load sections", err));
  }, [selectedSectionForSlots]);

  // Fetch departmental requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/maintenance/requests`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Fetch candidate slots for a section
  const fetchCandidates = useCallback(
    async (secId: number) => {
      setLoadingSlots(true);
      try {
        const res = await authFetch(`${API_BASE}/api/blocks/candidates?section_id=${secId}`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.candidates || []);
          setCandidateSlots(list);
        }
      } catch (err) {
        console.error("Failed to fetch candidate slots", err);
      } finally {
        setLoadingSlots(false);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    if (selectedSectionForSlots) {
      fetchCandidates(selectedSectionForSlots);
    }
  }, [selectedSectionForSlots, fetchCandidates]);

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    const payload = {
      department_id: user?.department_id || 1, // Engineering = 1
      section_id: Number(formSectionId),
      work_type: formWorkType,
      location_details: `${formLine} (KM ${formKmFrom} to ${formKmTo})`,
      asset_id: `TRACK-SEC-${formSectionId}`,
      priority: formPriority,
      duration_minutes: Number(formDuration),
      preferred_start: formStartTime,
      preferred_end: formEndTime,
      required_resources: `${formMachine} | Gang: ${formGangSize}`,
      reason: formReason,
    };

    try {
      const res = await authFetch(`${API_BASE}/api/maintenance/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = await res.json();
        setSuccessNotice(
          `Demand registered as ${created.request_number}! Automatically dispatched to Optimization Engine & Central Controller queue.`
        );
        setShowModal(false);
        fetchRequests();
        setTimeout(() => setSuccessNotice(null), 8000);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorNotice(err.detail || "Failed to submit request.");
      }
    } catch {
      setErrorNotice("Network error communicating with Railway Ops Server.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Progress Update for Active Block
  const handleUpdateProgress = async () => {
    if (!updatingReqId) return;
    try {
      const res = await authFetch(`${API_BASE}/api/maintenance/requests/${updatingReqId}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progress_pct: progressVal,
          progress_notes: progressNotes,
        }),
      });
      if (res.ok) {
        setUpdatingReqId(null);
        setProgressNotes("");
        fetchRequests();
      }
    } catch (err) {
      console.error("Failed to update progress", err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold animate-pulse";
      case "APPROVED":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20 font-bold";
      case "UNDER_CONTROLLER_REVIEW":
        return "bg-amber-500/10 text-amber-700 border-amber-500/20 font-medium";
      case "RECOMMENDED":
        return "bg-indigo-500/10 text-indigo-700 border-indigo-500/20 font-medium";
      case "COMPLETED":
        return "bg-slate-100 text-slate-700 border-slate-200 font-medium";
      case "REJECTED":
        return "bg-red-500/10 text-red-600 border-red-500/20 font-medium";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  // Summary Metrics
  const activeCount = requests.filter((r) => r.status === "ACTIVE").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const reviewCount = requests.filter((r) => r.status === "UNDER_CONTROLLER_REVIEW" || r.status === "RECOMMENDED").length;
  const totalCount = requests.length;

  return (
    <div className="space-y-6">
      {/* Department Header Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white rounded-3xl p-7 shadow-xl border border-amber-700/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1.5">
                <Hammer size={13} />
                Civil Engineering (P-Way)
              </span>
              <span className="text-xs text-amber-200/70 font-mono">Dept ID: 1 · Central Railway</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Permanent Way Track Possession Console</h1>
            <p className="text-amber-100/80 text-sm mt-1 max-w-2xl">
              Track geometry maintenance, ballast cleaning machine (BCM) scheduling, rail flaw testing, and safe possession handovers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-sm shadow-lg shadow-amber-950/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus size={18} />
              Requisition Track Block
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-amber-700/50">
          <div className="bg-amber-950/50 border border-amber-700/40 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-amber-200/70 font-medium">Active Possessions</div>
            <div className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
              {activeCount}
              {activeCount > 0 && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            </div>
          </div>
          <div className="bg-amber-950/50 border border-amber-700/40 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-amber-200/70 font-medium">Approved / Queued</div>
            <div className="text-2xl font-bold text-white mt-1">{approvedCount}</div>
          </div>
          <div className="bg-amber-950/50 border border-amber-700/40 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-amber-200/70 font-medium">Under Review</div>
            <div className="text-2xl font-bold text-amber-300 mt-1">{reviewCount}</div>
          </div>
          <div className="bg-amber-950/50 border border-amber-700/40 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-amber-200/70 font-medium">Total Registered</div>
            <div className="text-2xl font-bold text-white mt-1">{totalCount}</div>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-5 py-4 rounded-2xl flex items-center gap-3 text-sm shadow-sm animate-in fade-in">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <span className="font-medium">{successNotice}</span>
        </div>
      )}
      {errorNotice && (
        <div className="bg-red-50 border border-red-200 text-red-900 px-5 py-4 rounded-2xl flex items-center gap-3 text-sm shadow-sm animate-in fade-in">
          <AlertTriangle size={20} className="text-red-600 shrink-0" />
          <span className="font-medium">{errorNotice}</span>
        </div>
      )}

      {/* Main Grid: Demands List + Candidate Slot Finder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Requests Table & Lifecycle */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Engineering Demands Lifecycle</h2>
                <p className="text-xs text-slate-500 mt-0.5">Track possession requisitions from intake to track clear handover</p>
              </div>
              <button
                onClick={fetchRequests}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Refresh Demands"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">Loading engineering demands...</div>
            ) : requests.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
                No maintenance requests registered. Click &ldquo;Requisition Track Block&rdquo; to submit a new demand.
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="border border-slate-200 rounded-2xl p-5 hover:border-amber-300 hover:shadow-md transition-all bg-white"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold font-mono text-slate-900">{req.request_number}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] border ${getStatusBadge(req.status)}`}>
                            {req.status.replace(/_/g, " ")}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.priority === "URGENT"
                                ? "bg-red-100 text-red-700"
                                : req.priority === "HIGH"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {req.priority}
                          </span>
                        </div>
                        <h4 className="text-base font-semibold text-slate-800 mt-1">{req.work_type}</h4>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-slate-500 font-medium">Requested Window</div>
                        <div className="text-xs font-mono font-semibold text-slate-800 mt-0.5">
                          {req.preferred_start || "01:30"} - {req.preferred_end || "04:30"} ({req.duration_minutes}m)
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="font-semibold text-slate-700">Location:</span> {req.location_details || req.section_name || `Section #${req.section_id}`} ·{" "}
                      <span className="font-semibold text-slate-700">Resources:</span> {req.required_resources || "Standard Gang"}
                    </p>

                    <div className="text-xs text-slate-500 mb-3">
                      <span className="font-medium text-slate-700">Justification:</span> {req.reason}
                    </div>

                    {/* Active Work Progress Bar */}
                    {req.status === "ACTIVE" && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Work In Progress on Track
                          </span>
                          <span className="font-mono font-bold text-slate-800">{req.progress_pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${req.progress_pct}%` }}
                          />
                        </div>
                        <div className="mt-2.5 flex justify-end">
                          <button
                            onClick={() => {
                              setUpdatingReqId(req.id);
                              setProgressVal(req.progress_pct);
                            }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            Update Field Progress %
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Window Slots & Engineering Tools */}
        <div className="space-y-6">
          {/* Recommended Time Window Slots */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Optimized Scheduling Slots</h3>
                  <p className="text-[11px] text-slate-500">Predicted low-detention windows</p>
                </div>
              </div>
            </div>

            {/* Section selector for candidate evaluation */}
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Target Section
              </label>
              <select
                value={selectedSectionForSlots ?? ""}
                onChange={(e) => setSelectedSectionForSlots(Number(e.target.value))}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.length_km} km)
                  </option>
                ))}
              </select>
            </div>

            {loadingSlots ? (
              <div className="py-8 text-center text-slate-400 text-xs">Evaluating traffic patterns...</div>
            ) : candidateSlots.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No candidate windows found for this section.</div>
            ) : (
              <div className="space-y-3">
                {candidateSlots.map((c, i) => (
                  <div
                    key={c.candidate_id}
                    className={`p-3.5 rounded-2xl border text-xs ${
                      i === 0
                        ? "bg-emerald-50/70 border-emerald-300 text-slate-900 shadow-sm"
                        : i === 1
                        ? "bg-blue-50/70 border-blue-200 text-slate-900"
                        : "bg-amber-50/70 border-amber-200 text-slate-900"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <div>
                        <span className="font-bold text-slate-900">{c.window_name || c.name}</span>
                        <div className="font-mono text-[11px] text-slate-600 mt-0.5">
                          {c.start_time} - {c.end_time} ({c.duration_minutes}m)
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.score >= 90
                            ? "bg-emerald-600 text-white"
                            : c.score >= 70
                            ? "bg-blue-600 text-white"
                            : "bg-amber-600 text-white"
                        }`}
                      >
                        Score: {c.score}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200/60 text-[11px]">
                      <div>
                        <span className="text-slate-500">Train Impact:</span>{" "}
                        <span className="font-semibold">{c.train_impact_minutes} min</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Conflict Trains:</span>{" "}
                        <span className="font-semibold">{c.conflicts_count ?? c.conflicting_trains ?? 0}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 mt-2 leading-relaxed italic">&ldquo;{c.rationale}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Heavy Machine & Gang Status Card */}
          <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-md border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Train size={15} className="text-amber-400" />
              Depot P-Way Machine Fleet
            </h3>
            <p className="text-xs text-slate-400 mb-4">Pune Division On-Track Machinery</p>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
                <div>
                  <div className="font-semibold text-white">CSM 08-32 (Continuous Tamper)</div>
                  <div className="text-[10px] text-slate-400">Stationed at: Lonavala Yard</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  AVAILABLE
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
                <div>
                  <div className="font-semibold text-white">Plasser BCM (Deep Cleaner)</div>
                  <div className="text-[10px] text-slate-400">Stationed at: Chinchwad Siding</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  STANDBY
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
                <div>
                  <div className="font-semibold text-white">USFD Rail Flaw Trolley #3</div>
                  <div className="text-[10px] text-slate-400">Stationed at: Shivajinagar P-Way Depot</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ACTIVE GANG
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Requisition Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <Hammer size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Requisition P-Way Track Block</h3>
                  <p className="text-xs text-slate-500">Submits formal engineering possession demand to IR Central Controller</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Section</label>
                <select
                  value={formSectionId}
                  onChange={(e) => setFormSectionId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.length_km} km)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Type</label>
                  <select
                    value={formWorkType}
                    onChange={(e) => setFormWorkType(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {WORK_TYPES.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Track Line</label>
                  <select
                    value={formLine}
                    onChange={(e) => setFormLine(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="UP Main Line">UP Main Line</option>
                    <option value="DOWN Main Line">DOWN Main Line</option>
                    <option value="Both Main Lines (Total Block)">Both Main Lines (Total Block)</option>
                    <option value="Loop Line">Loop Line</option>
                    <option value="Yard Crossover">Yard Crossover</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">From KM Post</label>
                  <input
                    type="text"
                    value={formKmFrom}
                    onChange={(e) => setFormKmFrom(e.target.value)}
                    placeholder="e.g. 124/2"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">To KM Post</label>
                  <input
                    type="text"
                    value={formKmTo}
                    onChange={(e) => setFormKmTo(e.target.value)}
                    placeholder="e.g. 127/8"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="30"
                    max="600"
                    step="15"
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="LOW">LOW (Planned Periodic)</option>
                    <option value="MEDIUM">MEDIUM (Standard Routine)</option>
                    <option value="HIGH">HIGH (Urgent Track Geometry)</option>
                    <option value="URGENT">URGENT (Safety Restriction / OMS Defect)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preferred Start Time</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preferred End Time</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Machine & Resource Details</label>
                <input
                  type="text"
                  value={formMachine}
                  onChange={(e) => setFormMachine(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Safety & Operational Justification</label>
                <textarea
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold shadow-md transition-colors"
                >
                  {submitting ? "Transmitting Requisition..." : "Submit to Central Controller"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Progress Update Modal */}
      {updatingReqId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Update P-Way Work Progress</h3>
            <p className="text-xs text-slate-500 mb-4">Report real-time track gang progress to Central Controller</p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span>Physical Completion</span>
                  <span className="font-mono text-amber-700">{progressVal}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progressVal}
                  onChange={(e) => setProgressVal(Number(e.target.value))}
                  className="w-full accent-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supervisor Site Notes</label>
                <input
                  type="text"
                  placeholder="e.g. 1.2km tamping completed, ballast dressing underway."
                  value={progressNotes}
                  onChange={(e) => setProgressNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setUpdatingReqId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProgress}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-amber-950 hover:bg-amber-400"
                >
                  Confirm Progress
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
