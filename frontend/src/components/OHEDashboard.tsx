"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Zap,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  RotateCcw,
  X,
  Layers,
  Activity,
  Radio,
  FileCheck,
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

interface JointOpportunity {
  section_id: number;
  section_name: string;
  total_demands_count: number;
  departments: string[];
  total_possession_saved_minutes: number;
  train_detention_avoided_minutes: number;
  recommended_start: string;
  recommended_end: string;
  synergy_score: number;
  demands: {
    request_number: string;
    department_name: string;
    work_type: string;
    priority: string;
  }[];
}

const API_BASE = "http://localhost:8000";

const OHE_WORK_TYPES = [
  { id: "CatenaryReplacement", label: "Contact & Catenary Wire Replacement" },
  { id: "AOHInspection", label: "Annual Overhaul (AOH) & Cantilever Adjustment" },
  { id: "InsulatorCleaning", label: "High-Pressure Insulator Washing (Pollution Clearance)" },
  { id: "NeutralSection", label: "PTFE Neutral Section & Phase Break Overhaul" },
  { id: "TreeClearance", label: "Trackside Tree Trimming & High-Voltage Tree Clearance" },
  { id: "BondingEarthing", label: "Structure Bonding & Earth Continuity Testing" },
];

export default function OHEDashboard() {
  const { user, authFetch } = useAuth();

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [jointOpps, setJointOpps] = useState<JointOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingJoint, setLoadingJoint] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Active progress update modal
  const [updatingReqId, setUpdatingReqId] = useState<number | null>(null);
  const [progressVal, setProgressVal] = useState<number>(50);
  const [progressNotes, setProgressNotes] = useState("");

  // Form State
  const [formSectionId, setFormSectionId] = useState(1);
  const [formWorkType, setFormWorkType] = useState(OHE_WORK_TYPES[0].id);
  const [formLine, setFormLine] = useState("UP Line 25kV Catenary");
  const [formMastFrom, setFormMastFrom] = useState("118/14");
  const [formMastTo, setFormMastTo] = useState("122/08");
  const [formTowerWagon, setFormTowerWagon] = useState("8-Wheeler Tower Wagon #TW-42 + 2 Ladder Gangs");
  const [formLinemenCount, setFormLinemenCount] = useState("18 Linemen");
  const [formPowerIsolation, setFormPowerIsolation] = useState("YES (25kV Power De-energization Required)");
  const [formPriority, setFormPriority] = useState("HIGH");
  const [formDuration, setFormDuration] = useState(150);
  const [formStartTime, setFormStartTime] = useState("02:00");
  const [formEndTime, setFormEndTime] = useState("04:30");
  const [formReason, setFormReason] = useState(
    "Contact wire diameter measured below 8.2mm (critical wear threshold) between Mast 119/02 and 120/14. High sparking risk."
  );

  // Fetch sections
  useEffect(() => {
    fetch(`${API_BASE}/api/network/sections`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSections(data);
        }
      })
      .catch((err) => console.error("Failed to load sections", err));
  }, []);

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

  // Fetch joint opportunities
  const fetchJointOpportunities = useCallback(async () => {
    setLoadingJoint(true);
    try {
      const res = await authFetch(`${API_BASE}/api/blocks/joint-opportunities`);
      if (res.ok) {
        const data = await res.json();
        setJointOpps(data);
      }
    } catch (err) {
      console.error("Failed to fetch joint opportunities", err);
    } finally {
      setLoadingJoint(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchRequests();
    fetchJointOpportunities();
  }, [fetchRequests, fetchJointOpportunities]);

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    const payload = {
      department_id: user?.department_id || 2, // OHE = 2
      section_id: Number(formSectionId),
      work_type: formWorkType,
      location_details: `${formLine} (Mast ${formMastFrom} to ${formMastTo}) · Power: ${formPowerIsolation}`,
      asset_id: `OHE-MAST-${formMastFrom.replace("/", "-")}`,
      priority: formPriority,
      duration_minutes: Number(formDuration),
      preferred_start: formStartTime,
      preferred_end: formEndTime,
      required_resources: `${formTowerWagon} | Linemen: ${formLinemenCount}`,
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
          `OHE Power Block demand created as ${created.request_number}! Dispatched to Central Controller review.`
        );
        setShowModal(false);
        fetchRequests();
        fetchJointOpportunities();
        setTimeout(() => setSuccessNotice(null), 8000);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorNotice(err.detail || "Failed to submit OHE request.");
      }
    } catch {
      setErrorNotice("Network error communicating with Railway Ops Server.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Progress Update
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

  const activeCount = requests.filter((r) => r.status === "ACTIVE").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const reviewCount = requests.filter((r) => r.status === "UNDER_CONTROLLER_REVIEW" || r.status === "RECOMMENDED").length;

  return (
    <div className="space-y-6">
      {/* OHE Department Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-950 text-white rounded-3xl p-7 shadow-xl border border-indigo-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1.5">
                <Zap size={13} className="text-yellow-400" />
                Traction Distribution (TRD / OHE)
              </span>
              <span className="text-xs text-indigo-200/70 font-mono">Dept ID: 2 · 25kV AC Traction</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">OHE Power & Traffic Block Console</h1>
            <p className="text-indigo-100/80 text-sm mt-1 max-w-2xl">
              25kV AC catenary isolation permits, tower wagon track occupations, insulator washing, and joint block synchronization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm shadow-lg shadow-indigo-950/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus size={18} />
              Requisition OHE Power Block
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-indigo-800/50">
          <div className="bg-slate-900/60 border border-indigo-700/40 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-indigo-200/70 font-medium">De-energized Possessions</div>
            <div className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
              {activeCount}
              {activeCount > 0 && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />}
            </div>
          </div>
          <div className="bg-slate-900/60 border border-indigo-700/40 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-indigo-200/70 font-medium">Approved Permits</div>
            <div className="text-2xl font-bold text-white mt-1">{approvedCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-indigo-700/40 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-indigo-200/70 font-medium">Under Review</div>
            <div className="text-2xl font-bold text-indigo-300 mt-1">{reviewCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-indigo-700/40 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-indigo-200/70 font-medium">Joint Opportunities</div>
            <div className="text-2xl font-bold text-yellow-300 mt-1">{jointOpps.length}</div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-5 py-4 rounded-2xl flex items-center gap-3 text-sm shadow-sm">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <span className="font-medium">{successNotice}</span>
        </div>
      )}
      {errorNotice && (
        <div className="bg-red-50 border border-red-200 text-red-900 px-5 py-4 rounded-2xl flex items-center gap-3 text-sm shadow-sm">
          <AlertTriangle size={20} className="text-red-600 shrink-0" />
          <span className="font-medium">{errorNotice}</span>
        </div>
      )}

      {/* Main Grid: OHE Demands & Joint Block Synergy Finder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Demands List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Traction Demand Register</h2>
                <p className="text-xs text-slate-500 mt-0.5">Power isolation permits and tower wagon requisitions</p>
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
              <div className="py-16 text-center text-slate-400 text-sm">Loading traction demands...</div>
            ) : requests.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
                No OHE demands currently filed. Click &ldquo;Requisition OHE Power Block&rdquo; to submit.
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all bg-white"
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
                          {req.preferred_start || "02:00"} - {req.preferred_end || "04:30"} ({req.duration_minutes}m)
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 mb-3 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/60">
                      <span className="font-semibold text-indigo-900">Location & Isolation:</span>{" "}
                      {req.location_details || req.section_name || `Section #${req.section_id}`} ·{" "}
                      <span className="font-semibold text-indigo-900">Resources:</span>{" "}
                      {req.required_resources || "Tower Wagon + Gang"}
                    </div>

                    <div className="text-xs text-slate-500 mb-3">
                      <span className="font-medium text-slate-700">Safety Justification:</span> {req.reason}
                    </div>

                    {/* Active Work Progress Bar */}
                    {req.status === "ACTIVE" && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="font-bold text-yellow-700 flex items-center gap-1.5">
                            <Zap size={14} className="text-yellow-600 animate-bounce" />
                            Active Power Block (25kV Isolated)
                          </span>
                          <span className="font-mono font-bold text-slate-800">{req.progress_pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-yellow-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${req.progress_pct}%` }}
                          />
                        </div>
                        <div className="mt-2.5 flex justify-end">
                          <button
                            onClick={() => {
                              setUpdatingReqId(req.id);
                              setProgressVal(req.progress_pct);
                            }}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
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

        {/* Right 1 Column: Joint Block Synergy Matcher & Substation Status */}
        <div className="space-y-6">
          {/* Joint Block Synergy Card */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-indigo-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-yellow-400/20 text-yellow-300">
                <Layers size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Joint Block Synergy Finder</h3>
                <p className="text-[11px] text-indigo-200">Zero-Detention Piggyback Opportunities</p>
              </div>
            </div>

            <p className="text-xs text-indigo-200/80 mb-4 leading-relaxed">
              When Civil Engineering or S&T blocks a track section, OHE can isolate traction on the same section with{" "}
              <span className="text-yellow-300 font-bold">zero additional train detention</span>.
            </p>

            {loadingJoint ? (
              <div className="py-6 text-center text-slate-400 text-xs">Scanning corridor synergy...</div>
            ) : jointOpps.length === 0 ? (
              <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-800 text-center text-xs text-indigo-300">
                No active multi-department synergy matches right now.
              </div>
            ) : (
              <div className="space-y-3">
                {jointOpps.map((opp) => (
                  <div
                    key={opp.section_id}
                    className="p-3.5 rounded-2xl bg-indigo-950/80 border border-yellow-500/40 text-xs"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-yellow-300">{opp.section_name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-400 text-slate-950">
                        Saves {opp.total_possession_saved_minutes}m
                      </span>
                    </div>

                    <div className="text-[11px] text-indigo-200 space-y-1 mb-2">
                      <div>
                        <span className="text-slate-400">Time Window:</span> {opp.recommended_start} - {opp.recommended_end}
                      </div>
                      <div>
                        <span className="text-slate-400">Detention Avoided:</span> {opp.train_detention_avoided_minutes} mins
                      </div>
                      <div>
                        <span className="text-slate-400">Departments:</span> {opp.departments.join(", ")}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setFormSectionId(opp.section_id);
                        setShowModal(true);
                      }}
                      className="w-full mt-2 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold text-[11px] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus size={13} />
                      Attach OHE Demand to Section
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Traction Substation (TSS) Feed Status */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Radio size={15} className="text-indigo-600" />
              TSS & Sectioning Post (SP) Grid
            </h3>
            <p className="text-xs text-slate-500 mb-4">Pune — Lonavala 25kV Traction Feeds</p>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <div className="font-semibold text-slate-800">Chinchwad TSS (25kV 30MVA)</div>
                  <div className="text-[10px] text-slate-400">Feeder 1 & 2: Normal (26.2 kV)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                  ENERGIZED
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <div className="font-semibold text-slate-800">Talegaon Sectioning Post (SP)</div>
                  <div className="text-[10px] text-slate-400">Bridging Interrupter: Open</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                  NORMAL
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <div className="font-semibold text-slate-800">Lonavala SSP (Sub-Sectioning)</div>
                  <div className="text-[10px] text-slate-400">Ghat Neutral Section In Service</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                  PTFE CLEAR
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OHE Block Requisition Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-800">
                  <Zap size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Requisition OHE Power Block</h3>
                  <p className="text-xs text-slate-500">25kV de-energization permit & tower wagon track occupation</p>
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
                <label className="block font-semibold text-slate-700 mb-1">Target Corridor Section</label>
                <select
                  value={formSectionId}
                  onChange={(e) => setFormSectionId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {OHE_WORK_TYPES.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catenary Line</label>
                  <select
                    value={formLine}
                    onChange={(e) => setFormLine(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="UP Line 25kV Catenary">UP Line 25kV Catenary</option>
                    <option value="DOWN Line 25kV Catenary">DOWN Line 25kV Catenary</option>
                    <option value="Both Main Lines (Cross-Feeder Isolation)">Both Main Lines (Cross-Feeder)</option>
                    <option value="Yard Shunting Line Catenary">Yard Shunting Line Catenary</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">From Mast Number</label>
                  <input
                    type="text"
                    value={formMastFrom}
                    onChange={(e) => setFormMastFrom(e.target.value)}
                    placeholder="e.g. 118/14"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">To Mast Number</label>
                  <input
                    type="text"
                    value={formMastTo}
                    onChange={(e) => setFormMastTo(e.target.value)}
                    placeholder="e.g. 122/08"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">25kV Power Isolation Permit</label>
                  <select
                    value={formPowerIsolation}
                    onChange={(e) => setFormPowerIsolation(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="YES (25kV Power De-energization Required)">YES (25kV Power De-energization)</option>
                    <option value="NO (Cold Tower Wagon Inspection Only)">NO (Cold Inspection Only)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="LOW">LOW (Periodic AOH)</option>
                    <option value="MEDIUM">MEDIUM (Scheduled Cantilever Adjust)</option>
                    <option value="HIGH">HIGH (Severe Wire Wear / Sparking)</option>
                    <option value="URGENT">URGENT (Imminent Catenary Snap Risk)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="30"
                    max="480"
                    step="15"
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preferred Time Window</label>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-1/2 p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
                    />
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-1/2 p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tower Wagon & Linemen Fleet</label>
                <input
                  type="text"
                  value={formTowerWagon}
                  onChange={(e) => setFormTowerWagon(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Safety & Technical Justification</label>
                <textarea
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md transition-colors"
                >
                  {submitting ? "Submitting Permit..." : "Transmit to Central Controller"}
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
            <h3 className="text-base font-bold text-slate-900 mb-1">Update OHE Work Progress</h3>
            <p className="text-xs text-slate-500 mb-4">Report live field progress on isolated catenary</p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span>Physical Completion</span>
                  <span className="font-mono text-indigo-700">{progressVal}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progressVal}
                  onChange={(e) => setProgressVal(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Linemen Supervisor Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Contact wire splice completed at Mast 120/04. Ground earthing discharge rods removed."
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
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500"
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
