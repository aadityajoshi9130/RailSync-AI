"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  TrainFront, 
  RotateCcw, 
  Pause, 
  Play, 
  Radio, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Navigation,
  Info,
  Layers,
  ArrowRight,
  ShieldCheck,
  X
} from 'lucide-react';

interface Station {
  id: string;
  code: string;
  name: string;
  division: string;
  km: number;
  x: number;
  y: number;
  status: 'normal' | 'block' | 'conflict' | 'hub';
  lines: string[];
  activeTrains: number;
}

interface Train {
  id: string;
  number: string;
  name: string;
  type: string;
  speed: number;
  from: string;
  to: string;
  section: string;
  progress: number; // 0 to 1
  status: 'on-time' | 'delayed' | 'regulated';
  delayMin: number;
  direction: 'UP' | 'DOWN';
}

const STATIONS: Station[] = [
  // Mumbai / Feeder Branch
  { id: 'kyn', code: 'KYN', name: 'Kalyan Jn', division: 'Mumbai', km: 0, x: 80, y: 110, status: 'normal', lines: ['Mainline', 'Kasara/Karjat'], activeTrains: 1 },
  { id: 'tna', code: 'TNA', name: 'Thane', division: 'Mumbai', km: 20, x: 100, y: 190, status: 'normal', lines: ['Central Mainline'], activeTrains: 1 },
  { id: 'pnvl', code: 'PNVL', name: 'Panvel Jn', division: 'Mumbai', km: 52, x: 130, y: 280, status: 'normal', lines: ['Harbour / Konkan'], activeTrains: 0 },
  
  // Ghat & Pune Section
  { id: 'krj', code: 'KRJ', name: 'Karjat Jn', division: 'Mumbai', km: 100, x: 230, y: 280, status: 'conflict', lines: ['Bhor Ghat Push-Pull'], activeTrains: 1 },
  { id: 'lon', code: 'LON', name: 'Lonavala', division: 'Pune', km: 128, x: 370, y: 280, status: 'block', lines: ['Bhor Ghat Summit'], activeTrains: 1 },
  { id: 'tgn', code: 'TGN', name: 'Talegaon', division: 'Pune', km: 162, x: 465, y: 220, status: 'normal', lines: ['Suburban Quad'], activeTrains: 0 },
  { id: 'cnw', code: 'CNW', name: 'Chinchwad', division: 'Pune', km: 178, x: 535, y: 220, status: 'normal', lines: ['Auto Hub / EMU'], activeTrains: 0 },
  { id: 'kdk', code: 'KDK', name: 'Khadki', division: 'Pune', km: 186, x: 505, y: 340, status: 'normal', lines: ['Ammunition / Military'], activeTrains: 0 },
  { id: 'pune', code: 'PUNE', name: 'Pune Junction', division: 'Pune (HQ)', km: 192, x: 590, y: 280, status: 'hub', lines: ['Guntakal / Miraj / Mumbai'], activeTrains: 3 },
  
  // South-East Mainline Section
  { id: 'dau', code: 'DAU', name: 'Daund Jn', division: 'Pune', km: 267, x: 740, y: 280, status: 'normal', lines: ['Chord / Manmad / Solapur'], activeTrains: 1 },
  { id: 'kur', code: 'KUR', name: 'Kurduvadi Jn', division: 'Solapur', km: 405, x: 880, y: 280, status: 'normal', lines: ['Miraj / Latur'], activeTrains: 1 },
  { id: 'sur', code: 'SUR', name: 'Solapur Jn', division: 'Solapur (HQ)', km: 484, x: 1000, y: 280, status: 'normal', lines: ['Wadi / Hyderabad'], activeTrains: 2 }
];

const INITIAL_TRAINS: Train[] = [
  { id: 't1', number: '12124', name: 'Deccan Queen', type: 'Superfast', speed: 95, from: 'Pune', to: 'CSMT', section: 'Pune-Lonavala', progress: 0.45, status: 'on-time', delayMin: 0, direction: 'UP' },
  { id: 't2', number: '22226', name: 'Solapur-CSMT VB', type: 'Vande Bharat', speed: 110, from: 'Solapur', to: 'CSMT', section: 'Daund-Kurduvadi', progress: 0.65, status: 'on-time', delayMin: 0, direction: 'UP' },
  { id: 't3', number: '12028', name: 'Pune Shatabdi', type: 'Shatabdi', speed: 45, from: 'CSMT', to: 'Pune', section: 'Karjat-Lonavala', progress: 0.30, status: 'delayed', delayMin: 14, direction: 'DOWN' },
  { id: 't4', number: '11019', name: 'Konark Express', type: 'Mail/Express', speed: 80, from: 'CSMT', to: 'BBS', section: 'Pune-Daund', progress: 0.80, status: 'delayed', delayMin: 6, direction: 'DOWN' },
  { id: 't5', number: 'BOXN-7041', name: 'Thermal Coal Rake', type: 'Freight Rake', speed: 55, from: 'Daund Chord', to: 'Lonavala', section: 'Kurduvadi-Solapur', progress: 0.20, status: 'regulated', delayMin: 22, direction: 'UP' }
];

// Section ID to visual section name map for backend train mapping
const SECTION_TO_VISUAL: Record<number, string> = {
  1: 'Pune-Lonavala',
  2: 'Karjat-Lonavala',
  3: 'Pune-Daund',
  4: 'Daund-Kurduvadi',
  5: 'Kurduvadi-Solapur',
  6: 'Lonavala-Solapur',
};

// Section ID to stations for active block cordon rendering
const SECTION_TO_STATION_PAIR: Record<number, [string, string]> = {
  1: ['lon', 'pune'],
  2: ['krj', 'lon'],
  3: ['pune', 'dau'],
  4: ['dau', 'kur'],   // Daund-Solapur actually passes through Kurduvadi
  5: ['kur', 'sur'],
  6: ['lon', 'sur'],
};

interface DigitalTwinProps {
  operationalTrains?: {
    id: number;
    name: string;
    current_section_id: number;
    section_name: string;
    position: number;
    status: string;
    is_restricted: boolean;
  }[];
  operationalBlocks?: {
    id: number;
    block_code: string;
    section_id: number;
    section_name: string;
    start_time: string;
    end_time: string;
    status: string;
    score: number;
  }[];
  operationalTime?: string;
}

export default function DigitalTwin({ operationalTrains, operationalBlocks, operationalTime }: DigitalTwinProps) {
  const [trains, setTrains] = useState<Train[]>(INITIAL_TRAINS);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);
  const [showDistances, setShowDistances] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>(operationalTime || "14:32:00");
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync trains from backend when operational data is provided
  useEffect(() => {
    if (operationalTrains && operationalTrains.length > 0) {
      setTrains(operationalTrains.map((bt, idx) => {
        const sectionName = SECTION_TO_VISUAL[bt.current_section_id] || bt.section_name;
        return {
          id: `t${bt.id}`,
          number: bt.name.split(' ')[0] || `T${bt.id}`,
          name: bt.name,
          type: bt.name.includes('Vande') ? 'Vande Bharat' : bt.name.includes('Shatabdi') ? 'Shatabdi' : bt.name.includes('BOXN') ? 'Freight Rake' : 'Mail/Express',
          speed: bt.status === 'RUNNING' ? 80 : 0,
          from: '',
          to: '',
          section: sectionName,
          progress: bt.position,
          status: bt.is_restricted ? 'regulated' : bt.status === 'DELAYED' ? 'delayed' : 'on-time',
          delayMin: bt.status === 'DELAYED' ? 12 : bt.is_restricted ? 30 : 0,
          direction: idx % 2 === 0 ? 'UP' as const : 'DOWN' as const,
        };
      }));
    }
  }, [operationalTrains]);

  // Use operational time when available
  useEffect(() => {
    if (operationalTime) {
      setCurrentTime(operationalTime);
    }
  }, [operationalTime]);

  // Fallback local simulation ticker (only when no backend data)
  useEffect(() => {
    if (!isLive || (operationalTrains && operationalTrains.length > 0)) return;
    const interval = setInterval(() => {
      setTrains(prev => prev.map(tr => {
        let nextProg = tr.progress + (tr.speed / 18000);
        if (nextProg >= 1.0) nextProg = 0.0;
        return { ...tr, progress: nextProg };
      }));
      
      if (!operationalTime) {
        const now = new Date();
        setCurrentTime(now.toTimeString().split(' ')[0]);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isLive, operationalTrains, operationalTime]);

  // Fullscreen state listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Zoom handlers
  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoom(z => Math.min(Number((z + 0.25).toFixed(2)), 3.0));
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoom(z => {
      const next = Math.max(Number((z - 0.25).toFixed(2)), 0.5);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Mouse pan / drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only drag on primary left button
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom(z => {
      const next = Math.min(Math.max(Number((z + delta).toFixed(2)), 0.5), 3.0);
      if (next <= 1 && z <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  // Handle station click
  const handleStationClick = (st: Station) => {
    setSelectedTrain(null);
    setSelectedStation(st);
  };

  // Handle train click
  const handleTrainClick = (tr: Train, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStation(null);
    setSelectedTrain(tr);
  };

  // Reset simulation & view
  const handleReset = () => {
    setTrains(INITIAL_TRAINS);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedStation(null);
    setSelectedTrain(null);
  };

  // Interpolate train positions along accurate track segments
  const trainCoordinates = useMemo(() => {
    return trains.map(tr => {
      let x1 = 370, y1 = 280, x2 = 590, y2 = 280; // default Pune-Lonavala

      if (tr.section === 'Pune-Lonavala') {
        x1 = 590; y1 = 280; x2 = 370; y2 = 280;
      } else if (tr.section === 'Karjat-Lonavala') {
        x1 = 230; y1 = 280; x2 = 370; y2 = 280;
      } else if (tr.section === 'Pune-Daund') {
        x1 = 590; y1 = 280; x2 = 740; y2 = 280;
      } else if (tr.section === 'Daund-Kurduvadi') {
        x1 = 740; y1 = 280; x2 = 880; y2 = 280;
      } else if (tr.section === 'Kurduvadi-Solapur') {
        x1 = 880; y1 = 280; x2 = 1000; y2 = 280;
      }

      // If UP direction, move from x1 -> x2; if DOWN, reverse
      const p = tr.direction === 'UP' ? tr.progress : (1 - tr.progress);
      const curX = x1 + (x2 - x1) * p;
      const curY = y1 + (y2 - y1) * p;

      return { ...tr, curX, curY };
    });
  }, [trains]);

  return (
    <div 
      ref={containerRef}
      className="w-full flex flex-col h-full bg-[#0B1320] text-slate-100 rounded-2xl overflow-hidden border border-slate-800 shadow-md select-none"
    >
      {/* 1. TOP MINIMAL CONTROLS BAR */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#0e1726]/90 border-b border-slate-800/80 gap-3 text-xs">
        {/* Corridor title & division */}
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-bold text-slate-200">Central Railway Division</span>
          <span className="text-slate-500">|</span>
          <span className="font-mono text-[11px] text-slate-400">Pune–Solapur & Bhor Ghat Corridor</span>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          {/* Section labels toggle */}
          <button
            onClick={() => setShowDistances(!showDistances)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border ${
              showDistances 
                ? 'bg-blue-950/70 border-blue-700/60 text-blue-300' 
                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            Distances
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700 shadow-inner">
            <button 
              onClick={handleZoomOut} 
              disabled={zoom <= 0.5}
              className="p-1 hover:bg-slate-700 text-slate-300 disabled:text-slate-600 disabled:hover:bg-transparent rounded transition-colors"
              title="Zoom Out (0.5x min)"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-blue-300 hover:text-white hover:bg-slate-700/60 rounded cursor-pointer transition-colors"
              title="Click to reset zoom (100%)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button 
              onClick={handleZoomIn} 
              disabled={zoom >= 3.0}
              className="p-1 hover:bg-slate-700 text-slate-300 disabled:text-slate-600 disabled:hover:bg-transparent rounded transition-colors"
              title="Zoom In (3.0x max)"
            >
              <ZoomIn size={13} />
            </button>
            <button 
              onClick={handleToggleFullscreen} 
              className={`p-1 hover:bg-slate-700 rounded transition-colors ml-0.5 border-l border-slate-700/60 ${
                isFullscreen ? 'text-blue-400 bg-blue-950/60' : 'text-slate-300'
              }`}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            >
              <Maximize2 size={13} />
            </button>
          </div>

          {/* Live / Pause */}
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
              isLive 
                ? 'bg-emerald-950/70 border-emerald-600/50 text-emerald-300' 
                : 'bg-amber-950/70 border-amber-600/50 text-amber-300'
            }`}
          >
            {isLive ? (
              <>
                <Radio size={12} className="animate-pulse text-emerald-400" />
                Live ({currentTime})
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
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700"
            title="Reset Train Positions & View"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* 2. CENTER ACCURATE RAIL SCHEMATIC CANVAS */}
      <div 
        className={`relative flex-1 bg-[#060D17] overflow-hidden min-h-[360px] flex items-center justify-center select-none ${
          zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Subtle engineering grid background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(#1e293b 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Minimal compass marker */}
        <div className="absolute top-3 left-4 flex items-center gap-1.5 text-[10px] font-mono text-slate-500 pointer-events-none">
          <Navigation size={12} className="text-slate-400 rotate-45" />
          <span>NORTH-EAST CORRIDOR</span>
        </div>

        {/* Floating Quick Reset View indicator when zoomed or panned */}
        {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
          <div className="absolute bottom-3 right-4 z-20 pointer-events-auto">
            <button
              onClick={handleResetZoom}
              className="px-2.5 py-1 bg-slate-900/90 hover:bg-slate-800 text-blue-300 hover:text-white text-[11px] font-semibold rounded-lg border border-blue-500/40 shadow-lg backdrop-blur-md transition-all flex items-center gap-1.5"
            >
              <RotateCcw size={11} />
              Reset View ({Math.round(zoom * 100)}%)
            </button>
          </div>
        )}

        {/* Active Block Banners (Dynamic from backend) */}
        {(() => {
          const activeBlocks = (operationalBlocks || []).filter(b => b.status === 'ACTIVE');
          const approvedBlocks = (operationalBlocks || []).filter(b => b.status === 'APPROVED');
          if (activeBlocks.length > 0) {
            return (
              <div className="absolute top-3 right-4 flex flex-col gap-1 z-10 pointer-events-none">
                {activeBlocks.map((b, idx) => (
                  <div key={`active-block-${b.id || b.block_code}-${idx}`} className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-950/50 border border-amber-500/40 text-[11px] text-amber-300 font-medium">
                    <AlertTriangle size={13} className="text-amber-400" />
                    <span>Active: <strong>{b.block_code}</strong> ({b.section_name} · {b.start_time}–{b.end_time})</span>
                  </div>
                ))}
              </div>
            );
          } else if (approvedBlocks.length > 0) {
            return (
              <div className="absolute top-3 right-4 flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-950/50 border border-blue-500/40 text-[11px] text-blue-300 font-medium z-10 pointer-events-none">
                <ShieldCheck size={13} className="text-blue-400" />
                <span>{approvedBlocks.length} Approved Block{approvedBlocks.length > 1 ? 's' : ''} — Pending Activation</span>
              </div>
            );
          } else {
            return (
              <div className="absolute top-3 right-4 flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-[11px] text-emerald-300 font-medium z-10 pointer-events-none">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>All Sections Clear — No Active Possessions</span>
              </div>
            );
          }
        })()}

        {/* Interactive SVG Canvas */}
        <div 
          className="w-full h-full relative flex items-center justify-center pointer-events-auto"
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)'
          }}
        >
          <svg viewBox="0 0 1100 480" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="blockStripe" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>

            {/* TRACK PATHS */}
            <g>
              {/* 1. Feeder Branch: Kalyan -> Thane -> Panvel */}
              <path d="M 80,110 L 100,190 L 130,280" stroke="#1e293b" strokeWidth="6" fill="none" strokeLinecap="round" />
              <path d="M 80,110 L 100,190 L 130,280" stroke="#64748b" strokeWidth="1.5" fill="none" strokeDasharray="4 2" />

              {/* 2. Panvel -> Karjat */}
              <path d="M 130,280 L 230,280" stroke="#1e293b" strokeWidth="8" fill="none" strokeLinecap="round" />
              <path d="M 130,278 L 230,278" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
              <path d="M 130,282 L 230,282" stroke="#64748b" strokeWidth="1.5" fill="none" />

              {/* 3. BHOR GHAT SECTION: Karjat -> Lonavala (ACTIVE BLOCK A-17) */}
              <path d="M 230,280 L 370,280" stroke="#1e293b" strokeWidth="10" fill="none" strokeLinecap="round" />
              <path d="M 230,277 L 370,277" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
              <path d="M 230,283 L 370,283" stroke="#64748b" strokeWidth="1.5" fill="none" />
              {/* Dynamic Active Block cordon highlights */}
              {(operationalBlocks || []).filter(b => b.status === 'ACTIVE' && b.section_id === 2).length > 0 && (
                <path d="M 230,280 L 370,280" stroke="url(#blockStripe)" strokeWidth="5" strokeDasharray="8 6" fill="none" />
              )}
              {(operationalBlocks || []).filter(b => b.status === 'ACTIVE' && b.section_id === 1).length > 0 && (
                <path d="M 370,280 L 590,280" stroke="url(#blockStripe)" strokeWidth="5" strokeDasharray="8 6" fill="none" />
              )}
              {(operationalBlocks || []).filter(b => b.status === 'ACTIVE' && b.section_id === 3).length > 0 && (
                <path d="M 590,280 L 740,280" stroke="url(#blockStripe)" strokeWidth="5" strokeDasharray="8 6" fill="none" />
              )}
              {(operationalBlocks || []).filter(b => b.status === 'ACTIVE' && (b.section_id === 4 || b.section_id === 5)).length > 0 && (
                <path d="M 740,280 L 1000,280" stroke="url(#blockStripe)" strokeWidth="5" strokeDasharray="8 6" fill="none" />
              )}

              {/* 4. Suburban Branches from Pune: Chinchwad, Talegaon, Khadki */}
              <path d="M 370,280 L 465,220 L 535,220 L 590,280" stroke="#1e293b" strokeWidth="6" fill="none" />
              <path d="M 370,280 L 465,220 L 535,220 L 590,280" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
              
              <path d="M 505,340 L 590,280" stroke="#1e293b" strokeWidth="6" fill="none" />
              <path d="M 505,340 L 590,280" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />

              {/* 5. Mainline Direct: Lonavala -> Pune */}
              <path d="M 370,280 L 590,280" stroke="#1e293b" strokeWidth="10" fill="none" strokeLinecap="round" />
              <path d="M 370,277 L 590,277" stroke="#cbd5e1" strokeWidth="2" fill="none" />
              <path d="M 370,283 L 590,283" stroke="#38bdf8" strokeWidth="2" fill="none" />

              {/* 6. South-East Corridor: Pune -> Daund -> Kurduvadi -> Solapur */}
              <path d="M 590,280 L 1000,280" stroke="#1e293b" strokeWidth="10" fill="none" strokeLinecap="round" />
              <path d="M 590,277 L 1000,277" stroke="#cbd5e1" strokeWidth="2" fill="none" />
              <path d="M 590,283 L 1000,283" stroke="#38bdf8" strokeWidth="2" fill="none" />
            </g>

            {/* SECTION DISTANCE BADGES (Minimal & Legible) */}
            {showDistances && (
              <g className="text-[9px] font-mono fill-slate-500 select-none">
                <text x="175" y="270" textAnchor="middle">PNVL-KRJ (48 km)</text>
                <text x="300" y="266" textAnchor="middle" fill="#f59e0b" fontWeight="bold">LON-KRJ Ghat (28 km)</text>
                <text x="480" y="270" textAnchor="middle">LON-PUN (64 km)</text>
                <text x="665" y="270" textAnchor="middle">PUN-DAU (75 km)</text>
                <text x="810" y="270" textAnchor="middle">DAU-KUR (138 km)</text>
                <text x="940" y="270" textAnchor="middle">KUR-SOL (79 km)</text>
              </g>
            )}

            {/* STATIONS RENDERING (Minimal Concentric Badges) */}
            {STATIONS.map(st => {
              const isSelected = selectedStation?.id === st.id;
              let ringColor = '#3b82f6';
              if (st.status === 'block') ringColor = '#f59e0b';
              if (st.status === 'conflict') ringColor = '#ef4444';
              if (st.status === 'hub') ringColor = '#10b981';

              return (
                <g 
                  key={st.id} 
                  onClick={() => handleStationClick(st)} 
                  className="cursor-pointer group"
                >
                  {/* Stable stationary hit target (prevents mouseenter/mouseleave oscillation) */}
                  <circle cx={st.x} cy={st.y} r="22" fill="transparent" />

                  {/* Outer Hub Halo (pointer-events-none to prevent flickering) */}
                  {st.status === 'hub' && (
                    <circle cx={st.x} cy={st.y} r="18" fill="none" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.4" className="animate-ping pointer-events-none" />
                  )}

                  {/* Outer station ring */}
                  <circle 
                    cx={st.x} 
                    cy={st.y} 
                    r={st.status === 'hub' ? 12 : (isSelected ? 10 : 7.5)} 
                    fill="#0a1322" 
                    stroke={ringColor} 
                    strokeWidth={isSelected ? 3 : 2} 
                    className="transition-colors group-hover:stroke-cyan-300 pointer-events-none"
                  />
                  
                  {/* Center node */}
                  <circle cx={st.x} cy={st.y} r={st.status === 'hub' ? 5 : 3} fill={ringColor} className="pointer-events-none" />

                  {/* Station Code Label */}
                  <text 
                    x={st.x} 
                    y={st.y - (st.status === 'hub' ? 17 : 13)} 
                    textAnchor="middle" 
                    className={`font-bold text-[11px] transition-colors pointer-events-none select-none ${isSelected ? 'fill-cyan-300 font-extrabold' : 'fill-slate-200 group-hover:fill-cyan-300'}`}
                  >
                    {st.name}
                  </text>
                  <text 
                    x={st.x} 
                    y={st.y + (st.status === 'hub' ? 22 : 18)} 
                    textAnchor="middle" 
                    className="font-mono text-[9px] fill-slate-400 pointer-events-none select-none"
                  >
                    {st.code}
                  </text>
                </g>
              );
            })}

            {/* LIVE MOVING TRAINS (Clean, Precision Indicators) */}
            {trainCoordinates.map(tr => {
              const isSelected = selectedTrain?.id === tr.id;
              let badgeBg = '#064e3b';
              let badgeBorder = '#10b981';
              let textColor = '#a7f3d0';

              if (tr.status === 'delayed') {
                badgeBg = '#78350f';
                badgeBorder = '#f59e0b';
                textColor = '#fde68a';
              } else if (tr.status === 'regulated') {
                badgeBg = '#7f1d1d';
                badgeBorder = '#ef4444';
                textColor = '#fca5a5';
              }

              return (
                <g 
                  key={tr.id} 
                  transform={`translate(${tr.curX}, ${tr.curY + 28})`}
                  onClick={(e) => handleTrainClick(tr, e)}
                  className="cursor-pointer group"
                >
                  {/* Pulsing beacon on track */}
                  <circle cx="0" cy="-28" r="4" fill={badgeBorder} className="animate-ping opacity-75 pointer-events-none" />
                  <circle cx="0" cy="-28" r="2.5" fill={badgeBorder} className="pointer-events-none" />

                  {/* Connecting dashed whisker from train capsule to track */}
                  <line x1="0" y1="-28" x2="0" y2="-12" stroke={badgeBorder} strokeWidth="1" strokeDasharray="2 2" className="pointer-events-none" />

                  {/* Capsule pill with stationary hit area */}
                  <rect 
                    x="-32" 
                    y="-10" 
                    width="64" 
                    height="20" 
                    rx="10" 
                    fill={badgeBg} 
                    stroke={badgeBorder} 
                    strokeWidth={isSelected ? 2 : 1}
                    className="transition-colors group-hover:brightness-125 shadow-lg"
                  />
                  <text x="-24" y="4" fill="#fff" fontSize="8" fontWeight="bold" className="pointer-events-none select-none">🚆</text>
                  <text x="-8" y="3" fill="#fff" fontSize="8.5" fontWeight="bold" className="pointer-events-none select-none">{tr.number}</text>

                  {/* Direction marker */}
                  <text x="21" y="3" fill={textColor} fontSize="7" fontWeight="bold" className="pointer-events-none select-none">
                    {tr.direction === 'UP' ? '▲' : '▼'}
                  </text>

                  {/* Hover tooltip */}
                  <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" transform="translate(0, -45)">
                    <rect x="-45" y="-12" width="90" height="22" rx="6" fill="#0f172a" stroke="#334155" strokeWidth="1" />
                    <text x="0" y="-1" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold">{tr.name}</text>
                    <text x="0" y="7" textAnchor="middle" fill={textColor} fontSize="7">
                      {tr.status === 'on-time' ? 'On Time' : `+${tr.delayMin} min`} · {tr.speed} km/h
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 3. SLIDE-OUT INSPECTION DRAWER (Clean & Minimal) */}
        {(selectedStation || selectedTrain) && (
          <div className="absolute top-3 bottom-3 right-3 w-72 bg-[#0e1726]/95 backdrop-blur-md rounded-2xl border border-slate-700/80 p-3.5 shadow-2xl z-20 text-xs flex flex-col justify-between overflow-y-auto animate-in fade-in slide-in-from-right-2 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                {selectedStation ? 'Station Inspector' : 'Live Train Telemetry'}
              </span>
              <button 
                onClick={() => { setSelectedStation(null); setSelectedTrain(null); }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={13} />
              </button>
            </div>

            {/* Station Details */}
            {selectedStation && (
              <div className="space-y-3 py-2 flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-base text-white">{selectedStation.name}</h4>
                    <span className="font-mono text-slate-400 text-[11px]">{selectedStation.code} · {selectedStation.division} Division</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    selectedStation.status === 'hub' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
                    selectedStation.status === 'block' ? 'bg-amber-950 text-amber-300 border border-amber-700' :
                    selectedStation.status === 'conflict' ? 'bg-red-950 text-red-300 border border-red-700' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {selectedStation.status}
                  </span>
                </div>

                <div className="space-y-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-[11px]">
                  <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Chainage / KM</span>
                    <span className="font-mono text-slate-200">{selectedStation.km} km from CSMT</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Active Trains</span>
                    <span className="font-bold text-white">{selectedStation.activeTrains}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Track Gauge</span>
                    <span className="text-slate-200">1,676 mm (Broad Gauge)</span>
                  </div>
                </div>

                {selectedStation.status === 'block' && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-1 text-[11px]">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400 text-xs">
                      <AlertTriangle size={12} /> Active Block A-17
                    </div>
                    <p className="text-slate-300 text-[10px]">Lonavala–Karjat Bhor Ghat track possession in progress (02:00–05:00).</p>
                  </div>
                )}
              </div>
            )}

            {/* Train Details */}
            {selectedTrain && (
              <div className="space-y-3 py-2 flex-1">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-base text-cyan-400">{selectedTrain.number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      selectedTrain.status === 'on-time' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
                      'bg-amber-950 text-amber-300 border border-amber-700'
                    }`}>
                      {selectedTrain.status === 'on-time' ? 'On Time' : `+${selectedTrain.delayMin} min delay`}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-white">{selectedTrain.name}</h4>
                  <span className="text-slate-400 text-[11px]">{selectedTrain.type}</span>
                </div>

                <div className="space-y-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-[11px]">
                  <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Current Section</span>
                    <span className="font-medium text-slate-200">{selectedTrain.section}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Running Speed</span>
                    <span className="font-bold text-white">{selectedTrain.speed} km/h</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Route Direction</span>
                    <span className="font-mono text-slate-200">{selectedTrain.from} ➔ {selectedTrain.to}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Section Progress</span>
                    <span className="font-mono font-bold text-cyan-300">{Math.round(selectedTrain.progress * 100)}%</span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 text-center">
              Click another station/train to inspect
            </div>
          </div>
        )}
      </div>

      {/* 4. BOTTOM MINIMAL STRIP */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#0a1322] border-t border-slate-800/80 text-[11px] text-slate-400 gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Operational Tracks: <strong>11 Sections</strong></span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Maintenance Block: <strong>LON-KRJ</strong></span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" /> Active Trains: <strong>{trains.length}</strong></span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
          <span>Broad Gauge (1,676 mm)</span>
          <span>·</span>
          <span>25 kV AC OHE Traction</span>
        </div>
      </div>
    </div>
  );
}
