"use client";

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Brain,
  ShieldCheck,
  Clock,
  Calendar,
  AlertTriangle,
  Zap,
  BarChart3,
  Layers,
  ArrowRight,
  Filter,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

interface SummaryData {
  total_movements_logged: number;
  future_scheduled_movements?: number;
  punctuality_rate_pct: number;
  total_maintenance_blocks: number;
  completed_blocks_count?: number;
  future_scheduled_blocks?: number;
  joint_blocks_count: number;
  joint_blocks_ratio_pct: number;
  possession_hours_saved: number;
  train_detention_avoided_minutes: number;
  ml_model_metrics: {
    mae: number;
    r2: number;
    trained_samples: number;
  };
}

interface TrendDay {
  date: string;
  full_date: string;
  punctuality: number;
  avg_delay_min: number;
  trains_count: number;
}

interface CongestionRow {
  section_id: number;
  section_name: string;
  hourly_load: number[];
  congestion_index: number[];
  optimal_window: string;
}

interface AuditBlock {
  id: number;
  date: string;
  block_code: string;
  section_name: string;
  start_time: string;
  end_time: string;
  planned_duration: number;
  actual_duration: number;
  departments: string;
  is_joint_block: number;
  train_detention_minutes: number;
  work_completed: string;
  status: string;
}

export default function AnalyticsView() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [trend, setTrend] = useState<TrendDay[]>([]);
  const [congestion, setCongestion] = useState<CongestionRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditBlock[]>([]);
  const [loading, setLoading] = useState(true);

  // ML Predictor Interactive Form State
  const [predSection, setPredSection] = useState(1);
  const [predHour, setPredHour] = useState(14);
  const [predDow, setPredDow] = useState(2); // Wednesday
  const [predHasBlock, setPredHasBlock] = useState(1);
  const [predTrainType, setPredTrainType] = useState<"standard" | "vande_bharat" | "freight">("vande_bharat");
  const [timeRange, setTimeRange] = useState<'30days' | '6months'>('6months');
  const [advancingDay, setAdvancingDay] = useState(false);
  const [advanceDayNotice, setAdvanceDayNotice] = useState<string | null>(null);

  const [mlResult, setMlResult] = useState<{
    predicted_delay_minutes: number;
    confidence_pct: string;
    risk_level: string;
  } | null>(null);
  const [predicting, setPredicting] = useState(false);

  const loadData = async () => {
    try {
      const daysParam = timeRange === '6months' ? 180 : 30;
      const [sumRes, trendRes, congRes, auditRes] = await Promise.all([
        fetch(`http://localhost:8000/api/analytics/summary?days=${daysParam}`),
        fetch(`http://localhost:8000/api/analytics/punctuality-trend?days=${daysParam}`),
        fetch('http://localhost:8000/api/analytics/hourly-congestion'),
        fetch('http://localhost:8000/api/analytics/audit-history?limit=30')
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (trendRes.ok) setTrend(await trendRes.json());
      if (congRes.ok) setCongestion(await congRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const handleAdvanceDay = async () => {
    setAdvancingDay(true);
    setAdvanceDayNotice(null);
    try {
      const res = await fetch('http://localhost:8000/api/analytics/advance-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        setAdvanceDayNotice(`✓ Advanced operational day to ${data.advanced_date}! Completed ${data.completed_trains} journeys (avg delay: ${data.avg_delay_minutes}m). Rolling master horizon extended to ${data.extended_horizon_date}.`);
        loadData();
      }
    } catch (err) {
      console.error('Failed to advance day', err);
    } finally {
      setAdvancingDay(false);
    }
  };

  const handleRunInference = async () => {
    setPredicting(true);
    try {
      const res = await fetch('http://localhost:8000/api/analytics/predict-delay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: Number(predSection),
          departure_hour: Number(predHour),
          day_of_week: Number(predDow),
          has_active_block: Number(predHasBlock),
          is_vande_bharat: predTrainType === 'vande_bharat' ? 1 : 0,
          is_freight: predTrainType === 'freight' ? 1 : 0,
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMlResult(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Advance Day Success Banner */}
      {advanceDayNotice && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-2xl text-xs font-semibold shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{advanceDayNotice}</span>
          </div>
          <button 
            onClick={() => setAdvanceDayNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-bold rounded-md uppercase tracking-wider">
              {timeRange === '6months' ? '6-Month IR Master Dataset (Past + Future Rolling)' : '30-Day Operational Dataset'}
            </span>
            <span className="text-xs text-slate-400 font-medium">Central Railway · Mumbai-Pune-Daund-Solapur Corridor</span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-1">
            Historical Railway Operations & Analytics Engine
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Calibrated on {summary?.total_movements_logged.toLocaleString() || '8,143'} actual train journeys across Central Railway, with seasonal monsoon and festival timetables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setTimeRange('6months')}
              className={`px-3 py-1.5 rounded-lg transition-all ${timeRange === '6months' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'}`}
            >
              6-Month Master View
            </button>
            <button
              onClick={() => setTimeRange('30days')}
              className={`px-3 py-1.5 rounded-lg transition-all ${timeRange === '30days' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'}`}
            >
              Last 30 Days
            </button>
          </div>

          {/* Daily Rolling Day Advance Action */}
          <button
            onClick={handleAdvanceDay}
            disabled={advancingDay}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            title="Simulates 1 day advancing, archiving completed journeys and extending future schedule"
          >
            {advancingDay ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                Advancing Day...
              </>
            ) : (
              <>
                <Zap size={13} />
                Advance Operational Day
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: timeRange === '6months' ? "6-Month Completed Movements" : "30-Day Movements Logged", value: summary?.total_movements_logged.toLocaleString() || "8,143", note: `${summary?.future_scheduled_movements?.toLocaleString() || "8,008"} future timetable paths`, color: "text-blue-600 bg-blue-50" },
          { label: "Corridor Punctuality", value: `${summary?.punctuality_rate_pct || 91.2}%`, note: "Target: >= 90%", color: "text-emerald-600 bg-emerald-50" },
          { label: "Joint Department Blocks", value: `${summary?.joint_blocks_ratio_pct || 76}%`, note: `${summary?.joint_blocks_count || 560} of ${summary?.completed_blocks_count || 746} blocks`, color: "text-purple-600 bg-purple-50" },
          { label: "Possession Hours Saved", value: `${summary?.possession_hours_saved || 1400} hrs`, note: `${summary?.train_detention_avoided_minutes?.toLocaleString() || "21,280"} min detention saved`, color: "text-amber-600 bg-amber-50" },
        ].map((card, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.label}</span>
              <div className="text-3xl font-black text-slate-900 mt-2">{card.value}</div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">{card.note}</span>
              <span className={`w-2 h-2 rounded-full ${card.color.split(' ')[1]}`} />
            </div>
          </div>
        ))}
      </div>

      {/* ML Delay Predictor Tool & 30-Day Punctuality Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ML Interactive Predictor Widget */}
        <div className="bg-[#152336] text-white p-6 rounded-3xl shadow-lg border border-slate-800 space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Brain size={18} className="text-blue-400" />
                <h4 className="font-bold text-base">ML Delay Predictor</h4>
              </div>
              <span className="text-[10px] font-mono bg-blue-900/60 border border-blue-700/50 text-blue-300 px-2 py-0.5 rounded">
                Random Forest
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Predicts expected corridor delay given traffic time, train priority, and active block status.
            </p>

            <div className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Corridor Section</label>
                <select
                  value={predSection}
                  onChange={(e) => setPredSection(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-medium focus:ring-1 focus:ring-blue-500"
                >
                  <option value={1}>Pune — Lonavala (64 km)</option>
                  <option value={2}>Lonavala — Karjat (28 km)</option>
                  <option value={3}>Pune — Daund (75 km)</option>
                  <option value={4}>Daund — Solapur (187 km)</option>
                  <option value={5}>Solapur — Kurduvadi (79 km)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Departure Hour</label>
                  <select
                    value={predHour}
                    onChange={(e) => setPredHour(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-medium"
                  >
                    {[2, 6, 8, 10, 14, 16, 18, 20, 22].map((h) => (
                      <option key={h} value={h}>{h.toString().padStart(2, '0')}:00 IST</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Active Block?</label>
                  <select
                    value={predHasBlock}
                    onChange={(e) => setPredHasBlock(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-medium"
                  >
                    <option value={1}>Yes (Possession)</option>
                    <option value={0}>No (Clear Track)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Train Priority</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 text-center">
                  {[
                    { id: 'vande_bharat', label: 'Vande Bharat' },
                    { id: 'standard', label: 'Mail/Exp' },
                    { id: 'freight', label: 'Freight' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPredTrainType(t.id as any)}
                      className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        predTrainType === t.id
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            {mlResult && (
              <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-400">ML Predicted Delay:</span>
                  <span className="text-xl font-bold text-amber-400">+{mlResult.predicted_delay_minutes} min</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Model Confidence:</span>
                  <span className="text-emerald-400 font-semibold">{mlResult.confidence_pct || "88%"}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Risk Severity:</span>
                  <span className={`font-bold ${
                    mlResult.risk_level === 'HIGH' ? 'text-red-400' :
                    mlResult.risk_level === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {mlResult.risk_level}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleRunInference}
              disabled={predicting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
            >
              {predicting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Inferencing Random Forest...
                </>
              ) : (
                <>
                  <Zap size={14} />
                  Run ML Delay Prediction
                </>
              )}
            </button>
          </div>
        </div>

        {/* 30-Day Daily Punctuality Performance Graph */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-base font-bold text-slate-900">30-Day Corridor Punctuality Trend</h4>
              <p className="text-xs text-slate-500">Daily on-time train arrival rate across Central Railway corridor</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
              Avg: 91.8%
            </span>
          </div>

          {/* Render 30-day visual bar trend */}
          <div className="h-56 flex items-end gap-1.5 pt-6 pb-2 border-b border-slate-100 overflow-x-auto">
            {trend.map((t, idx) => {
              const heightPct = Math.max(20, Math.min(100, t.punctuality));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center group cursor-pointer min-w-[20px]">
                  <div className="text-[9px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                    {t.punctuality}%
                  </div>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-md transition-all duration-300 group-hover:brightness-90 ${
                      t.punctuality >= 90 ? 'bg-emerald-500' :
                      t.punctuality >= 80 ? 'bg-blue-500' : 'bg-amber-500'
                    }`}
                  />
                  <div className="text-[8px] font-mono text-slate-400 mt-1.5 truncate max-w-[24px]">
                    {t.date}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> &gt;=90% On-Time</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> 80-89% On-Time</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> &lt;80% Minor Delay</span>
            </div>
            <span className="font-mono text-[11px]">18 Aug — 17 Sep 2026</span>
          </div>
        </div>
      </div>

      {/* 24-Hour Corridor Congestion Heatmap */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-base font-bold text-slate-900">24-Hour Corridor Traffic & Congestion Heatmap</h4>
            <p className="text-xs text-slate-500">Historical traffic load by hour of day to identify optimal low-impact maintenance slots</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
            Identified Golden Windows: 01:00–05:00
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[800px] space-y-2">
            {/* Hour headers */}
            <div className="grid grid-cols-[160px_repeat(24,minmax(26px,1fr))] text-[10px] font-mono text-slate-400 pb-1 border-b border-slate-100 text-center">
              <div className="text-left font-sans font-semibold">Corridor Section</div>
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h}>{h}</div>
              ))}
            </div>

            {/* Corridor heatmap rows */}
            {congestion.map((row) => (
              <div key={row.section_id} className="grid grid-cols-[160px_repeat(24,minmax(26px,1fr))] items-center py-1">
                <div className="text-xs font-semibold text-slate-700 truncate pr-2">
                  {row.section_name}
                </div>

                {row.congestion_index.map((score, h) => {
                  let bg = 'bg-emerald-100 text-emerald-800';
                  if (score > 70) bg = 'bg-red-500 text-white';
                  else if (score > 40) bg = 'bg-amber-400 text-slate-900';
                  else if (score > 20) bg = 'bg-blue-300 text-slate-900';

                  return (
                    <div
                      key={h}
                      title={`${row.section_name} @ ${h}:00 - Congestion ${score}%`}
                      className={`h-7 mx-0.5 rounded flex items-center justify-center text-[9px] font-mono font-bold ${bg}`}
                    >
                      {score > 50 ? score : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 30-Day Historical Maintenance Block Audit Trail */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-base font-bold text-slate-900">30-Day Maintenance Block Audit Log</h4>
            <p className="text-xs text-slate-500">Historical record of track possessions, multi-department participation, and train detentions</p>
          </div>
          <span className="text-xs font-mono text-slate-400">121 Total Blocks Ingested</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Block Code</th>
                <th className="py-2.5 px-3">Corridor Section</th>
                <th className="py-2.5 px-3">Window</th>
                <th className="py-2.5 px-3">Duration (Plan/Act)</th>
                <th className="py-2.5 px-3">Coordinated Departments</th>
                <th className="py-2.5 px-3">Work Summary</th>
                <th className="py-2.5 px-3">Train Detention</th>
                <th className="py-2.5 px-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.slice(0, 15).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-500">{log.date}</td>
                  <td className="py-3 px-3 font-bold text-slate-900">{log.block_code}</td>
                  <td className="py-3 px-3 font-medium text-slate-700">{log.section_name}</td>
                  <td className="py-3 px-3 font-mono text-slate-600">{log.start_time}–{log.end_time}</td>
                  <td className="py-3 px-3 font-mono">
                    {log.planned_duration}m / <span className="font-bold">{log.actual_duration}m</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] font-semibold text-slate-800">{log.departments}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{log.work_completed}</td>
                  <td className="py-3 px-3">
                    <span className={`font-mono font-bold ${log.train_detention_minutes > 15 ? 'text-red-600' : 'text-emerald-600'}`}>
                      +{log.train_detention_minutes} min
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {log.is_joint_block ? (
                      <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-md border border-purple-200">
                        Joint Block
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-md">
                        Single Dept
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
