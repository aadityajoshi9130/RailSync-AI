"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Position,
  Handle,
  NodeProps,
  Background,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TrainFront, RotateCcw, AlertTriangle, Pause, Radio, ZoomIn, ZoomOut } from 'lucide-react';

interface TrainData {
  id: number;
  name: string;
  current_section_id: number;
  position: number;
  status: string;
  current_section?: {
    id: number;
    name: string;
    start_station_id: number;
    end_station_id: number;
    length_km: number;
  };
}

// Schematic coordinates keep the main corridor horizontal while retaining branch routes.
const STATION_COORDS: Record<number, { x: number; y: number; name: string; code: string; status: string }> = {
  1: { x: 100, y: 190, name: "Pune", code: "PUNE", status: "normal" },
  2: { x: 340, y: 190, name: "Lonavala", code: "LON", status: "block" },
  3: { x: 575, y: 190, name: "Karjat", code: "KRJ", status: "conflict" },
  4: { x: 790, y: 190, name: "Daund", code: "DAU", status: "normal" },
  5: { x: 1000, y: 190, name: "Solapur", code: "SUR", status: "normal" },
  6: { x: 1210, y: 190, name: "Kurduvadi", code: "KUR", status: "normal" },
};

// Section Definitions (start and end station IDs)
const SECTION_MAP: Record<number, { start: number; end: number; name: string }> = {
  1: { start: 1, end: 2, name: "Pune-Lonavala" },
  2: { start: 2, end: 3, name: "Lonavala-Karjat" },
  3: { start: 1, end: 4, name: "Pune-Daund" },
  4: { start: 4, end: 5, name: "Daund-Solapur" },
  5: { start: 5, end: 6, name: "Solapur-Kurduvadi" },
  6: { start: 2, end: 5, name: "Lonavala-Solapur" },
};

// Custom Station Node
function StationNodeComponent({ data }: NodeProps) {
  const isConflict = data.status === 'conflict';
  const isBlock = data.status === 'block';

  return (
    <div className="flex flex-col items-center group cursor-pointer min-w-24">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div
        className={`w-7 h-7 rounded-full border-2 border-white/90 shadow-[0_0_16px_currentColor] transition-all duration-300 group-hover:scale-125 ${
          isConflict
            ? 'bg-red-500 text-red-500 ring-4 ring-red-500/20 animate-pulse'
            : isBlock
            ? 'bg-amber-400 text-amber-400 ring-4 ring-amber-400/20'
            : 'bg-emerald-400 text-emerald-400 ring-4 ring-emerald-400/20'
        }`}
      />
      <div className="mt-2 text-center pointer-events-none">
        <span className="text-xs font-bold text-white tracking-tight block">
          {data.name as string}
        </span>
        <span className="text-[10px] font-mono text-slate-400">
          {data.code as string}
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

// Custom Train Node
function TrainNodeComponent({ data }: NodeProps) {
  return (
    <div className="group cursor-pointer relative -translate-x-1/2 -translate-y-1/2 select-none">
      <div className="flex items-center gap-1.5 bg-cyan-500/90 hover:bg-cyan-400 text-slate-950 px-3 py-1 rounded-full shadow-[0_0_14px_rgba(34,211,238,0.55)] border border-cyan-200/70 backdrop-blur transition-transform duration-200 group-hover:scale-105">
        <span className="w-2 h-2 rounded-full bg-cyan-300 animate-ping" />
        <TrainFront size={13} className="text-slate-950 shrink-0" />
        <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">
          {data.name as string}
        </span>
      </div>

      {/* Floating telemetry tooltip on hover */}
      <div className="hidden group-hover:flex flex-col gap-1 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-900/95 text-white rounded-xl shadow-2xl text-xs z-50 pointer-events-none border border-slate-700 backdrop-blur">
        <div className="font-bold text-blue-300 flex items-center justify-between border-b border-slate-800 pb-1">
          <span>{data.name as string}</span>
          <span className="text-[10px] text-emerald-400 uppercase font-semibold">{data.status as string}</span>
        </div>
        <div className="text-[11px] text-slate-300 space-y-0.5">
          <div className="flex justify-between">
            <span className="text-slate-400">Section:</span>
            <span className="font-medium text-white">{data.sectionName as string}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Progress:</span>
            <span className="font-medium text-white">{Math.round((data.position as number) * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  station: StationNodeComponent,
  train: TrainNodeComponent,
};

export default function DigitalTwin() {
  const [trains, setTrains] = useState<TrainData[]>([]);
  const [isSimulating, setIsSimulating] = useState(true);

  // Fetch trains from backend
  const fetchTrains = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/api/trains');
      if (res.ok) {
        const data = await res.json();
        setTrains(data);
      }
    } catch (err) {
      console.warn('Backend connection failed, using local simulated trains', err);
    } finally {
    }
  }, []);

  // Poll for train positions every 1.5s
  useEffect(() => {
    fetchTrains();
    if (!isSimulating) return;

    const interval = setInterval(() => {
      fetchTrains();
    }, 1500);

    return () => clearInterval(interval);
  }, [isSimulating, fetchTrains]);

  // Reset trains handler
  const handleReset = async () => {
    try {
      await fetch('http://localhost:8000/api/trains/reset', { method: 'POST' });
      fetchTrains();
    } catch (e) {
      console.error(e);
    }
  };

  // Base Station Nodes
  const stationNodes: Node[] = useMemo(() => {
    return Object.entries(STATION_COORDS).map(([id, st]) => ({
      id: `station-${id}`,
      type: 'station',
      position: { x: st.x, y: st.y },
      data: {
        id: Number(id),
        name: st.name,
        code: st.code,
        status: st.status,
      },
      draggable: false,
    }));
  }, []);

  // Dynamic Train Nodes calculated from train positions
  const trainNodes: Node[] = useMemo(() => {
    return trains.map((t) => {
      const sec = SECTION_MAP[t.current_section_id];
      const startCoord = sec ? STATION_COORDS[sec.start] : { x: 80, y: 130 };
      const endCoord = sec ? STATION_COORDS[sec.end] : { x: 380, y: 130 };

      const x = startCoord.x + (endCoord.x - startCoord.x) * t.position;
      const y = startCoord.y + (endCoord.y - startCoord.y) * t.position;

      return {
        id: `train-${t.id}`,
        type: 'train',
        position: { x, y },
        data: {
          id: t.id,
          name: t.name,
          status: t.status,
          positionPct: Math.round(t.position * 100),
          sectionName: sec ? sec.name : 'Unknown',
        },
        draggable: false,
      };
    });
  }, [trains]);

  // Main corridor and operational branch routes.
  const edges: Edge[] = useMemo(() => {
    return [
      { id: 'e1-2', source: 'station-1', target: 'station-2', animated: true, style: { stroke: '#f59e0b', strokeWidth: 4, strokeDasharray: '8 6' } },
      { id: 'e2-3', source: 'station-2', target: 'station-3', style: { stroke: '#e2e8f0', strokeWidth: 4 } },
      { id: 'e3-4', source: 'station-3', target: 'station-4', style: { stroke: '#ef4444', strokeWidth: 4 } },
      { id: 'e4-5', source: 'station-4', target: 'station-5', style: { stroke: '#e2e8f0', strokeWidth: 4 } },
      { id: 'e5-6', source: 'station-5', target: 'station-6', style: { stroke: '#f59e0b', strokeWidth: 4, strokeDasharray: '8 6' } },
    ];
  }, []);

  const allNodes = useMemo(() => [...stationNodes, ...trainNodes], [stationNodes, trainNodes]);

  return (
    <div className="w-full h-full flex flex-col space-y-3">
      {/* View Mode & Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        {/* Global Simulation Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              isSimulating
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            {isSimulating ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Dynamic Feed
              </>
            ) : (
              <>
                <Pause size={12} />
                Paused
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            title="Reset Train Positions"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </div>

      <div className="w-full h-[460px] relative rounded-3xl overflow-hidden border border-[#1b3d55] shadow-[inset_0_0_45px_rgba(0,0,0,0.45)]" style={{ background: '#071725' }}>
          <ReactFlow
            nodes={allNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={true}
            zoomOnScroll={true}
            minZoom={0.45}
            maxZoom={1.8}
          >
            <Background variant={BackgroundVariant.Lines} gap={36} size={1} color="#163247" />
          </ReactFlow>

            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3 pointer-events-none">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Central Railway</p>
                <p className="text-xs font-medium text-slate-300">Pune Division · Live schematic</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                <Radio size={11} className="animate-pulse" /> LIVE FEED
              </div>
            </div>
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-950/75 px-3 py-2 text-[10px] font-medium text-slate-300 backdrop-blur">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-400" />Operational</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-400" />Block</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500" />Conflict</span>
            </div>
            <div className="absolute right-3 bottom-3 z-10 flex gap-1 pointer-events-none">
              <span className="rounded-lg border border-slate-700 bg-slate-950/75 p-1.5 text-slate-400"><ZoomIn size={13} /></span>
              <span className="rounded-lg border border-slate-700 bg-slate-950/75 p-1.5 text-slate-400"><ZoomOut size={13} /></span>
            </div>
            <div className="absolute left-[27%] top-[43%] z-10 pointer-events-none rounded-md border border-amber-400/50 bg-amber-950/70 px-2 py-1 text-[9px] font-bold text-amber-300">
              <AlertTriangle size={11} className="mr-1 inline" /> BLOCK A-17 · 02:00–05:00
            </div>
      </div>
    </div>
  );
}
