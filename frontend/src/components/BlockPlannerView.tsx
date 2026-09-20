"use client";

import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle2, AlertTriangle, Layers, ArrowRight, ShieldCheck } from 'lucide-react';

interface CorridorBlock {
  id: string;
  code: string;
  corridor: string;
  startTime: string;
  endTime: string;
  duration: string;
  departments: string[];
  status: 'OPTIMIZED' | 'APPROVED' | 'CONFLICT';
  trainDelay: string;
  score: number;
}

const SAMPLE_BLOCKS: CorridorBlock[] = [
  {
    id: '1',
    code: 'BLOCK-A17',
    corridor: 'Pune — Lonavala',
    startTime: '02:00',
    endTime: '05:00',
    duration: '180 min',
    departments: ['Track / Engg', 'OHE / Traction', 'S&T Signalling'],
    status: 'OPTIMIZED',
    trainDelay: '8 min',
    score: 97,
  },
  {
    id: '2',
    code: 'BLOCK-B04',
    corridor: 'Lonavala — Karjat',
    startTime: '11:30',
    endTime: '13:00',
    duration: '90 min',
    departments: ['OHE / Traction'],
    status: 'APPROVED',
    trainDelay: '0 min',
    score: 91,
  },
  {
    id: '3',
    code: 'BLOCK-C12',
    corridor: 'Daund — Solapur',
    startTime: '14:00',
    endTime: '16:30',
    duration: '150 min',
    departments: ['Track / Engg', 'S&T Signalling'],
    status: 'CONFLICT',
    trainDelay: '35 min (High)',
    score: 64,
  },
  {
    id: '4',
    code: 'BLOCK-D08',
    corridor: 'Solapur — Kurduvadi',
    startTime: '23:30',
    endTime: '02:00',
    duration: '150 min',
    departments: ['Track / Engg'],
    status: 'OPTIMIZED',
    trainDelay: '4 min',
    score: 94,
  },
];

const TIME_SLOTS = [
  "00:00", "02:00", "04:00", "06:00", "08:00", "10:00",
  "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"
];

export default function BlockPlannerView() {
  const [selectedBlock, setSelectedBlock] = useState<CorridorBlock>(SAMPLE_BLOCKS[0]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Integrated Corridor Block Planner</h3>
          <p className="text-sm text-slate-500 mt-0.5">Multi-department window synthesis & timetable de-confliction</p>
        </div>
        <div className="flex gap-3">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl border border-blue-200">
            <Layers size={14} />
            3 Multi-Dept Blocks
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200">
            <ShieldCheck size={14} />
            CP-SAT Optimized
          </span>
        </div>
      </div>

      {/* Corridor Timeline / Gantt */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
        <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          24-Hour Corridor Maintenance Windows
        </h4>

        <div className="min-w-[760px]">
          {/* Time axis */}
          <div className="grid grid-cols-12 text-[11px] font-mono text-slate-400 pb-3 border-b border-slate-100 text-center">
            {TIME_SLOTS.map((t, idx) => (
              <div key={idx}>{t}</div>
            ))}
          </div>

          {/* Corridor Rows */}
          <div className="space-y-4 pt-4">
            {[
              { corridor: "Pune — Lonavala", left: "8.3%", width: "12.5%", block: SAMPLE_BLOCKS[0] },
              { corridor: "Lonavala — Karjat", left: "47.9%", width: "6.2%", block: SAMPLE_BLOCKS[1] },
              { corridor: "Daund — Solapur", left: "58.3%", width: "10.4%", block: SAMPLE_BLOCKS[2] },
              { corridor: "Solapur — Kurduvadi", left: "97.9%", width: "10.4%", block: SAMPLE_BLOCKS[3] },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="w-36 text-xs font-semibold text-slate-700 shrink-0 truncate">
                  {row.corridor}
                </span>
                <div className="flex-1 h-9 bg-slate-50 rounded-xl relative border border-slate-100 overflow-hidden">
                  <div
                    onClick={() => setSelectedBlock(row.block)}
                    style={{ left: row.left, width: row.width }}
                    className={`absolute top-1 bottom-1 rounded-lg px-2 flex items-center justify-between text-[10px] font-bold cursor-pointer transition-all shadow-sm ${
                      row.block.status === 'CONFLICT'
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : row.block.status === 'APPROVED'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <span className="truncate">{row.block.code}</span>
                    <span className="opacity-90">{row.block.startTime}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Block Details & Multi-Dept Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-start border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-mono text-blue-600 font-bold tracking-wider uppercase">Active Selection</span>
              <h4 className="text-2xl font-bold text-slate-900 mt-1">{selectedBlock.code} · {selectedBlock.corridor}</h4>
              <p className="text-xs text-slate-500 mt-0.5">Scheduled Slot: {selectedBlock.startTime} — {selectedBlock.endTime} ({selectedBlock.duration})</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              selectedBlock.status === 'CONFLICT' ? 'bg-red-100 text-red-700' :
              selectedBlock.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {selectedBlock.status}
            </div>
          </div>

          <div>
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Integrated Multi-Department Coordination
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {selectedBlock.departments.map((dept, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block mr-2" />
                  <span className="text-xs font-bold text-slate-800">{dept}</span>
                  <p className="text-[11px] text-slate-500 mt-1">Simultaneous access granted. Traction isolation synchronized.</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Score & Impact Panel */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-md flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold tracking-wider text-blue-300 uppercase">Optimization Index</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-bold">{selectedBlock.score}</span>
              <span className="text-slate-400 text-sm">/ 100</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Formulated via OR-Tools CP-SAT multi-constraint solver.</p>

            <div className="space-y-3 text-xs mt-6 border-t border-slate-800 pt-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Train Delay:</span>
                <span className="font-semibold text-white">{selectedBlock.trainDelay}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Safety Verification:</span>
                <span className="font-semibold text-emerald-400">Rules Validated</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Resource Clashes:</span>
                <span className="font-semibold text-white">0 Detected</span>
              </div>
            </div>
          </div>

          <button className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors">
            Transmit Block Order to PRS/NTES
          </button>
        </div>
      </div>
    </div>
  );
}
