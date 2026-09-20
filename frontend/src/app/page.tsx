"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import DigitalTwin from "@/components/DigitalTwin";
import BlockPlannerView from "@/components/BlockPlannerView";
import MaintenanceView from "@/components/MaintenanceView";
import SimulationLabView from "@/components/SimulationLabView";
import AnalyticsView from "@/components/AnalyticsView";

import {
  LayoutDashboard,
  Calendar,
  FlaskConical,
  Wrench,
  ShieldAlert,
  CheckSquare,
  FileText,
  History,
  CheckCircle2,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Clock,
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

interface OperationalState {
  clock: {
    operational_date: string;
    operational_time: string;
    operational_hm: string;
    is_running: boolean;
    speed_multiplier: number;
  };
  trains: {
    id: number;
    name: string;
    current_section_id: number;
    section_name: string;
    position: number;
    status: string;
    is_restricted: boolean;
  }[];
  blocks: {
    id: number;
    block_code: string;
    section_id: number;
    section_name: string;
    start_time: string;
    end_time: string;
    status: string;
    score: number;
    departments_count: number;
    train_impact_minutes: number;
  }[];
  kpis: {
    active_trains_count: number;
    active_blocks_count: number;
    approved_blocks_count: number;
    open_requests_count: number;
    asset_availability_pct: number;
    restricted_sections: number[];
  };
}

const API_BASE = "http://localhost:8000";

export default function Home() {
  const [activeTab, setActiveTab] = useState<
    "command-center" | "block-planner" | "simulation-lab" | "maintenance" | "analytics"
  >("command-center");
  const [plannerSubTab, setPlannerSubTab] = useState<
    "timeline" | "xai" | "risk" | "approvals" | "audit"
  >("timeline");

  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [approving, setApproving] = useState(false);

  // Operational state from backend
  const [opState, setOpState] = useState<OperationalState | null>(null);
  const [clockTime, setClockTime] = useState("--:--:--");
  const [clockDate, setClockDate] = useState("----");
  const [clockRunning, setClockRunning] = useState(true);
  const [clockSpeed, setClockSpeed] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  // Fetch initial operational state
  const fetchOpState = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/operational/state`);
      if (res.ok) {
        const data: OperationalState = await res.json();
        setOpState(data);
        setClockTime(data.clock.operational_time);
        setClockDate(data.clock.operational_date);
        setClockRunning(data.clock.is_running);
        setClockSpeed(data.clock.speed_multiplier);
      }
    } catch (err) {
      console.warn("Failed to fetch operational state", err);
    }
  }, []);

  // Fetch AI recommendation
  useEffect(() => {
    fetch(`${API_BASE}/api/blocks/recommendation`)
      .then((res) => res.json())
      .then((data) => setRecommendation(data))
      .catch((err) => console.warn("Failed to load recommendation", err));
  }, []);

  // Connect to SSE stream
  useEffect(() => {
    fetchOpState();

    const connectSSE = () => {
      if (sseRef.current) {
        sseRef.current.close();
      }

      const es = new EventSource(`${API_BASE}/api/operational/stream`);
      sseRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "CLOCK_TICK" && msg.data) {
            const { clock, trains, active_blocks_count } = msg.data;
            if (clock) {
              setClockTime(clock.operational_time);
              setClockDate(clock.operational_date);
              setClockRunning(clock.is_running);
              setClockSpeed(clock.speed_multiplier);
            }
            // Update opState trains if we have fresh train data
            if (trains) {
              setOpState(prev => prev ? { ...prev, trains, kpis: { ...prev.kpis, active_blocks_count: active_blocks_count ?? prev.kpis.active_blocks_count } } : prev);
            }
          } else if (msg.type === "LIFECYCLE_EVENT") {
            // Re-fetch full state on lifecycle transitions
            fetchOpState();
          } else if (msg.type === "CLOCK_CONTROL" && msg.data) {
            setClockTime(msg.data.operational_time);
            setClockDate(msg.data.operational_date);
            setClockRunning(msg.data.is_running);
            setClockSpeed(msg.data.speed_multiplier);
          }
        } catch {
          // heartbeat or unparseable message
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        // Reconnect after 2s
        setTimeout(connectSSE, 2000);
      };
    };

    connectSSE();

    // Also poll operational state every 3 seconds as fallback
    const pollInterval = setInterval(fetchOpState, 3000);

    return () => {
      clearInterval(pollInterval);
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [fetchOpState]);

  // Clock control
  const controlClock = async (action: string, speed?: number) => {
    try {
      await fetch(`${API_BASE}/api/operational/clock/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, speed }),
      });
    } catch (err) {
      console.error("Clock control error:", err);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`${API_BASE}/api/blocks/approve`, {
        method: "POST",
      });
      if (res.ok) {
        setIsApproved(true);
        fetchOpState();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(false);
    }
  };

  // Dynamic KPI data
  const kpis = opState?.kpis;
  const activeBlocksCount = kpis?.active_blocks_count ?? 0;
  const approvedBlocksCount = kpis?.approved_blocks_count ?? 0;

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
                onClick={() => {
                  setActiveTab("block-planner");
                  setPlannerSubTab("timeline");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-colors text-left ${
                  activeTab === "block-planner" && plannerSubTab === "timeline"
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
                onClick={() => {
                  setActiveTab("block-planner");
                  setPlannerSubTab("risk");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-colors text-left ${
                  activeTab === "block-planner" && plannerSubTab === "risk"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
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
                onClick={() => {
                  setActiveTab("block-planner");
                  setPlannerSubTab("approvals");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-colors text-left ${
                  activeTab === "block-planner" && plannerSubTab === "approvals"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
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
                onClick={() => {
                  setActiveTab("block-planner");
                  setPlannerSubTab("audit");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-colors text-left ${
                  activeTab === "block-planner" && plannerSubTab === "audit"
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
          {/* Top Header with Operational Clock */}
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

            {/* Authoritative Operational Clock Bar */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Clock Display */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
                <Clock size={15} className="text-slate-400" />
                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-slate-900 leading-none tracking-tight">
                    {clockTime}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                    {formatDate(clockDate)} IST
                  </div>
                </div>
              </div>

              {/* Clock Controls */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl px-2 py-1.5 shadow-sm">
                <button
                  onClick={() => controlClock(clockRunning ? "PAUSE" : "RESUME")}
                  className={`p-1.5 rounded-lg transition-colors ${clockRunning ? "hover:bg-amber-50 text-amber-600" : "hover:bg-emerald-50 text-emerald-600"}`}
                  title={clockRunning ? "Pause" : "Resume"}
                >
                  {clockRunning ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  onClick={() => controlClock("RESET")}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                  title="Reset to 14:30"
                >
                  <RotateCcw size={14} />
                </button>
                <div className="w-px h-5 bg-slate-200 mx-1" />
                {[1, 5, 10, 60].map((s) => (
                  <button
                    key={s}
                    onClick={() => controlClock("SPEED", s)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                      clockSpeed === s
                        ? "bg-blue-600 text-white"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                    title={`${s}x speed`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              {/* Connection Status */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-400"}`} />
                {isConnected ? "LIVE" : "OFFLINE"}
              </div>
            </div>
          </header>

          {/* Conditional View Rendering */}
          {activeTab === "block-planner" && <BlockPlannerView initialSubTab={plannerSubTab} />}
          {activeTab === "maintenance" && <MaintenanceView />}
          {activeTab === "simulation-lab" && <SimulationLabView />}
          {activeTab === "analytics" && <AnalyticsView />}

          {activeTab === "command-center" && (

            <>
              {/* KPI Cards — dynamically connected */}
              <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Active Trains", value: `${kpis?.active_trains_count ?? 4} Live`, metric: clockRunning ? "Running" : "Paused", color: "text-blue-600 bg-blue-50" },
                  { label: "Open Requests", value: `${kpis?.open_requests_count ?? 4} Active`, metric: "Multi-Dept", color: "text-amber-600 bg-amber-50" },
                  { label: "Active Blocks", value: activeBlocksCount > 0 ? `${activeBlocksCount} Active` : "None", metric: activeBlocksCount > 0 ? "Section Restricted" : "All Clear", color: activeBlocksCount > 0 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50" },
                  { label: "Asset Availability", value: `${kpis?.asset_availability_pct ?? 96.4}%`, metric: activeBlocksCount === 0 ? "+2.1%" : "Restricted", color: "text-emerald-600 bg-emerald-50" },
                  { label: "Approved Blocks", value: `${approvedBlocksCount} Queued`, metric: "Pending Activation", color: "text-slate-600 bg-slate-100" },
                  { label: "Clock Speed", value: `${clockSpeed}x`, metric: clockRunning ? "Simulating" : "Paused", color: "text-blue-600 bg-blue-50" },
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
                      {activeBlocksCount > 0 ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                          {activeBlocksCount} ACTIVE BLOCK{activeBlocksCount > 1 ? "S" : ""}
                        </span>
                      ) : approvedBlocksCount > 0 ? (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                          {approvedBlocksCount} APPROVED
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                          ALL CLEAR
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 rounded-2xl overflow-hidden min-h-[460px]">
                    <DigitalTwin
                      operationalTrains={opState?.trains}
                      operationalBlocks={opState?.blocks}
                      operationalTime={clockTime}
                    />
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
