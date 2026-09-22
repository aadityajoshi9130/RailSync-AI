"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Radio,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  RotateCcw,
  X,
  Cpu,
  Sliders,
  CheckSquare,
  FileCheck2,
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

const API_BASE = "http://localhost:8000";

const ST_WORK_TYPES = [
  { id: "PointMachine", label: "Point Machine Overhaul & 3.25mm Obstruction Test" },
  { id: "AxleCounter", label: "Digital Axle Counter (DAC) Alignment & Channel Reset" },
  { id: "ElectronicInterlocking", label: "Electronic Interlocking (EI) Route Logic Verification" },
  { id: "SignalAspect", label: "Color Light Signal LED Replacement & Aspect Tuning" },
  { id: "TrackCircuitIRJ", label: "Track Circuit Glued Insulated Rail Joint (IRJ) Replacement" },
  { id: "BlockInstrument", label: "Block Instrument Tokenless Overhaul & Bell Code Audit" },
];

export default function STDashboard() {
  const { user, authFetch } = useAuth();

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [formWorkType, setFormWorkType] = useState(ST_WORK_TYPES[0].id);
  const [formCabin, setFormCabin] = useState("Lonavala Station Central Interlocking Cabin");
  const [formGearId, setFormGearId] = useState("Point #104 A/B (Down Crossover)");
  const [formDisconnectionNotice, setFormDisconnectionNotice] = useState("FORM S&T-T/351 Issued to Station Master");
  const [formEngineers, setFormEngineers] = useState("1 Section Engineer (Sig) + 2 ESMs + 4 Helpers");
  const [formPriority, setFormPriority] = useState("HIGH");
  const [formDuration, setFormDuration] = useState(120);
  const [formStartTime, setFormStartTime] = useState("02:30");
  const [formEndTime, setFormEndTime] = useState("04:30");
  const [formReason, setFormReason] = useState(
    "Motor throwing time on Point 104A exceeded 5.8 seconds (threshold 4.5s). Detection contact carbonization observed."
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

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    const payload = {
      department_id: user?.department_id || 3, // S&T = 3
      section_id: Number(formSectionId),
      work_type: formWorkType,
      location_details: `${formCabin} · Asset: ${formGearId} · Notice: ${formDisconnectionNotice}`,
      asset_id: `SIG-${formGearId.replace(/\s+/g, "-")}`,
      priority: formPriority,
      duration_minutes: Number(formDuration),
      preferred_start: formStartTime,
      preferred_end: formEndTime,
      required_resources: `Engineers: ${formEngineers} | Calibration Kit`,
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
          `S&T Disconnection requisition logged as ${created.request_number}! Sent for Central Controller clearance.`
        );
        setShowModal(false);
        fetchRequests();
        setTimeout(() => setSuccessNotice(null), 8000);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorNotice(err.detail || "Failed to submit S&T request.");
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
      {/* S&T Header Banner */}
      <div className="bg-gradient-to-r from-teal-950 via-emerald-950 to-slate-950 text-white rounded-3xl p-7 shadow-xl border border-teal-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center gap-1.5">
                <Radio size={13} className="text-teal-300" />
                Signaling & Telecom (S&T)
              </span>
              <span className="text-xs text-teal-200/70 font-mono">Dept ID: 3 · Electronic Interlocking</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Interlocking & Disconnection Notice Console</h1>
            <p className="text-teal-100/80 text-sm mt-1 max-w-2xl">
              Electronic interlocking verification, point machine maintenance, axle counter reset, and statutory S&T Form T/351 disconnections.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-teal-400 hover:bg-teal-300 text-teal-950 font-bold text-sm shadow-lg shadow-teal-950/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus size={18} />
              Requisition S&T Disconnection
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-teal-800/50">
          <div className="bg-slate-900/60 border border-teal-700/40 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-teal-200/70 font-medium">Active Disconnections</div>
            <div className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
              {activeCount}
              {activeCount > 0 && <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />}
            </div>
          </div>
          <div className="bg-slate-900/60 border border-teal-700/40 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-teal-200/70 font-medium">Authorized Blocks</div>
            <div className="text-2xl font-bold text-white mt-1">{approvedCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-teal-700/40 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-teal-200/70 font-medium">Awaiting Clearance</div>
            <div className="text-2xl font-bold text-teal-300 mt-1">{reviewCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-teal-700/40 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-xs text-teal-200/70 font-medium">Total Requisitions</div>
            <div className="text-2xl font-bold text-white mt-1">{requests.length}</div>
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

      {/* Main Grid: Demands List + S&T Gear Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Demands List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">S&T Requisitions & Disconnection Log</h2>
                <p className="text-xs text-slate-500 mt-0.5">Formal interlocking de-linking records and gear maintenance permits</p>
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
              <div className="py-16 text-center text-slate-400 text-sm">Loading S&T requisitions...</div>
            ) : requests.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
                No S&T disconnections filed. Click &ldquo;Requisition S&T Disconnection&rdquo; to submit.
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="border border-slate-200 rounded-2xl p-5 hover:border-teal-300 hover:shadow-md transition-all bg-white"
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
                        <div className="text-xs text-slate-500 font-medium">Disconnection Slot</div>
                        <div className="text-xs font-mono font-semibold text-slate-800 mt-0.5">
                          {req.preferred_start || "02:30"} - {req.preferred_end || "04:30"} ({req.duration_minutes}m)
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 mb-3 bg-teal-50/50 p-2.5 rounded-xl border border-teal-100/60">
                      <span className="font-semibold text-teal-900">Location & Gear:</span>{" "}
                      {req.location_details || req.section_name || `Section #${req.section_id}`} ·{" "}
                      <span className="font-semibold text-teal-900">Personnel:</span>{" "}
                      {req.required_resources || "Signal Engineer + ESMs"}
                    </div>

                    <div className="text-xs text-slate-500 mb-3">
                      <span className="font-medium text-slate-700">Safety & Fail-Safe Plan:</span> {req.reason}
                    </div>

                    {/* Active Work Progress Bar */}
                    {req.status === "ACTIVE" && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="font-bold text-teal-700 flex items-center gap-1.5">
                            <Radio size={14} className="text-teal-600 animate-spin" />
                            Disconnection Active (Points Hand-Cranked / Clamped)
                          </span>
                          <span className="font-mono font-bold text-slate-800">{req.progress_pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-teal-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${req.progress_pct}%` }}
                          />
                        </div>
                        <div className="mt-2.5 flex justify-end">
                          <button
                            onClick={() => {
                              setUpdatingReqId(req.id);
                              setProgressVal(req.progress_pct);
                            }}
                            className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
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

        {/* Right 1 Column: Interlocking Relays & S&T Gear Status */}
        <div className="space-y-6">
          {/* Signal Assets Health Card */}
          <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-md border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Cpu size={15} className="text-teal-400" />
              Signaling Asset Telemetry
            </h3>
            <p className="text-xs text-slate-400 mb-4">Pune — Lonavala Interlocking Systems</p>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
                <div>
                  <div className="font-semibold text-white">Lonavala Electronic Interlocking</div>
                  <div className="text-[10px] text-slate-400">Kyosan EI · Dual Hot Standby</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  HEALTHY
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
                <div>
                  <div className="font-semibold text-white">Talegaon Digital Axle Counters</div>
                  <div className="text-[10px] text-slate-400">Frauscher HASP · Channel A/B OK</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  HEALTHY
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
                <div>
                  <div className="font-semibold text-white">Point 104 A/B (Motor Drive)</div>
                  <div className="text-[10px] text-amber-400">Throwing time 5.8s (Elevated)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  MAINT REQUIRED
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
                <div>
                  <div className="font-semibold text-white">ABS Auto Signal S-12</div>
                  <div className="text-[10px] text-slate-400">LED Current 128mA (Within limit)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  NORMAL
                </span>
              </div>
            </div>
          </div>

          {/* Statutory Disconnection Checklist */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <FileCheck2 size={16} className="text-teal-600" />
              Statutory Disconnection Rules (IR)
            </h3>
            <p className="text-xs text-slate-500 mb-3">General Rules (GR 3.51 & SR 3.51.01)</p>

            <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                <span>Station Master must sign and return counterfoil of Form T/351 before any gear is opened.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                <span>Points must be clamped and padlocked in normal position for non-interlocked train movements.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                <span>Reconnection Memo (Form T/352) issued only after joint test with Operating department.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* S&T Requisition Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-100 text-teal-800">
                  <Radio size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Requisition S&T Disconnection & Block</h3>
                  <p className="text-xs text-slate-500">Statutory Form S&T-T/351 disconnection for signal & interlocking assets</p>
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
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {ST_WORK_TYPES.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Interlocking Cabin / RRI</label>
                  <input
                    type="text"
                    value={formCabin}
                    onChange={(e) => setFormCabin(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gear / Asset Tag</label>
                  <input
                    type="text"
                    value={formGearId}
                    onChange={(e) => setFormGearId(e.target.value)}
                    placeholder="e.g. Point #104 A/B"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Disconnection Memo Notice</label>
                  <input
                    type="text"
                    value={formDisconnectionNotice}
                    onChange={(e) => setFormDisconnectionNotice(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="15"
                    max="360"
                    step="15"
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="LOW">LOW (Periodic Calibration)</option>
                    <option value="MEDIUM">MEDIUM (Standard Scheduled Overhaul)</option>
                    <option value="HIGH">HIGH (Elevated Motor Current / Sluggish Point)</option>
                    <option value="URGENT">URGENT (Interlocking Fail-Safe Blown / Red Aspect)</option>
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
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preferred End Time</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Signal Personnel & Test Gear</label>
                <input
                  type="text"
                  value={formEngineers}
                  onChange={(e) => setFormEngineers(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Technical Failure Diagnosis & Clamping Plan</label>
                <textarea
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-md transition-colors"
                >
                  {submitting ? "Transmitting Requisition..." : "Transmit Disconnection Demand"}
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
            <h3 className="text-base font-bold text-slate-900 mb-1">Update S&T Field Progress</h3>
            <p className="text-xs text-slate-500 mb-4">Report real-time interlocking reconnection progress</p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span>Progress to Reconnection (T/352)</span>
                  <span className="font-mono text-teal-700">{progressVal}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progressVal}
                  onChange={(e) => setProgressVal(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Section Engineer Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Point 104A contacts cleaned and readjusted. Throwing time verified at 3.9s. Preparing T/352 memo."
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
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-500"
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
