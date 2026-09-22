"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import DigitalTwin from "@/components/DigitalTwin";
import BlockPlannerView from "@/components/BlockPlannerView";
import MaintenanceView from "@/components/MaintenanceView";
import SimulationLabView from "@/components/SimulationLabView";
import AnalyticsView from "@/components/AnalyticsView";
import LoginView from "@/components/LoginView";
import NotificationCenter from "@/components/NotificationCenter";
import EngineeringDashboard from "@/components/EngineeringDashboard";
import OHEDashboard from "@/components/OHEDashboard";
import STDashboard from "@/components/STDashboard";
import PendingRequestsQueue from "@/components/PendingRequestsQueue";
import { AuthProvider, useAuth } from "@/context/AuthContext";

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
  Clock,
  LogOut,
  UserCheck,
  ShieldCheck,
  Hammer,
  Zap,
  Radio,
  ChevronDown,
  Layers,
} from "lucide-react";

interface BlockRecommendation {
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
  all_approved?: boolean;
  is_approved?: boolean;
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

function RailSyncApp() {
  const { user, isAuthenticated, isLoading, logout, quickLogin, authFetch } = useAuth();

  const [activeTab, setActiveTab] = useState<
    "command-center" | "block-planner" | "simulation-lab" | "maintenance" | "analytics"
  >("command-center");
  const [plannerSubTab, setPlannerSubTab] = useState<
    "timeline" | "xai" | "risk" | "approvals" | "audit"
  >("timeline");

  const [recommendation, setRecommendation] = useState<BlockRecommendation | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [approving, setApproving] = useState(false);

  // Operational state from backend
  const [opState, setOpState] = useState<OperationalState | null>(null);
  const [clockTime, setClockTime] = useState(() => {
    if (typeof window !== "undefined") {
      return new Date().toLocaleTimeString("en-GB", { hour12: false });
    }
    return "14:05:00";
  });
  const [clockDate, setClockDate] = useState(() => {
    if (typeof window !== "undefined") {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }
    return "2026-09-22";
  });
  const [clockRunning, setClockRunning] = useState(true);
  const [clockSpeed, setClockSpeed] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  // Format date for display (e.g., 2026-09-22 -> "22 Sep 2026")
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "----") {
      const now = new Date();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }
    try {
      const parts = dateStr.trim().split("-");
      if (parts.length === 3) {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const day = Number.parseInt(parts[2], 10);
        const monthIdx = Number.parseInt(parts[1], 10) - 1;
        const year = parts[0];
        if (!Number.isNaN(day) && monthIdx >= 0 && monthIdx < 12) {
          return `${day} ${months[monthIdx]} ${year}`;
        }
      }
      return dateStr;
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

  // Fetch optimization recommendation
  const fetchRecommendation = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/blocks/recommendation`);
      if (res.ok) {
        const data: BlockRecommendation = await res.json();
        setRecommendation(data);
      }
    } catch (err) {
      console.warn("Failed to load recommendation", err);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchRecommendation();
  }, [isAuthenticated, fetchRecommendation]);

  // Connect to SSE stream
  useEffect(() => {
    if (!isAuthenticated) return;
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
            if (trains) {
              setOpState((prev) =>
                prev
                  ? {
                      ...prev,
                      trains,
                      kpis: {
                        ...prev.kpis,
                        active_blocks_count: active_blocks_count ?? prev.kpis.active_blocks_count,
                      },
                    }
                  : prev
              );
            }
          } else if (msg.type === "LIFECYCLE_EVENT") {
            fetchOpState();
          } else if (msg.type === "CLOCK_CONTROL" && msg.data) {
            setClockTime(msg.data.operational_time);
            setClockDate(msg.data.operational_date);
            setClockRunning(msg.data.is_running);
            setClockSpeed(msg.data.speed_multiplier);
          }
        } catch {
          // Heartbeat
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        setTimeout(connectSSE, 2000);
      };
    };

    connectSSE();
    const pollInterval = setInterval(fetchOpState, 3000);

    return () => {
      clearInterval(pollInterval);
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [isAuthenticated, fetchOpState]);

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
    if (!recommendation) return;
    setApproving(true);
    const targetCode = recommendation.block_code || "Block A-17";
    const targetSecId = recommendation.section_id || 1;
    try {
      const res = await authFetch(
        `${API_BASE}/api/blocks/approve?block_code=${encodeURIComponent(targetCode)}&section_id=${targetSecId}`,
        {
          method: "POST",
        }
      );
      if (res.ok) {
        setIsApproved(true);
        fetchOpState();
        // After displaying confirmation, dynamically load the next candidate recommendation
        setTimeout(async () => {
          await fetchRecommendation();
          setIsApproved(false);
        }, 1200);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Approval authorization denied.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(false);
    }
  };

  // Loading Splash
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center p-3 animate-pulse mb-4">
          <img src="/india-railway-logo.svg" alt="Indian Railways" className="w-full h-full object-contain" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">RailSync</h2>
        <p className="text-xs text-slate-400 mt-1">Authorizing Railway Operational Session...</p>
      </div>
    );
  }

  // Unauthenticated -> Login View
  if (!isAuthenticated || !user) {
    return <LoginView />;
  }

  // Dynamic KPI data
  const kpis = opState?.kpis;
  const activeBlocksCount = kpis?.active_blocks_count ?? 0;
  const approvedBlocksCount = kpis?.approved_blocks_count ?? 0;

  // Role Badge Info
  const getRoleDisplay = (role: string) => {
    switch (role) {
      case "CENTRAL_CONTROLLER":
        return {
          title: "Chief Operations Controller",
          badge: "Central Controller",
          consoleName: "Command Center",
          divisionText: "Pune Central Operating Division",
          color: "bg-blue-600 text-white",
          avatarBg: "bg-blue-600",
          initials: "CC",
          icon: <ShieldCheck size={16} />,
          consoleIcon: <LayoutDashboard size={18} />,
        };
      case "ENGINEERING":
        return {
          title: "Senior Section Engineer (P-Way)",
          badge: "Track Engineering",
          consoleName: "P-Way Track Console",
          divisionText: "Civil Engineering / Track Division",
          color: "bg-amber-600 text-white",
          avatarBg: "bg-amber-600",
          initials: "ENG",
          icon: <Hammer size={16} />,
          consoleIcon: <Hammer size={18} />,
        };
      case "OHE_TRACTION":
        return {
          title: "Divisional Traction Engineer (TRD)",
          badge: "OHE / Traction",
          consoleName: "OHE Power Console",
          divisionText: "Electrical / 25kV AC Traction Division",
          color: "bg-indigo-600 text-white",
          avatarBg: "bg-indigo-600",
          initials: "OHE",
          icon: <Zap size={16} />,
          consoleIcon: <Zap size={18} />,
        };
      case "SIGNALING_TELECOM":
        return {
          title: "Senior Section Engineer (Signal & Telecom)",
          badge: "Signaling & Telecom",
          consoleName: "Interlocking Console",
          divisionText: "Signal & Interlocking Division",
          color: "bg-teal-600 text-white",
          avatarBg: "bg-teal-600",
          initials: "S&T",
          icon: <Radio size={16} />,
          consoleIcon: <Radio size={18} />,
        };
      default:
        return {
          title: "System Administrator",
          badge: "System Admin",
          consoleName: "Admin Console",
          divisionText: "Railway IT & Operations HQ",
          color: "bg-purple-600 text-white",
          avatarBg: "bg-purple-600",
          initials: "ADM",
          icon: <UserCheck size={16} />,
          consoleIcon: <LayoutDashboard size={18} />,
        };
    }
  };

  const roleInfo = getRoleDisplay(user.role);
  const isController = user.role === "CENTRAL_CONTROLLER" || user.role === "SYSTEM_ADMIN";

  // UNIFIED LAYOUT FRAME FOR ALL ROLES & TABS
  return (
    <div className="flex h-screen bg-[#F3F4F6] text-slate-900 font-sans overflow-hidden">
      {/* Universal Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 shadow-sm">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden p-1.5 shrink-0">
              <img src="/india-railway-logo.svg" alt="Indian Railways logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-none">RailSync</h1>
              <p className="text-[11px] text-slate-500 mt-1 font-medium truncate max-w-[140px]">
                {user.department_name || roleInfo.divisionText}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-7">
          {/* Operations Group */}
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-2">
              Operations
            </h2>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab("command-center")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-semibold text-sm transition-all text-left ${
                  activeTab === "command-center"
                    ? "bg-blue-50 text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {roleInfo.consoleIcon}
                <span>{roleInfo.consoleName}</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("block-planner");
                  setPlannerSubTab("timeline");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-medium text-sm transition-all text-left ${
                  activeTab === "block-planner" && plannerSubTab === "timeline"
                    ? "bg-blue-50 text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Calendar size={18} />
                <span>Corridor Block Planner</span>
              </button>

              {isController && (
                <button
                  onClick={() => setActiveTab("simulation-lab")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-medium text-sm transition-all text-left ${
                    activeTab === "simulation-lab"
                      ? "bg-blue-50 text-blue-700 shadow-sm font-bold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <FlaskConical size={18} />
                  <span>Simulation Lab</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab("maintenance")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-medium text-sm transition-all text-left ${
                  activeTab === "maintenance"
                    ? "bg-blue-50 text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Wrench size={18} />
                <span>Maintenance Demands</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("block-planner");
                  setPlannerSubTab("risk");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-medium text-sm transition-all text-left ${
                  activeTab === "block-planner" && plannerSubTab === "risk"
                    ? "bg-blue-50 text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <ShieldAlert size={18} />
                <span>Assets & Risk</span>
              </button>
            </nav>
          </div>

          {/* Management Group */}
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-2">
              Management & Safety
            </h2>
            <nav className="space-y-1">
              <button
                onClick={() => {
                  setActiveTab("block-planner");
                  setPlannerSubTab("approvals");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-medium text-sm transition-all text-left ${
                  activeTab === "block-planner" && plannerSubTab === "approvals"
                    ? "bg-blue-50 text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <CheckSquare size={18} />
                <span>Approvals & Orders</span>
              </button>

              <button
                onClick={() => setActiveTab("analytics")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-medium text-sm transition-all text-left ${
                  activeTab === "analytics"
                    ? "bg-blue-50 text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <FileText size={18} />
                <span>30-Day ML Analytics</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("block-planner");
                  setPlannerSubTab("audit");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-medium text-sm transition-all text-left ${
                  activeTab === "block-planner" && plannerSubTab === "audit"
                    ? "bg-blue-50 text-blue-700 shadow-sm font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <History size={18} />
                <span>Audit Trail</span>
              </button>
            </nav>
          </div>
        </div>

        {/* User Card at Bottom of Sidebar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div
                className={`w-9 h-9 rounded-xl ${roleInfo.avatarBg} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}
              >
                {roleInfo.initials}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-slate-900 truncate">{user.name}</div>
                <div className="text-[10px] font-semibold text-slate-500 truncate">{roleInfo.badge}</div>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Universal Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Universal Header with Operational Clock & Role Controls */}
          <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 pb-2">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${roleInfo.color}`}>
                  {roleInfo.icon}
                  {roleInfo.badge.toUpperCase()}
                </span>
                <span className="text-xs text-slate-400 font-mono">{roleInfo.divisionText}</span>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {activeTab === "command-center" && (user.role === "CENTRAL_CONTROLLER" || user.role === "SYSTEM_ADMIN" ? "Command Center" : roleInfo.consoleName)}
                {activeTab === "block-planner" && "Corridor Block Planner"}
                {activeTab === "simulation-lab" && "Simulation Lab"}
                {activeTab === "maintenance" && "Maintenance Demands Intake"}
                {activeTab === "analytics" && "30-Day Historical Operations & ML Engine"}
              </h2>
              <p className="text-slate-500 mt-1 text-sm">
                {activeTab === "command-center" && (user.role === "CENTRAL_CONTROLLER" || user.role === "SYSTEM_ADMIN"
                  ? "Operational view across corridor blocks, assets, and real-time train movement."
                  : `Dedicated ${roleInfo.badge} operational console with live requisitions, machinery status, and field progress reporting.`)}
                {activeTab === "block-planner" && "Integrated multi-department corridor blocks, timetable conflict resolution & decision explainability."}
                {activeTab === "simulation-lab" && "What-if scenario injector, timetable stress tester & real-time dynamic replanning."}
                {activeTab === "maintenance" && "Unified departmental maintenance demand intake for Track, Traction (OHE), and Signaling (S&T)."}
                {activeTab === "analytics" && "Calibrated on 1,320 actual IR train journeys, 121 corridor possessions, and Random Forest delay predictions."}
              </p>
            </div>

            {/* Authoritative Operational Clock & Action Bar */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
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

              {/* Clock Controls (Controller Sole Authority) */}
              {isController ? (
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl px-2 py-1.5 shadow-sm">
                  <button
                    onClick={() => controlClock(clockRunning ? "PAUSE" : "RESUME")}
                    className={`p-1.5 rounded-lg transition-colors ${clockRunning ? "hover:bg-amber-50 text-amber-600" : "hover:bg-emerald-50 text-emerald-600"}`}
                    title={clockRunning ? "Pause Clock" : "Resume Clock"}
                  >
                    {clockRunning ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    onClick={() => controlClock("RESET")}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                    title="Reset Clock to 14:30"
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
                      title={`${s}x clock speed`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Clock Master: Central Control
                </div>
              )}

              {/* Notification Popover */}
              <NotificationCenter />

              {/* Quick Role Switcher for Instantaneous Evaluation */}
              <div className="relative">
                <button
                  onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                >
                  <span>Switch Role</span>
                  <ChevronDown size={14} />
                </button>

                {showRoleSwitcher && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-xs space-y-1">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      1-Click Switch Role View
                    </div>
                    <button
                      onClick={() => {
                        quickLogin("controller");
                        setShowRoleSwitcher(false);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-blue-50 text-slate-800 font-semibold flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        <span>Central Controller</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Sr. DOM</span>
                    </button>
                    <button
                      onClick={() => {
                        quickLogin("eng_track");
                        setShowRoleSwitcher(false);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-amber-50 text-slate-800 font-semibold flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-600" />
                        <span>Engineering (P-Way)</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Track</span>
                    </button>
                    <button
                      onClick={() => {
                        quickLogin("ohe_traction");
                        setShowRoleSwitcher(false);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-indigo-50 text-slate-800 font-semibold flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                        <span>OHE Traction</span>
                      </div>
                      <span className="text-[10px] text-slate-400">25kV</span>
                    </button>
                    <button
                      onClick={() => {
                        quickLogin("st_telecom");
                        setShowRoleSwitcher(false);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-teal-50 text-slate-800 font-semibold flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-teal-600" />
                        <span>Signaling & Telecom</span>
                      </div>
                      <span className="text-[10px] text-slate-400">S&T</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Live Connection Indicator */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-sm">
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

          {/* Primary Command Center / Department Console Tab */}
          {activeTab === "command-center" && (
            <>
              {/* If Engineering Role -> Render Engineering Console */}
              {user.role === "ENGINEERING" && <EngineeringDashboard />}

              {/* If OHE Role -> Render OHE Console */}
              {user.role === "OHE_TRACTION" && <OHEDashboard />}

              {/* If S&T Role -> Render S&T Console */}
              {user.role === "SIGNALING_TELECOM" && <STDashboard />}

              {/* If Central Controller or Admin -> Render Central Operations Command Center */}
              {(user.role === "CENTRAL_CONTROLLER" || user.role === "SYSTEM_ADMIN") && (
                <>
                  {/* KPI Cards */}
                  <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                      { label: "Active Trains", value: `${kpis?.active_trains_count ?? 4} Live`, metric: clockRunning ? "Running" : "Paused", color: "text-blue-600 bg-blue-50" },
                      { label: "Open Requests", value: `${kpis?.open_requests_count ?? 4} Active`, metric: "Multi-Dept", color: "text-amber-600 bg-amber-50" },
                      { label: "Active Blocks", value: activeBlocksCount > 0 ? `${activeBlocksCount} Active` : "None", metric: activeBlocksCount > 0 ? "Section Restricted" : "All Clear", color: activeBlocksCount > 0 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50" },
                      { label: "Asset Availability", value: `${kpis?.asset_availability_pct ?? 96.4}%`, metric: activeBlocksCount === 0 ? "+2.1%" : "Restricted", color: "text-emerald-600 bg-emerald-50" },
                      { label: "Approved Blocks", value: `${approvedBlocksCount} Queued`, metric: "Pending Activation", color: "text-slate-600 bg-slate-100" },
                      { label: "Clock Speed", value: `${clockSpeed}x`, metric: clockRunning ? "Simulating" : "Paused", color: "text-blue-600 bg-blue-50" },
                    ].map((kpi) => (
                      <div key={kpi.label} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col shadow-sm">
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

                  {/* Pending Department Requests Queue */}
                  <PendingRequestsQueue onWorkflowActionComplete={fetchOpState} />

                  {/* Digital Twin and Optimization Recommendation Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Digital Twin Map */}
                    <section className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">Railway Network Overview</h3>
                          <p className="text-sm text-slate-500">Live digital-twin state · Central Corridor</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            if (activeBlocksCount > 0) {
                              return (
                                <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                                  {activeBlocksCount} ACTIVE BLOCK{activeBlocksCount > 1 ? "S" : ""}
                                </span>
                              );
                            }
                            if (approvedBlocksCount > 0) {
                              return (
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                                  {approvedBlocksCount} APPROVED
                                </span>
                              );
                            }
                            return (
                              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                                ALL CLEAR
                              </span>
                            );
                          })()}
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

                    {/* Optimization Recommendation Panel */}
                    <section className="bg-[#152336] rounded-3xl p-8 flex flex-col text-slate-50 shadow-lg relative overflow-hidden justify-between border border-slate-700/40 min-h-[560px]">
                      {recommendation?.all_approved ? (
                        <div className="relative z-10 space-y-6 flex flex-col justify-between h-full">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-bold tracking-wider text-emerald-400 uppercase flex items-center gap-1.5">
                                <CheckCircle2 size={14} className="text-emerald-400" />
                                Corridor Optimization Complete
                              </p>
                              <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold rounded-full">
                                100% QUEUED
                              </span>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1">
                              All Corridors Approved
                            </h3>
                            <p className="text-sm text-slate-400">
                              Pune Division Network · Live Timetable Synchronized
                            </p>
                          </div>

                          <div className="inline-block px-3.5 py-1 bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 rounded-xl text-sm font-bold w-fit">
                            Optimal Synchronization · 100 / 100
                          </div>

                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                              <span className="text-slate-400">Approved possessions</span>
                              <span className="font-semibold text-emerald-400">6 Corridors Active</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                              <span className="text-slate-400">Possession time saved</span>
                              <span className="font-semibold text-white">380 min</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                              <span className="text-slate-400">Train clashes</span>
                              <span className="font-semibold text-emerald-400">0 min (Zero clash)</span>
                            </div>
                            <div className="flex justify-between items-center pb-1">
                              <span className="text-slate-400">Digital signatures</span>
                              <span className="font-semibold text-blue-400">Cryptographically Signed</span>
                            </div>
                          </div>

                          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Corridor Status</p>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              All multi-department possession slots have been authorized by the Central Controller. Live train graph updated with zero passenger detention.
                            </p>
                          </div>

                          <div className="flex flex-col gap-3 pt-2">
                            <button
                              onClick={() => {
                                setActiveTab("block-planner");
                                setPlannerSubTab("timeline");
                              }}
                              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
                            >
                              <Layers size={16} />
                              View Block Timeline
                            </button>
                            <button
                              onClick={() => setActiveTab("simulation-lab")}
                              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
                            >
                              Run simulation lab
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative z-10 space-y-6 flex flex-col justify-between h-full">
                          <div className="space-y-5">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold tracking-wider text-blue-300 uppercase flex items-center gap-1.5">
                                <Sparkles size={14} className="text-blue-400" />
                                Optimization Recommendation
                              </p>
                              {recommendation?.section_id && (
                                <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                                  Section {recommendation.section_id} of 6
                                </span>
                              )}
                            </div>

                            <div>
                              <h3 className="text-3xl font-bold text-white mb-1 transition-all duration-300">
                                {recommendation?.block_code || "Block A-17"}
                              </h3>
                              <p className="text-sm text-slate-400">
                                {recommendation?.section_name || "Pune-Lonavala"} · {recommendation?.start_time || "02:00"}–{recommendation?.end_time || "05:00"}
                              </p>
                            </div>

                            <div className="inline-block px-3.5 py-1 bg-blue-900/60 border border-blue-700/60 text-blue-300 rounded-xl text-sm font-bold w-fit">
                              {recommendation?.score ?? 96} / 100
                            </div>

                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                                <span className="text-slate-400">Train impact</span>
                                <span className="font-semibold text-white">
                                  {recommendation?.train_impact_minutes ?? 8} min
                                </span>
                              </div>
                              <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                                <span className="text-slate-400">Departments</span>
                                <span className="font-semibold text-white">
                                  {recommendation?.departments_count ?? 3} coordinated
                                </span>
                              </div>
                              <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                                <span className="text-slate-400">Priority jobs</span>
                                <span className="font-semibold text-white">
                                  {recommendation?.priority_jobs || "44 high · 15 medium"}
                                </span>
                              </div>
                              <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                                <span className="text-slate-400">Resources</span>
                                <span className="font-semibold text-white">Available</span>
                              </div>
                              <div className="flex justify-between items-center pb-1">
                                <span className="text-slate-400">Safety gate</span>
                                <span className="font-semibold text-emerald-400">
                                  {recommendation?.safety_status || "PASS"}
                                </span>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-bold text-white uppercase tracking-wider mb-1">Why this plan?</p>
                              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                                {recommendation?.rationale || "Low traffic + joint work + no route conflict."}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 pt-4 z-10">
                            {isApproved ? (
                              <div className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md border border-emerald-500 animate-pulse">
                                <CheckCircle2 size={16} />
                                Approved! Loading next recommendation...
                              </div>
                            ) : (
                              <button
                                onClick={handleApprove}
                                disabled={approving}
                                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                              >
                                {approving ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing Approval...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 size={16} />
                                    Approve recommendation
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              onClick={() => setActiveTab("simulation-lab")}
                              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
                            >
                              Run simulation
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <RailSyncApp />
    </AuthProvider>
  );
}
