"use client";

import React, { useState, useEffect } from "react";
import DigitalTwin from "@/components/DigitalTwin";
import BlockPlannerView from "@/components/BlockPlannerView";
import MaintenanceView from "@/components/MaintenanceView";
import SimulationLabView from "@/components/SimulationLabView";
import AnalyticsView from "@/components/AnalyticsView";

import {
  LayoutDashboard,
  Calendar,
  Activity,
  FlaskConical,
  Wrench,
  ShieldAlert,
  CheckSquare,
  FileText,
  History,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface AIRecommendation {
  block_code: string;
  section_id: number;
  section_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  score: number;
  train_impact_minutes: number;
  departments_count: number;
  priority_jobs: string;
  safety_gate_passed: number;
  safety_status: string;
  rationale: string;
  details: { metric: string; value: string }[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<
    "command-center" | "block-planner" | "simulation-lab" | "maintenance" | "assets-risk" | "analytics"
  >("command-center");

  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [approving, setApproving] = useState(false);

  // Fetch live AI recommendation
  useEffect(() => {
    fetch("http://localhost:8000/api/blocks/recommendation")
      .then((res) => res.json())
      .then((data) => setRecommendation(data))
      .catch((err) => console.warn("Failed to load recommendation", err));
  }, []);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch("http://localhost:8000/api/blocks/approve", {
        method: "POST",
      });
      if (res.ok) {
        setIsApproved(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F3F4F6] text-slate-900 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden p-1.5">
              <img src="/india-railway-logo.svg" alt="Indian Railways logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">RailSync Ai</h1>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">AI Operations Platform</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-8">
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
              Operations
            </h2>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab("command-center")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-colors text-left ${
                  activeTab === "command-center"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <LayoutDashboard size={18} />
                Command Center
              </button>

              <button
                onClick={() => setActiveTab("block-planner")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-colors text-left ${
                  activeTab === "block-planner"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Calendar size={18} />
                Block Planner
              </button>

              <button
                onClick={() => setActiveTab("simulation-lab")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-colors text-left ${
                  activeTab === "simulation-lab"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <FlaskConical size={18} />
                Simulation Lab
              </button>

              <button
                onClick={() => setActiveTab("maintenance")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-colors text-left ${
                  activeTab === "maintenance"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Wrench size={18} />
                Maintenance
              </button>

              <button
                onClick={() => setActiveTab("block-planner")}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left"
              >
                <ShieldAlert size={18} />
                Assets & Risk
              </button>
            </nav>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
              Management
            </h2>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab("block-planner")}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left"
              >
                <CheckSquare size={18} />
                Approvals
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-colors text-left ${
                  activeTab === "analytics"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <FileText size={18} />
                30-Day Analytics & ML
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-colors text-left ${
                  activeTab === "analytics"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <History size={18} />
                Audit Trail
              </button>
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top Header */}
          <header className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                {activeTab === "command-center" && "Command Center"}
                {activeTab === "block-planner" && "Corridor Block Planner"}
                {activeTab === "simulation-lab" && "Simulation Lab"}
                {activeTab === "maintenance" && "Maintenance Demands"}
                {activeTab === "analytics" && "30-Day Historical Operations & ML Engine"}
              </h2>
              <p className="text-slate-500 mt-1">
                {activeTab === "command-center" && "Operational view across blocks, assets and train movement."}
                {activeTab === "block-planner" && "Integrated multi-department corridor blocks & timeline scheduling."}
                {activeTab === "simulation-lab" && "What-if scenario injector & real-time dynamic replanning."}
                {activeTab === "maintenance" && "Departmental maintenance request intake for Track, Traction and Signalling."}
                {activeTab === "analytics" && "Calibrated on 1,320 actual IR train journeys, 121 corridor possessions, and Random Forest delay predictions."}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              LIVE
              <span className="ml-2 pl-2 border-l border-slate-300 font-mono">17 Sep 2026 - 19:40 IST</span>
            </div>
          </header>

          {/* Conditional View Rendering */}
          {activeTab === "block-planner" && <BlockPlannerView />}
          {activeTab === "maintenance" && <MaintenanceView />}
          {activeTab === "simulation-lab" && <SimulationLabView />}
          {activeTab === "analytics" && <AnalyticsView />}

          {activeTab === "command-center" && (

            <>
              {/* KPI Cards */}
              <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Active Trains", value: "4 Live", metric: "Continuous Sim", color: "text-blue-600 bg-blue-50" },
                  { label: "Open Requests", value: "4 Active", metric: "3 Depts", color: "text-amber-600 bg-amber-50" },
                  { label: "Safe Conflicts", value: "0 Severe", metric: "All Validated", color: "text-emerald-600 bg-emerald-50" },
                  { label: "Asset Availability", value: "96.4%", metric: "+2.1%", color: "text-emerald-600 bg-emerald-50" },
                  { label: "Blocks Optimized", value: "4 Corridors", metric: "Today", color: "text-slate-600 bg-slate-100" },
                  { label: "On-time Impact", value: "-12 min", metric: "vs baseline", color: "text-blue-600 bg-blue-50" },
                ].map((kpi, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col shadow-sm">
                    <span className="text-slate-500 text-sm font-medium">{kpi.label}</span>
                    <span className="text-2xl font-bold text-slate-900 mt-2">{kpi.value}</span>
                    <div className="mt-auto pt-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${kpi.color}`}>
                        {kpi.metric}
                      </span>
                    </div>
                  </div>
                ))}
              </section>

              {/* Digital Twin and AI Recommendation Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Digital Twin Map */}
                <section className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Railway Network Overview</h3>
                      <p className="text-sm text-slate-500">Live digital-twin state · Central Corridor</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                        2 ACTIVE BLOCKS
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 relative min-h-[420px]">
                    <DigitalTwin />
                    {/* Digital twin legend overlay */}
                    <div className="absolute bottom-4 left-4 flex gap-3 z-10 pointer-events-none">
                      <span className="flex items-center gap-1.5 text-xs font-medium bg-white/90 px-2.5 py-1 rounded-lg shadow-sm border border-slate-200 backdrop-blur">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Train
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-medium bg-white/90 px-2.5 py-1 rounded-lg shadow-sm border border-slate-200 backdrop-blur">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Maintenance
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-medium bg-white/90 px-2.5 py-1 rounded-lg shadow-sm border border-slate-200 backdrop-blur">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Safe
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-medium bg-white/90 px-2.5 py-1 rounded-lg shadow-sm border border-slate-200 backdrop-blur">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Conflict
                      </span>
                    </div>
                  </div>
                </section>

                {/* AI Recommendation Panel */}
                <section className="bg-[#152336] rounded-3xl p-8 flex flex-col text-slate-50 shadow-lg relative overflow-hidden justify-between">
                  <div className="relative z-10 space-y-6">
                    <div>
                      <p className="text-xs font-bold tracking-wider text-blue-300 uppercase mb-2 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-blue-400" />
                        AI Recommendation
                      </p>
                      <h3 className="text-3xl font-bold text-white mb-1">
                        {recommendation?.block_code || "Block A-17"}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {recommendation?.section_name || "Pune → Lonavala"} · {recommendation?.start_time || "02:00"}–{recommendation?.end_time || "05:00"}
                      </p>
                    </div>

                    <div className="inline-block px-3.5 py-1 bg-blue-900/60 border border-blue-700/60 text-blue-300 rounded-xl text-sm font-bold">
                      {recommendation?.score || 97} / 100
                    </div>

                    <div className="space-y-3.5 text-sm">
                      <div className="flex justify-between items-center border-b border-slate-700/50 pb-2.5">
                        <span className="text-slate-400">Train impact</span>
                        <span className="font-semibold text-white">
                          {recommendation?.train_impact_minutes || 8} min
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-700/50 pb-2.5">
                        <span className="text-slate-400">Departments</span>
                        <span className="font-semibold text-white">
                          {recommendation?.departments_count || 3} coordinated
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-700/50 pb-2.5">
                        <span className="text-slate-400">Priority jobs</span>
                        <span className="font-semibold text-white">
                          {recommendation?.priority_jobs || "2 high · 1 medium"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-700/50 pb-2.5">
                        <span className="text-slate-400">Resources</span>
                        <span className="font-semibold text-white">Available</span>
                      </div>
                      <div className="flex justify-between items-center pb-1">
                        <span className="text-slate-400">Safety gate</span>
                        <span className="font-semibold text-emerald-400">
                          {recommendation?.safety_status || "PASSED"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-wider mb-1">Why this plan?</p>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {recommendation?.rationale || "Low traffic + joint work + no route conflict."}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-6 z-10">
                    {isApproved ? (
                      <div className="w-full bg-emerald-600/90 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md border border-emerald-500">
                        <CheckCircle2 size={16} />
                        Approved by Controller
                      </div>
                    ) : (
                      <button
                        onClick={handleApprove}
                        disabled={approving}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors shadow-sm"
                      >
                        {approving ? "Processing Approval..." : "Approve recommendation"}
                      </button>
                    )}

                    <button
                      onClick={() => setActiveTab("simulation-lab")}
                      className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
                    >
                      Run simulation
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
