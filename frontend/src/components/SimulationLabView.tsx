"use client";

import React, { useState } from 'react';
import { 
  FlaskConical, 
  Play, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowRight, 
  Zap, 
  CheckCircle2, 
  Clock, 
  TrendingDown, 
  Layers,
  TrainFront,
  Sliders,
  Sparkles
} from 'lucide-react';

interface ScenarioResult {
  scenario: {
    type: string;
    title: string;
    description: string;
    section_name: string;
    shock_magnitude: number;
    primary_train: string;
  };
  metrics_comparison: {
    baseline: {
      total_delay_minutes: number;
      punctuality_pct: number;
      passenger_hours_lost: number;
      impacted_trains: number;
    };
    unmitigated_shock: {
      total_delay_minutes: number;
      punctuality_pct: number;
      passenger_hours_lost: number;
      impacted_trains: number;
    };
    ai_mitigated: {
      total_delay_minutes: number;
      punctuality_pct: number;
      passenger_hours_lost: number;
      impacted_trains: number;
      delay_saved_minutes: number;
      recovery_efficiency_pct: number;
    };
  };
  ai_mitigation_plan: {
    strategy_title: string;
    confidence_score: number;
    safety_gate: string;
    dispatch_orders: string[];
  };
  train_schedule_comparison: {
    unmitigated: Array<{
      train_number: string;
      name: string;
      type: string;
      priority: string;
      scheduled_time: string;
      delay_minutes: number;
      operational_impact: string;
    }>;
    mitigated: Array<{
      train_number: string;
      name: string;
      type: string;
      priority: string;
      scheduled_time: string;
      mitigated_delay: number;
      delay_saved: number;
      dispatch_instruction: string;
      status: string;
    }>;
  };
}

export default function SimulationLabView() {
  const [scenarioType, setScenarioType] = useState<string>("train_delay");
  const [sectionId, setSectionId] = useState<number>(1);
  const [trainNumber, setTrainNumber] = useState<string>("12028");
  const [magnitude, setMagnitude] = useState<number>(45);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<ScenarioResult | null>(null);
  const [appliedMitigation, setAppliedMitigation] = useState<boolean>(false);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setAppliedMitigation(false);
    try {
      const res = await fetch('http://localhost:8000/api/blocks/simulate-whatif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_type: scenarioType,
          section_id: sectionId,
          magnitude: Number(magnitude),
          train_number: trainNumber,
          time_of_day: "14:00"
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSimulationResult(data);
      } else {
        console.error("Simulation API failed");
      }
    } catch (err) {
      console.error("What-If simulation request failed", err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FlaskConical size={22} className="text-blue-600" />
            What-If Operational Simulator & Dynamic Replanner
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Inject train delays, emergency track blocks, or speed restrictions to evaluate cascading knock-on effects and automated AI dispatch recoveries.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 border border-cyan-200 rounded-full">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-xs font-bold text-cyan-800 uppercase tracking-wider">
            Monte-Carlo Headway Engine Ready
          </span>
        </div>
      </div>

      {/* Main Grid: Left Controls + Right Simulation Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scenario Configuration Panel (4 cols) */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Sliders size={16} className="text-blue-600" />
            1. Select Incident Scenario
          </h4>

          {/* Scenario Selector Cards */}
          <div className="space-y-2">
            {[
              { id: "train_delay", title: "🚆 Train Delay Shock", desc: "Express train delayed by headway clash or dwell overrun", magLabel: "Delay (Minutes)", min: 15, max: 120, def: 45 },
              { id: "emergency_block", title: "🚧 Emergency Track Block", desc: "Sudden broken rail or catenary snap requiring track closure", magLabel: "Closure Duration (Min)", min: 60, max: 240, def: 180 },
              { id: "speed_restriction", title: "⚠️ Caution Order (TSR)", desc: "Rail defect or monsoon slurry requiring speed reduction", magLabel: "Imposed Speed (km/h)", min: 20, max: 60, def: 30 },
              { id: "power_outage", title: "⚡ OHE Traction Power Trip", desc: "Substation trip halting all electric locomotives", magLabel: "Outage Duration (Min)", min: 20, max: 90, def: 45 },
            ].map(sc => (
              <div
                key={sc.id}
                onClick={() => {
                  setScenarioType(sc.id);
                  setMagnitude(sc.def);
                  setSimulationResult(null);
                }}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  scenarioType === sc.id
                    ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-100'
                    : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/60'
                }`}
              >
                <div className="font-bold text-xs text-slate-900">{sc.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{sc.desc}</div>
              </div>
            ))}
          </div>

          <hr className="border-slate-100" />

          {/* Parameter Customization */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              2. Adjust Shock Parameters
            </h4>

            {/* Corridor Section Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Affected Corridor Section</label>
              <select
                value={sectionId}
                onChange={e => setSectionId(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-blue-500"
              >
                <option value={1}>Pune — Lonavala (64 km Double Track)</option>
                <option value={2}>Lonavala — Karjat (28 km Bhor Ghat Incline)</option>
                <option value={3}>Pune — Daund (75 km Broad Gauge)</option>
                <option value={4}>Daund — Solapur (187 km Mainline)</option>
                <option value={5}>Solapur — Kurduvadi (79 km)</option>
              </select>
            </div>

            {/* Primary Train Selector (only for train_delay scenario) */}
            {scenarioType === "train_delay" && (
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Primary Delayed Train</label>
                <select
                  value={trainNumber}
                  onChange={e => setTrainNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-blue-500"
                >
                  <option value="12028">12028 Pune Shatabdi Express (Superfast)</option>
                  <option value="12124">12124 Deccan Queen Express (Superfast)</option>
                  <option value="22226">22226 Solapur-CSMT Vande Bharat (Critical)</option>
                  <option value="11019">11019 Konark Express (Mail/Express)</option>
                  <option value="BOXN-7041">BOXN-7041 Thermal Coal Rake (Freight)</option>
                </select>
              </div>
            )}

            {/* Shock Magnitude Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-600">
                  {scenarioType === "speed_restriction" ? "Imposed Speed Limit" : "Shock Duration"}
                </label>
                <span className="text-xs font-black text-blue-600 font-mono">
                  {magnitude} {scenarioType === "speed_restriction" ? "km/h" : "min"}
                </span>
              </div>
              <input
                type="range"
                min={scenarioType === "speed_restriction" ? 20 : (scenarioType === "emergency_block" ? 60 : 15)}
                max={scenarioType === "speed_restriction" ? 60 : (scenarioType === "emergency_block" ? 240 : 120)}
                step={scenarioType === "speed_restriction" ? 5 : 5}
                value={magnitude}
                onChange={e => setMagnitude(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-2xl font-bold text-xs transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {isSimulating ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Simulating Headway & Cascading Delays...
              </>
            ) : (
              <>
                <Play size={15} />
                Execute What-If Shock Simulation
              </>
            )}
          </button>
        </div>

        {/* Right Column: Comparison Matrix & Mitigation Results (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {!simulationResult ? (
            <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center min-h-[460px]">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Zap size={28} />
              </div>
              <h4 className="text-base font-black text-slate-800">No Simulation Active</h4>
              <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                Configure your incident parameters on the left and click <strong>Execute What-If Shock Simulation</strong> to observe how delays propagate across the network and how AI dynamic replanning eliminates bottlenecks.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              {/* Scenario Context Banner */}
              <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                    Active What-If Scenario
                  </span>
                  <h4 className="text-base font-black text-white mt-0.5">
                    {simulationResult.scenario.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {simulationResult.scenario.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
                    Confidence: {simulationResult.ai_mitigation_plan.confidence_score}%
                  </span>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
                    Safety Gate: {simulationResult.ai_mitigation_plan.safety_gate}
                  </span>
                </div>
              </div>

              {/* Comparative Metrics (Baseline vs Unmitigated vs AI Mitigated) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Baseline */}
                <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Baseline Timetable</span>
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2">0 min</div>
                  <div className="text-xs font-bold text-emerald-600 mt-1">95.2% Punctuality</div>
                  <div className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
                    Normal planned operating conditions
                  </div>
                </div>

                {/* 2. Unmitigated Shock */}
                <div className="bg-red-50/70 border border-red-200 p-4 rounded-3xl shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-red-600 uppercase">Unmitigated Shock</span>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  </div>
                  <div className="text-2xl font-black text-red-900 mt-2">
                    +{simulationResult.metrics_comparison.unmitigated_shock.total_delay_minutes} min
                  </div>
                  <div className="text-xs font-bold text-red-600 mt-1">
                    {simulationResult.metrics_comparison.unmitigated_shock.punctuality_pct}% Punctuality (
                    {simulationResult.metrics_comparison.unmitigated_shock.impacted_trains} trains held)
                  </div>
                  <div className="text-[10px] text-red-700 mt-2 pt-2 border-t border-red-200/60">
                    Headway cascade across follow-on paths
                  </div>
                </div>

                {/* 3. AI Dynamic Mitigated */}
                <div className="bg-emerald-50/80 border-2 border-emerald-300 p-4 rounded-3xl shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-emerald-700 uppercase flex items-center gap-1">
                      <Sparkles size={12} />
                      AI Dynamic Replanned
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-emerald-950 mt-2">
                    +{simulationResult.metrics_comparison.ai_mitigated.total_delay_minutes} min
                  </div>
                  <div className="text-xs font-bold text-emerald-700 mt-1">
                    {simulationResult.metrics_comparison.ai_mitigated.punctuality_pct}% Punctuality (
                    -{simulationResult.metrics_comparison.ai_mitigated.delay_saved_minutes}m Saved)
                  </div>
                  <div className="text-[10px] font-bold text-emerald-800 mt-2 pt-2 border-t border-emerald-200">
                    {simulationResult.metrics_comparison.ai_mitigated.recovery_efficiency_pct}% Recovery Efficiency
                  </div>
                </div>
              </div>

              {/* AI Dispatch Mitigation Orders */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    AI Dynamic Dispatch Instructions ({simulationResult.ai_mitigation_plan.strategy_title})
                  </h4>
                  <button
                    onClick={() => setAppliedMitigation(true)}
                    disabled={appliedMitigation}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-xs transition-all ${
                      appliedMitigation 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                    }`}
                  >
                    {appliedMitigation ? (
                      <>
                        <CheckCircle2 size={13} />
                        Mitigation Implemented
                      </>
                    ) : (
                      <>
                        <Zap size={13} />
                        Apply Mitigation to Live Twin
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  {simulationResult.ai_mitigation_plan.dispatch_orders.map((order, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                        {idx + 1}
                      </div>
                      <span className="leading-snug">{order}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Train-by-Train Impact Comparison Table */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Train-by-Train Impact & Recovery Analysis
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="pb-2">Train</th>
                        <th className="pb-2">Scheduled</th>
                        <th className="pb-2">Unmitigated Delay</th>
                        <th className="pb-2">AI Mitigated Delay</th>
                        <th className="pb-2">Delay Saved</th>
                        <th className="pb-2">AI Dispatch Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {simulationResult.train_schedule_comparison.mitigated.map((t, idx) => {
                        const unmit = simulationResult.train_schedule_comparison.unmitigated[idx];
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3">
                              <div className="font-bold text-slate-900">{t.name}</div>
                              <span className="text-[10px] text-slate-400 font-mono">#{t.train_number} · {t.type}</span>
                            </td>
                            <td className="py-3 font-mono text-slate-600 font-semibold">{t.scheduled_time}</td>
                            <td className="py-3">
                              {unmit.delay_minutes > 0 ? (
                                <span className="font-mono font-bold text-red-600">+{unmit.delay_minutes} min</span>
                              ) : (
                                <span className="font-mono text-slate-400">0 min</span>
                              )}
                            </td>
                            <td className="py-3">
                              {t.mitigated_delay > 0 ? (
                                <span className="font-mono font-bold text-amber-600">+{t.mitigated_delay} min</span>
                              ) : (
                                <span className="font-mono font-bold text-emerald-600">On Time</span>
                              )}
                            </td>
                            <td className="py-3">
                              {t.delay_saved > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono text-[10px]">
                                  -{t.delay_saved}m
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono">—</span>
                              )}
                            </td>
                            <td className="py-3 text-slate-600 text-[11px] leading-snug">
                              {t.dispatch_instruction}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
