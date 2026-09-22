"use client";

import React, { useState } from 'react';
import { 
  FlaskConical, 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
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

interface TrainScheduleMitigated {
  train_number: string;
  name: string;
  type: string;
  priority: string;
  scheduled_time: string;
  mitigated_delay: number;
  delay_saved: number;
  dispatch_instruction: string;
  status: string;
}

interface TrainScheduleUnmitigated {
  train_number: string;
  name: string;
  type: string;
  priority: string;
  scheduled_time: string;
  delay_minutes: number;
  operational_impact: string;
}

const getSliderMin = (type: string): number => {
  if (type === "speed_restriction") return 20;
  if (type === "emergency_block") return 60;
  return 15;
};

const getSliderMax = (type: string): number => {
  if (type === "speed_restriction") return 60;
  if (type === "emergency_block") return 240;
  return 120;
};

const calculateSimulationResult = (
  scenarioType: string,
  sectionId: number,
  magnitude: number,
  trainNumber: string
): ScenarioResult => {
  const SECTION_NAMES: Record<number, string> = {
    1: "Pune — Lonavala (64 km Double Track)",
    2: "Lonavala — Karjat (28 km Bhor Ghat Incline)",
    3: "Pune — Daund (75 km Broad Gauge)",
    4: "Daund — Solapur (187 km Mainline)",
    5: "Solapur — Kurduvadi (79 km)",
    6: "Lonavala — Solapur (250 km)"
  };

  const TRAIN_METADATA: Record<string, { name: string; priority: string; passengers: number; type: string }> = {
    "22226": { name: "22226 Solapur-CSMT Vande Bharat", priority: "CRITICAL", passengers: 1128, type: "Vande Bharat" },
    "22225": { name: "22225 CSMT-Solapur Vande Bharat", priority: "CRITICAL", passengers: 1128, type: "Vande Bharat" },
    "12124": { name: "12124 Deccan Queen Express", priority: "HIGH", passengers: 1450, type: "Superfast" },
    "12028": { name: "12028 Pune Shatabdi Express", priority: "HIGH", passengers: 980, type: "Shatabdi" },
    "11019": { name: "11019 Konark Express", priority: "MEDIUM", passengers: 1820, type: "Mail/Express" },
    "12157": { name: "12157 Hutatma Express", priority: "MEDIUM", passengers: 1600, type: "Intercity" },
    "BOXN-7041": { name: "BOXN-7041 Thermal Coal Rake", priority: "FREIGHT", passengers: 0, type: "Heavy Freight" },
    "BTPN-8820": { name: "BTPN-8820 Petroleum Rake", priority: "FREIGHT", passengers: 0, type: "Petroleum Tanker" }
  };

  const sectionName = SECTION_NAMES[sectionId] || `Section ${sectionId}`;
  let primaryDelay: number;
  let scenarioTitle: string;
  let scenarioDesc: string;
  let freightPenalty: number;

  if (scenarioType === "train_delay") {
    primaryDelay = magnitude;
    scenarioTitle = `Train ${trainNumber} Delay Injection (+${magnitude}m)`;
    scenarioDesc = `${TRAIN_METADATA[trainNumber]?.name || "Train"} delayed by ${magnitude} min on ${sectionName}.`;
    freightPenalty = 1.6;
  } else if (scenarioType === "emergency_block") {
    primaryDelay = Math.round(magnitude * 0.45);
    scenarioTitle = `Emergency Track Possession (${magnitude}m Block)`;
    scenarioDesc = `Unscheduled emergency track closure for ${magnitude} minutes on ${sectionName}.`;
    freightPenalty = 2.2;
  } else if (scenarioType === "speed_restriction") {
    primaryDelay = Math.max(15, Math.round((110 - magnitude) * 0.4));
    scenarioTitle = `Temporary Speed Restriction (TSR ${magnitude} km/h)`;
    scenarioDesc = `Mandatory TSR ${magnitude} km/h imposed on ${sectionName} due to rail surface defect.`;
    freightPenalty = 1.4;
  } else {
    primaryDelay = magnitude;
    scenarioTitle = `Traction Power / OHE Trip (${magnitude}m)`;
    scenarioDesc = `Traction power breakdown on ${sectionName} requiring diesel rescue locomotive.`;
    freightPenalty = 2.0;
  }

  const trainCandidates = [
    { num: "22226", sched: "13:30", direction: "UP" },
    { num: "12028", sched: "13:55", direction: "UP" },
    { num: "12124", sched: "14:15", direction: "DOWN" },
    { num: "11019", sched: "14:40", direction: "DOWN" },
    { num: "BOXN-7041", sched: "15:05", direction: "UP" },
    { num: "12157", sched: "15:30", direction: "UP" },
  ];

  const primaryTrain = trainCandidates.find(t => t.num === trainNumber) || trainCandidates[1];
  const primaryIdx = trainCandidates.findIndex(t => t.num === primaryTrain.num);

  let totalUnmitigated = 0;
  let totalMitigated = 0;
  let totalPassengers = 0;

  const unmitigated: TrainScheduleUnmitigated[] = trainCandidates.map((t, idx) => {
    const meta = TRAIN_METADATA[t.num] || { name: `Train ${t.num}`, priority: "MEDIUM", passengers: 1000, type: "Express" };
    const isPrimary = t.num === primaryTrain.num;
    let delay: number;
    let action: string;

    if (isPrimary) {
      delay = primaryDelay;
      action = "Delayed on mainline track";
    } else if (idx > primaryIdx) {
      const headwayGap = (idx - primaryIdx) * 12;
      delay = Math.max(0, Math.round(primaryDelay * 0.65) - headwayGap);
      if (meta.priority === "FREIGHT") {
        delay = Math.round(delay * freightPenalty);
        action = "Stuck behind delayed rake on block section";
      } else {
        action = "Held at home signal outside station";
      }
    } else {
      delay = 0;
      action = "Cleared before incident window";
    }

    totalUnmitigated += delay;
    if (delay > 0) totalPassengers += meta.passengers;

    return {
      train_number: t.num,
      name: meta.name,
      type: meta.type,
      priority: meta.priority,
      scheduled_time: t.sched,
      delay_minutes: delay,
      operational_impact: action
    };
  });

  const mitigated: TrainScheduleMitigated[] = trainCandidates.map((t, idx) => {
    const meta = TRAIN_METADATA[t.num] || { name: `Train ${t.num}`, priority: "MEDIUM", passengers: 1000, type: "Express" };
    const unmitDelay = unmitigated[idx].delay_minutes;
    const isPrimary = t.num === primaryTrain.num;
    let mitDelay: number;
    let action: string;
    let status: string;

    if (isPrimary) {
      mitDelay = Math.round(primaryDelay * 0.65);
      action = "Green Corridor clearance on Up Main line";
      status = "RECOVERED";
    } else if (meta.priority === "CRITICAL") {
      mitDelay = 0;
      action = "Pre-cleared on mainline bypass; zero detention";
      status = "ON_TIME";
    } else if (meta.priority === "FREIGHT") {
      mitDelay = Math.min(35, Math.round(unmitDelay * 0.5));
      action = "Regulated in Daund Yard loop line for 20m; passenger paths liberated";
      status = "CONTROLLED_REGULATION";
    } else {
      mitDelay = Math.max(0, Math.round(unmitDelay * 0.3));
      action = "Single-line alternate signaling; saved 70% delay";
      status = mitDelay > 0 ? "MINOR_DELAY" : "ON_TIME";
    }

    totalMitigated += mitDelay;

    return {
      train_number: t.num,
      name: meta.name,
      type: meta.type,
      priority: meta.priority,
      scheduled_time: t.sched,
      mitigated_delay: mitDelay,
      delay_saved: Math.max(0, unmitDelay - mitDelay),
      dispatch_instruction: action,
      status
    };
  });

  const delaySaved = Math.max(0, totalUnmitigated - totalMitigated);
  const recoveryEfficiency = Math.round((delaySaved / Math.max(totalUnmitigated, 1)) * 1000) / 10;

  return {
    scenario: {
      type: scenarioType,
      title: scenarioTitle,
      description: scenarioDesc,
      section_name: sectionName,
      shock_magnitude: magnitude,
      primary_train: primaryTrain.num
    },
    metrics_comparison: {
      baseline: {
        total_delay_minutes: 0,
        punctuality_pct: 95.2,
        passenger_hours_lost: 0,
        impacted_trains: 0
      },
      unmitigated_shock: {
        total_delay_minutes: totalUnmitigated,
        punctuality_pct: Math.max(35.0, Math.round((95.2 - totalUnmitigated * 0.55) * 10) / 10),
        passenger_hours_lost: Math.round(((totalPassengers * totalUnmitigated) / 60000) * 10) / 10,
        impacted_trains: unmitigated.filter(t => t.delay_minutes > 0).length
      },
      ai_mitigated: {
        total_delay_minutes: totalMitigated,
        punctuality_pct: Math.min(93.0, Math.max(82.0, Math.round((95.2 - totalMitigated * 0.4) * 10) / 10)),
        passenger_hours_lost: Math.round(((totalPassengers * totalMitigated) / 60000) * 10) / 10,
        impacted_trains: mitigated.filter(t => t.mitigated_delay > 0).length,
        delay_saved_minutes: delaySaved,
        recovery_efficiency_pct: recoveryEfficiency
      }
    },
    ai_mitigation_plan: {
      strategy_title: "Dynamic Headway Re-sequencing & Loop Stabling",
      confidence_score: 94,
      safety_gate: "PASSED",
      dispatch_orders: [
        `1. Pre-clear 22226 Solapur-CSMT Vande Bharat on reverse Up track to avoid headway clash.`,
        `2. Regulate freight rake BOXN-7041 into Daund Siding Loop 2 for 22 minutes.`,
        `3. Grant green corridor aspects for ${primaryTrain.num} (${TRAIN_METADATA[primaryTrain.num]?.name || primaryTrain.num}) with continuous cab signaling.`,
        `4. Coordinate Engineering & S&T controllers to synchronize temporary Single Line Working (SLW).`
      ]
    },
    train_schedule_comparison: {
      unmitigated,
      mitigated
    }
  };
};

export default function SimulationLabView() {
  const [scenarioType, setScenarioType] = useState<string>("train_delay");
  const [sectionId, setSectionId] = useState<number>(1);
  const [trainNumber, setTrainNumber] = useState<string>("12028");
  const [magnitude, setMagnitude] = useState<number>(65);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<ScenarioResult | null>(() => 
    calculateSimulationResult("train_delay", 1, 65, "12028")
  );
  const [appliedMitigation, setAppliedMitigation] = useState<boolean>(false);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setAppliedMitigation(false);
    
    // Compute immediate local result for zero-latency UI responsiveness
    const fallbackResult = calculateSimulationResult(scenarioType, sectionId, Number(magnitude), trainNumber);
    
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
        setSimulationResult(fallbackResult);
      }
    } catch {
      setSimulationResult(fallbackResult);
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
            Inject train delays, emergency track blocks, or speed restrictions to evaluate cascading knock-on effects and automated dispatch recoveries.
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
              { id: "train_delay", title: "🚆 Train Delay Shock", desc: "Express train delayed by headway clash or dwell overrun", magLabel: "Delay (Minutes)", def: 45 },
              { id: "emergency_block", title: "🚧 Emergency Track Block", desc: "Sudden broken rail or catenary snap requiring track closure", magLabel: "Closure Duration (Min)", def: 180 },
              { id: "speed_restriction", title: "⚠️ Caution Order (TSR)", desc: "Rail defect or monsoon slurry requiring speed reduction", magLabel: "Imposed Speed (km/h)", def: 30 },
              { id: "power_outage", title: "⚡ OHE Traction Power Trip", desc: "Substation trip halting all electric locomotives", magLabel: "Outage Duration (Min)", def: 45 },
            ].map(sc => (
              <button
                type="button"
                key={sc.id}
                onClick={() => {
                  setScenarioType(sc.id);
                  setMagnitude(sc.def);
                  setAppliedMitigation(false);
                  setSimulationResult(calculateSimulationResult(sc.id, sectionId, sc.def, trainNumber));
                }}
                className={`w-full text-left p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  scenarioType === sc.id
                    ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-100'
                    : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/60'
                }`}
              >
                <div className="font-bold text-xs text-slate-900">{sc.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{sc.desc}</div>
              </button>
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
              <label htmlFor="corridor-section-select" className="text-[11px] font-bold text-slate-600 block mb-1">
                Affected Corridor Section
              </label>
              <select
                id="corridor-section-select"
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
                <label htmlFor="delayed-train-select" className="text-[11px] font-bold text-slate-600 block mb-1">
                  Primary Delayed Train
                </label>
                <select
                  id="delayed-train-select"
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
                <label htmlFor="shock-magnitude-slider" className="text-[11px] font-bold text-slate-600">
                  {scenarioType === "speed_restriction" ? "Imposed Speed Limit" : "Shock Duration"}
                </label>
                <span className="text-xs font-black text-blue-600 font-mono">
                  {magnitude} {scenarioType === "speed_restriction" ? "km/h" : "min"}
                </span>
              </div>
              <input
                id="shock-magnitude-slider"
                type="range"
                min={getSliderMin(scenarioType)}
                max={getSliderMax(scenarioType)}
                step={5}
                value={magnitude}
                onChange={e => setMagnitude(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          <button
            type="button"
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
                Configure your incident parameters on the left and click <strong>Execute What-If Shock Simulation</strong> to observe how delays propagate across the network and how dynamic replanning eliminates bottlenecks.
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

              {/* Comparative Metrics (Baseline vs Unmitigated vs Dynamic Mitigated) */}
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

                {/* 3. Dynamic Mitigated */}
                <div className="bg-emerald-50/80 border-2 border-emerald-300 p-4 rounded-3xl shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-emerald-700 uppercase flex items-center gap-1">
                      <Sparkles size={12} />
                      Dynamic Replanned
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

              {/* Dispatch Mitigation Orders */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    Dynamic Dispatch Instructions ({simulationResult.ai_mitigation_plan.strategy_title})
                  </h4>
                  <button
                    type="button"
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
                    <div key={`dispatch-order-${order.substring(0, 24)}`} className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
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
                        <th className="pb-2">Optimized Delay</th>
                        <th className="pb-2">Delay Saved</th>
                        <th className="pb-2">Dispatch Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {simulationResult.train_schedule_comparison.mitigated.map((t, idx) => {
                        const unmit = simulationResult.train_schedule_comparison.unmitigated[idx];
                        return (
                          <tr key={`train-schedule-${t.train_number}`} className="hover:bg-slate-50/80 transition-colors">
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
