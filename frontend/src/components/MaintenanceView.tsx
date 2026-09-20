"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, Plus, CheckCircle2, Clock, AlertCircle, Sparkles, Filter } from 'lucide-react';

interface MaintenanceTask {
  id: number;
  department_id: number;
  section_id: number;
  description: string;
  priority: string;
  duration_minutes: number;
  created_at: string;
  department?: { id: number; name: string };
  section?: { id: number; name: string };
}

export default function MaintenanceView() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [deptId, setDeptId] = useState(1);
  const [sectionId, setSectionId] = useState(1);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("HIGH");
  const [duration, setDuration] = useState(120);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/api/maintenance/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('http://localhost:8000/api/maintenance/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_id: Number(deptId),
          section_id: Number(sectionId),
          description,
          priority,
          duration_minutes: Number(duration),
        }),
      });

      if (res.ok) {
        setSuccessMsg("Maintenance request submitted and added to the corridor optimization pool!");
        setDescription("");
        setShowModal(false);
        fetchTasks();
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Maintenance Request Management</h3>
          <p className="text-sm text-slate-500 mt-0.5">Unified departmental intake for Track, Traction (OHE) and Signalling (S&T)</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
        >
          <Plus size={16} />
          New Maintenance Request
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-2 text-sm">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Task List Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Active Demands ({tasks.length})
          </h4>
          <span className="text-xs text-slate-400">Auto-synced with RailSync Ai Optimizer</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Task / Description</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Corridor Section</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    {task.description}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md">
                      {task.department?.name || `Dept #${task.department_id}`}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    {task.section?.name || `Section #${task.section_id}`}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      task.priority === 'HIGH' ? 'bg-red-50 text-red-700 border border-red-200' :
                      task.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                    {task.duration_minutes} min
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <Sparkles size={12} />
                      Synthesized
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submission Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-lg font-bold text-slate-900">Submit Maintenance Demand</h4>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={deptId}
                  onChange={(e) => setDeptId(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                >
                  <option value={1}>Engineering (Track / P-Way)</option>
                  <option value={2}>OHE / Traction Power</option>
                  <option value={3}>S&T (Signalling & Telecom)</option>
                  <option value={4}>Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Corridor Section</label>
                <select
                  value={sectionId}
                  onChange={(e) => setSectionId(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                >
                  <option value={1}>Pune — Lonavala (64 km)</option>
                  <option value={2}>Lonavala — Karjat (28 km)</option>
                  <option value={3}>Pune — Daund (75 km)</option>
                  <option value={4}>Daund — Solapur (187 km)</option>
                  <option value={5}>Solapur — Kurduvadi (79 km)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Job Description & Assets</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Ultrasonic rail flaw detection (USFD) & switch replacement"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                  >
                    <option value="HIGH">HIGH (Safety Critical)</option>
                    <option value="MEDIUM">MEDIUM (Periodic)</option>
                    <option value="LOW">LOW (Routine)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min={30}
                    max={480}
                    step={15}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-sm transition-colors"
                >
                  {submitting ? "Submitting..." : "Submit Demand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
