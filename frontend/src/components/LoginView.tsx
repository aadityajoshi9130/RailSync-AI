"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  TrainFront,
  Zap,
  Radio,
  Lock,
  User,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react";

export default function LoginView() {
  const { login, quickLogin } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeRoleCard, setActiveRoleCard] = useState<string | null>(null);

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg("Please enter both username and password.");
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    const res = await login(username.trim(), password);
    setLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || "Authentication failed.");
    }
  };

  const handleQuickRoleSelect = async (roleUsername: string) => {
    setActiveRoleCard(roleUsername);
    setUsername(roleUsername);
    setPassword("railpass123");
    setErrorMsg(null);
    setLoading(true);
    const res = await quickLogin(roleUsername);
    setLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || "Quick login failed.");
      setActiveRoleCard(null);
    }
  };

  const ROLES = [
    {
      id: "controller",
      title: "Central Controller",
      officer: "Chief Operations Controller (Sr. DOM)",
      department: "Traffic & Operations Department",
      description: "Full network oversight, Digital Twin, conflict review, and final block approval authority.",
      icon: ShieldCheck,
      color: "border-blue-500/60 bg-blue-950/40 text-blue-400 hover:border-blue-400",
      badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      accent: "text-blue-400",
    },
    {
      id: "eng_track",
      title: "Engineering (Track)",
      officer: "Senior Divisional Engineer (Sr. DEN / Track)",
      department: "Permanent Way (P-Way) Department",
      description: "Track renewal, USFD flaw detection, tamping machinery, and corridor possession demands.",
      icon: TrainFront,
      color: "border-amber-500/60 bg-amber-950/40 text-amber-400 hover:border-amber-400",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      accent: "text-amber-400",
    },
    {
      id: "ohe_traction",
      title: "OHE / Traction",
      officer: "Senior Divisional Electrical Engineer (Sr. DEE)",
      department: "Traction Distribution (TrD) Department",
      description: "25kV catenary inspection, power block demands, tower wagon ops, and isolator maintenance.",
      icon: Zap,
      color: "border-cyan-500/60 bg-cyan-950/40 text-cyan-400 hover:border-cyan-400",
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      accent: "text-cyan-400",
    },
    {
      id: "st_telecom",
      title: "S&T / Signaling",
      officer: "Senior Divisional Signal & Telecom Engineer (Sr. DSTE)",
      department: "Signaling & Telecommunication Department",
      description: "Electronic interlocking, point machine overhauls, track circuits, and axle counter calibration.",
      icon: Radio,
      color: "border-purple-500/60 bg-purple-950/40 text-purple-400 hover:border-purple-400",
      badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      accent: "text-purple-400",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B132B] text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Ministry Banner */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-md">
              <img
                src="/india-railway-logo.svg"
                alt="Indian Railways Emblem"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-widest text-blue-400 uppercase">
                  Indian Railways · Central Railway
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                  Pune Division
                </span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                RailSync <span className="text-slate-400 font-light">| Digital Twin Operations</span>
              </h1>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Operational Security Gateway: <span className="text-slate-200 font-mono">RBAC v2.4</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Quick Role Selection Cards */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold tracking-wide uppercase">
                <Sparkles size={14} className="text-blue-400" />
                Select Operational Role to Enter
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
                Automatic Corridor Block Planning & Digital Twin
              </h2>
              <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
                Choose your department below for instant single-click access or enter standard credentials.
                Each operational department is segregated by strict Role-Based Access Control.
              </p>
            </div>

            {/* 4 Role Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {ROLES.map((r) => {
                const IconComponent = r.icon;
                const isSelected = activeRoleCard === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleQuickRoleSelect(r.id)}
                    disabled={loading}
                    className={`p-4 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden flex flex-col justify-between group cursor-pointer ${
                      r.color
                    } ${isSelected ? "ring-2 ring-blue-400 shadow-lg scale-[1.02]" : "hover:scale-[1.01]"}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`p-2.5 rounded-xl bg-white/10 ${r.accent}`}>
                          <IconComponent size={20} />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${r.badgeColor}`}>
                          1-Click Login
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white group-hover:text-blue-200 transition-colors">
                        {r.title}
                      </h3>
                      <p className="text-[11px] font-medium text-slate-300 mt-0.5">
                        {r.officer}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                        {r.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-slate-300 group-hover:text-white">
                      <span>Login as {r.title}</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Credentials Login Box */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Official Login Gateway</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter operational credentials or select a role on the left.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/50 text-red-300 text-xs flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleStandardLogin} className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Username / Officer ID
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <User size={16} />
                      </div>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. controller, eng_track, ohe_traction"
                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-2.5 pl-10 pr-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Secure Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Lock size={16} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-2.5 pl-10 pr-10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm font-medium font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                    <span>Default demo password: <code className="text-blue-400 font-mono">railpass123</code></span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Authenticate & Access Dashboard</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 text-center">
                  Protected under Indian Railways Cyber Security & Operations Standard 2026.
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 px-6 py-4 text-xs text-slate-500 text-center">
        RailSync / RailTwin · Central Railway (Pune Division) · Designed for Automatic Maintenance Block Optimization & Railway Digital Twin
      </footer>
    </div>
  );
}
