"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Inbox,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Layers,
  ChevronRight,
  Info,
  X,
  FileCheck,
  Hammer,
  Zap,
  Radio,
  RotateCcw,
} from "lucide-react";

interface MaintenanceRequest {
  id: number;
  request_number: string;
  department_id: number;
  department_name?: string;
  created_by_name?: string;
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

interface PendingRequestsQueueProps {
  onWorkflowActionComplete?: () => void;
}

export default function PendingRequestsQueue({ onWorkflowActionComplete }: PendingRequestsQueueProps) {
  const { user, authFetch } = useAuth();

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<MaintenanceRequest | null>(null);
  const [candidates, setCandidates] = useState<CandidateSlot[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("candidate-1");

  const [controllerRemarks, setControllerRemarks] = useState("Approved in accordance with Western Ghats working timetable.");
  const [emergencyOverride, setEmergencyOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Fetch pending requests
  const fetchPendingRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/maintenance/requests`);
      if (res.ok) {
        const data: MaintenanceRequest[] = await res.json();
        // Filter for requests needing controller attention
        const pending = data.filter(
          (r) =>
            r.status === "UNDER_CONTROLLER_REVIEW" ||
            r.status === "RECOMMENDED" ||
            r.status === "SUBMITTED" ||
            r.status === "AI_ANALYZING"
        );
        setRequests(pending);
      }
    } catch (err) {
      console.error("Failed to fetch pending requests", err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  // When a request is selected, load its candidate slots
  useEffect(() => {
    if (!selectedReq) return;
    setLoadingCandidates(true);
    authFetch(`${API_BASE}/api/blocks/candidates?section_id=${selectedReq.section_id}`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.candidates || []);
        setCandidates(list);
        if (list.length > 0) {
          setSelectedCandidateId(String(list[0].candidate_id));
        }
      })
      .catch((err) => console.error("Failed to load candidates", err))
      .finally(() => setLoadingCandidates(false));
  }, [selectedReq, authFetch]);

  // Handle Approve
  const handleApprove = async () => {
    if (!selectedReq) return;
    setSubmitting(true);
    try {
      // Find selected candidate slot
      const cand = candidates.find((c) => c.candidate_id === selectedCandidateId) || candidates[0];

      const res = await authFetch(`${API_BASE}/api/blocks/approve-workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_code: selectedReq.request_number,
          section_id: selectedReq.section_id,
          action: "APPROVED",
          performed_by: user?.name || "Central Controller",
          user_role: user?.role || "CENTRAL_CONTROLLER",
          remarks: `${controllerRemarks} | Assigned Slot: ${cand?.name || "Optimal Window"} (${cand?.start_time || "02:00"} - ${cand?.end_time || "05:00"})`,
          emergency_override: emergencyOverride,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActionNotice(
          `✓ Block approved! Request ${selectedReq.request_number} scheduled. Digital Sig: ${data.digital_signature?.slice(0, 16)}...`
        );
        setSelectedReq(null);
        fetchPendingRequests();
        if (onWorkflowActionComplete) onWorkflowActionComplete();
        setTimeout(() => setActionNotice(null), 7000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Approval failed. Central Controller authorization required.");
      }
    } catch {
      alert("Network error communicating with Railway Ops Server.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!selectedReq) return;
    const reason = prompt("Enter rejection reason for the requesting department:", "Corridor congestion / High-density passenger rake conflict");
    if (!reason) return;

    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE}/api/blocks/reject-workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_code: selectedReq.request_number,
          section_id: selectedReq.section_id,
          action: "REJECTED",
          performed_by: user?.name || "Central Controller",
          user_role: user?.role || "CENTRAL_CONTROLLER",
          remarks: reason,
          emergency_override: false,
        }),
      });

      if (res.ok) {
        setActionNotice(`✕ Request ${selectedReq.request_number} rejected. Notification dispatched to department.`);
        setSelectedReq(null);
        fetchPendingRequests();
        if (onWorkflowActionComplete) onWorkflowActionComplete();
        setTimeout(() => setActionNotice(null), 7000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Rejection failed.");
      }
    } catch {
      alert("Network error communicating with Railway Ops Server.");
    } finally {
      setSubmitting(false);
    }
  };

  const getDeptBadge = (deptId: number) => {
    switch (deptId) {
      case 1:
        return {
          icon: <Hammer size={12} />,
          label: "Engineering (P-Way)",
          className: "bg-amber-100 text-amber-800 border-amber-300",
        };
      case 2:
        return {
          icon: <Zap size={12} />,
          label: "OHE Traction",
          className: "bg-indigo-100 text-indigo-800 border-indigo-300",
        };
      case 3:
        return {
          icon: <Radio size={12} />,
          label: "Signaling & Telecom",
          className: "bg-teal-100 text-teal-800 border-teal-300",
        };
      default:
        return {
          icon: <Info size={12} />,
          label: "Department",
          className: "bg-slate-100 text-slate-800 border-slate-300",
        };
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100">
            <Inbox size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">Pending Department Requests Queue</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500 text-white shadow-sm">
                {requests.length} Pending
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-department possession demands awaiting Central Controller sole approval authority
            </p>
          </div>
        </div>

        <button
          onClick={fetchPendingRequests}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Refresh Queue"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Request Cards List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">Loading pending department requisitions...</div>
      ) : requests.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-xs border-2 border-dashed border-slate-200 rounded-2xl">
          <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
          All department maintenance requisitions have been processed! No pending block authorizations.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {requests.map((req) => {
            const dept = getDeptBadge(req.department_id);
            return (
              <div
                key={req.id}
                className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 hover:bg-white hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${dept.className}`}>
                      {dept.icon}
                      {dept.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        req.priority === "URGENT"
                          ? "bg-red-100 text-red-700"
                          : req.priority === "HIGH"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {req.priority}
                    </span>
                  </div>

                  <div className="font-mono text-xs font-bold text-slate-800">{req.request_number}</div>
                  <h4 className="text-sm font-bold text-slate-900 mt-1 line-clamp-1">{req.work_type}</h4>

                  <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                    <div>
                      <span className="font-semibold text-slate-700">Section:</span> {req.section_name || `Section #${req.section_id}`}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Window:</span> {req.preferred_start} - {req.preferred_end} ({req.duration_minutes}m)
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 mt-2.5 line-clamp-2 italic bg-white p-2 rounded-xl border border-slate-100">
                    &ldquo;{req.reason}&rdquo;
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-200/60">
                  <button
                    onClick={() => setSelectedReq(req)}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={14} className="text-blue-200" />
                    Review & Authorize Block
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Drawer / Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto space-y-5">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold font-mono text-slate-900">{selectedReq.request_number}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                    Under Controller Review
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedReq.work_type}</h3>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Requisition Details */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Department:</span>{" "}
                  <span className="font-bold text-slate-800">{selectedReq.department_name || `Dept #${selectedReq.department_id}`}</span>
                </div>
                <div>
                  <span className="text-slate-500">Target Section:</span>{" "}
                  <span className="font-bold text-slate-800">{selectedReq.section_name || `Section #${selectedReq.section_id}`}</span>
                </div>
                <div>
                  <span className="text-slate-500">Location:</span>{" "}
                  <span className="font-semibold text-slate-800">{selectedReq.location_details || "Main Corridor"}</span>
                </div>
                <div>
                  <span className="text-slate-500">Duration Requested:</span>{" "}
                  <span className="font-semibold text-slate-800">{selectedReq.duration_minutes} minutes</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500">Machinery & Resources:</span>{" "}
                <span className="font-semibold text-slate-800">{selectedReq.required_resources || "Standard Gang"}</span>
              </div>

              <div>
                <span className="text-slate-500">Department Justification:</span>{" "}
                <span className="text-slate-700">{selectedReq.reason}</span>
              </div>
            </div>

            {/* Evaluated Candidate Time Window Slots */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles size={16} className="text-blue-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Evaluated Candidate Time Windows
                </h4>
              </div>

              {loadingCandidates ? (
                <div className="py-6 text-center text-slate-400 text-xs">Simulating CP-SAT train headway & conflict free slots...</div>
              ) : candidates.length === 0 ? (
                <div className="py-4 text-center text-slate-400 text-xs">No slots computed.</div>
              ) : (
                <div className="space-y-2.5">
                  {candidates.map((cand) => {
                    const isSelected = String(selectedCandidateId) === String(cand.candidate_id);
                    return (
                      <div
                        key={cand.candidate_id}
                        onClick={() => setSelectedCandidateId(String(cand.candidate_id))}
                        className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-600"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={isSelected}
                              onChange={() => setSelectedCandidateId(String(cand.candidate_id))}
                              className="accent-blue-600"
                            />
                            <span className="font-bold text-slate-900">{cand.window_name || cand.name}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              cand.score >= 90
                                ? "bg-emerald-600 text-white"
                                : cand.score >= 70
                                ? "bg-blue-600 text-white"
                                : "bg-amber-600 text-white"
                            }`}
                          >
                            Score: {cand.score}/100
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                          <div>
                            <span className="text-slate-400">Time:</span>{" "}
                            <span className="font-mono font-bold text-slate-800">
                              {cand.start_time} - {cand.end_time}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Train Delay:</span>{" "}
                            <span className="font-bold text-slate-800">{cand.train_impact_minutes} min</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Safety:</span>{" "}
                            <span className="font-bold text-emerald-600">{cand.safety_status}</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{cand.rationale}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Controller Remarks & Override */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Central Controller Official Remarks / Authority Endorsement
                </label>
                <input
                  type="text"
                  value={controllerRemarks}
                  onChange={(e) => setControllerRemarks(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="override"
                  checked={emergencyOverride}
                  onChange={(e) => setEmergencyOverride(e.target.checked)}
                  className="accent-amber-600 rounded"
                />
                <label htmlFor="override" className="text-xs text-slate-600 cursor-pointer">
                  Emergency Operational Override (Bypasses non-critical timetable restrictions under Sr. DOM authority)
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <XCircle size={15} />
                Reject Demand
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReq(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck size={16} />
                  {submitting ? "Signing Block Order..." : "Approve & Issue Block Order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
