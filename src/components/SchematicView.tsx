import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConverterTopologyId, DeviceInstantState, LoadType, SemiControlledConfig } from '../types/converter';
import { Zap, Activity, Gauge, Maximize2, Minimize2 } from 'lucide-react';
import { LoadFwdSelector } from './LoadFwdSelector';

interface SchematicViewProps {
  topologyId: ConverterTopologyId;
  deviceStates: Record<string, DeviceInstantState>;
  loadType: LoadType;
  R: number;
  L: number;
  E: number;
  vOut: number;
  iOut: number;
  activeBranchDesc: string;
  phaseAngleDeg: number;
  hasFreewheelingDiode?: boolean;
  isFwdConducting?: boolean;
  iFwd?: number;
  semiConfig?: SemiControlledConfig;
  isPlaying?: boolean;
  /** Playback sweep speed (0.1x - 1x); the current-flow animation scales with it. */
  playbackSpeed?: number;
  /** Supply frequency in Hz; the current-flow animation scales with it. */
  frequency?: number;
  /** Peak load current of the running simulation (A); used to scale flow speed with the instantaneous current. */
  iPeak?: number;
  /** Load / D_FW state the selector should show at once (the schematic itself may lag a frame behind while the simulation recomputes). */
  controlLoadType?: LoadType;
  controlHasFwd?: boolean;
  /** Topology currently chosen in the controls (updates at once; topologyId may lag while the simulation recomputes). */
  controlTopologyId?: ConverterTopologyId;
  /** Rendered between the circuit canvas and the Conducting Loop banner (e.g. playback controls). */
  playbackSlot?: React.ReactNode;
  /** Load-chain and freewheeling-diode selectors live inside the schematic canvas (right side). */
  onLoadTypeChange?: (t: LoadType) => void;
  onToggleFwd?: (on: boolean) => void;
  onSemiConfigChange?: (c: SemiControlledConfig) => void;
  alpha?: number;
}

export const SchematicView: React.FC<SchematicViewProps> = ({
  topologyId,
  deviceStates,
  loadType,
  R,
  L,
  E,
  vOut,
  iOut,
  activeBranchDesc,
  phaseAngleDeg,
  hasFreewheelingDiode = false,
  isFwdConducting = false,
  iFwd = 0,
  semiConfig = 'symmetric',
  isPlaying = true,
  playbackSpeed = 0.5,
  frequency = 50,
  iPeak = 0,
  controlLoadType,
  controlHasFwd,
  controlTopologyId,
  playbackSlot,
  onLoadTypeChange,
  onToggleFwd,
  onSemiConfigChange,
  alpha = 0,
}) => {
  const [inspectedDevice, setInspectedDevice] = useState<string | null>(null);

  // ---- Full-screen toggle -------------------------------------------------
  // Uses the browser Fullscreen API when available; otherwise (e.g. iPhone Safari)
  // falls back to a fixed full-viewport overlay. Esc exits in both modes, and `F`
  // toggles it from the keyboard.
  const rootRef = useRef<HTMLDivElement>(null);
  const usingNativeFs = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    const el = rootRef.current;
    if (el && document.fullscreenEnabled && el.requestFullscreen) {
      usingNativeFs.current = true;
      el.requestFullscreen().catch(() => {
        // Denied by the browser -> keep the CSS overlay fallback.
        usingNativeFs.current = false;
      });
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (usingNativeFs.current && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    usingNativeFs.current = false;
    setIsFullscreen(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Keep React state in sync when the browser exits fullscreen itself (Esc, F11, swipe)
  useEffect(() => {
    const onChange = () => {
      if (usingNativeFs.current && !document.fullscreenElement) {
        usingNativeFs.current = false;
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Esc (overlay fallback) and `F` shortcut; lock page scroll while overlay is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen();
      } else if ((e.key === 'f' || e.key === 'F') && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only react to F while the pointer is over the circuit, or while already fullscreen
        if (isFullscreen || rootRef.current?.matches(':hover')) {
          e.preventDefault();
          toggleFullscreen();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen, exitFullscreen, toggleFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isFullscreen]);

  // ---- Current-flow animation ----------------------------------------------
  // Every conducting wire carries marching dashes. The dash phase is advanced here (one rAF loop,
  // written straight to a CSS variable, so React never re-renders for it) and each wire reads it
  // through `.cf-fwd` (flow along the way the wire is drawn) or `.cf-rev` (flow against it).
  // Speed follows the playback speed, the supply frequency and the instantaneous load current;
  // it freezes while the simulation is paused.
  const flowRef = useRef({ speed: 25, playing: true });
  const iNowAbs = Math.abs(iOut);
  const magFactor = iPeak > 1e-6 ? 0.45 + 0.55 * Math.min(1, iNowAbs / iPeak) : 1;
  const freqFactor = Math.min(3, Math.max(0.4, frequency / 50));
  flowRef.current.speed = 50 * playbackSpeed * freqFactor * magFactor; // dash units per second
  flowRef.current.playing = isPlaying;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let phase = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (flowRef.current.playing) {
        phase = (phase + flowRef.current.speed * dt) % 14; // 14 = dash + gap
        rootRef.current?.style.setProperty('--flow-phase', phase.toFixed(2));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** Class for a wire: marching dashes only while it conducts. dir = +1 along the drawn direction, -1 against it. */
  const fl = (active: boolean, dir: 1 | -1 = 1) => (active ? (dir < 0 ? 'cf cf-rev' : 'cf cf-fwd') : '');

  // ---- Smooth load swap -----------------------------------------------------
  // The load symbol is swapped in the same render as the new numbers (Io, device currents, wire states),
  // so the picture never disagrees with the readouts. The new symbol simply fades in (keyed on loadType).
  const shownLoad: LoadType = loadType;

  // Helper to check if a switch is conducting
  const isDeviceOn = (name: string) => {
    return !!deviceStates[name]?.conducting;
  };

  const getDeviceCurrent = (name: string) => {
    const s = deviceStates[name];
    return s && s.conducting ? s.current.toFixed(1) + ' A' : '0 A';
  };

  const getDeviceVoltage = (name: string) => {
    const s = deviceStates[name];
    return s ? s.anodeToCathodeVoltage.toFixed(0) + ' V' : '0 V';
  };

  // Wire styling constants - High contrast adapted for Dark and Light/Print themes
  const wireInactive = 'var(--color-slate-700)'; // slate-400 vs slate-700
  const wireActiveEmerald = 'var(--color-emerald-500)'; // rich emerald
  const wireActiveAmber = 'var(--color-emerald-500)'; // single active colour (emerald) for every device type
  const wirePhaseA = 'var(--color-red-400)'; // red-600 vs red-400
  const wirePhaseB = 'var(--color-amber-300)'; // amber-600 vs yellow-400
  const wirePhaseC = 'var(--color-indigo-400)'; // blue-600 vs blue-400

  // Render Solder Junction Node (Connection Dot)
  const renderJunction = (x: number, y: number, active = false, color?: string) => (
    <g key={`junc-${x}-${y}`}>
      {active && (
        <circle
          cx={x}
          cy={y}
          r="7"
          fill={color || ('var(--color-emerald-500)')}
          fillOpacity={0.3}
          className="animate-pulse"
        />
      )}
      <circle
        cx={x}
        cy={y}
        r="4.5"
        fill={color || (active ? ('var(--color-emerald-500)') : ('var(--color-slate-500)'))}
        stroke="var(--color-slate-900)"
        strokeWidth="1.5"
      />
    </g>
  );

  // =========================================================================
  // PRECISION VERTICAL DIODE (Anode at yBottom, Cathode at yTop -> Current flows UP)
  // Guarantees 100% continuous wire from (cx, yBottom) straight to (cx, yTop)!
  // =========================================================================
  const renderDiodeVertical = (
    id: string,
    label: string,
    cx: number,
    yTop: number,
    yBottom: number
  ) => {
    const on = isDeviceOn(label);
    const isSelected = inspectedDevice === label;
    const cy = (yTop + yBottom) / 2;
    const activeColor = wireActiveEmerald;

    return (
      <g
        key={id}
        onClick={() => setInspectedDevice(isSelected ? null : label)}
        className="cursor-pointer group select-none"
      >
        {/* Glow halo when conducting */}
        {on && (
          <circle
            cx={cx}
            cy={cy}
            r="24"
            fill={activeColor}
            fillOpacity="0.25"
            className="animate-pulse"
          />
        )}
        {isSelected && (
          <circle
            cx={cx}
            cy={cy}
            r="26"
            fill="none"
            stroke="var(--color-sky-400)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        )}

        {/* Continuous Anode Wire: from yBottom all the way up to triangle base (cy + 10) */}
        <line
          x1={cx}
          y1={yBottom}
          x2={cx}
          y2={cy + 10}
          stroke={on ? activeColor : wireInactive}
          strokeWidth="2.5"
          className={fl(on)}
        />

        {/* Diode Triangle pointing UP (Anode at bottom, Cathode at top) */}
        <polygon
          points={`${cx - 13},${cy + 10} ${cx + 13},${cy + 10} ${cx},${cy - 10}`}
          fill={on ? activeColor : 'var(--color-slate-800)'}
          stroke={on ? 'var(--color-emerald-400)' : 'var(--color-slate-400)'}
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Cathode horizontal crossbar at (cy - 10) */}
        <line
          x1={cx - 15}
          y1={cy - 10}
          x2={cx + 15}
          y2={cy - 10}
          stroke={on ? 'var(--color-emerald-400)' : 'var(--color-slate-400)'}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Continuous Cathode Wire: from crossbar (cy - 10) all the way up to yTop */}
        <line
          x1={cx}
          y1={cy - 10}
          x2={cx}
          y2={yTop}
          stroke={on ? activeColor : wireInactive}
          strokeWidth="2.5"
          className={fl(on)}
        />

        {/* Device Label Badge on the right */}
        <rect
          x={cx + 18}
          y={cy - 13}
          width="34"
          height="16"
          rx="3"
          fill="var(--color-slate-900)"
          stroke={on ? activeColor : 'var(--color-slate-600)'}
          strokeWidth="1"
        />
        <text
          x={cx + 35}
          y={cy - 1}
          fill={on ? 'var(--color-emerald-400)' : 'var(--color-slate-300)'}
          fontSize="11"
          fontWeight="bold"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          {label}
        </text>

        {/* Current Readout when conducting */}
        {on && (
          <text
            x={cx + 35}
            y={cy + 15}
            fill="var(--color-emerald-300)"
            fontSize="10"
            fontWeight="bold"
            fontFamily="JetBrains Mono, monospace"
            textAnchor="middle"
          >
            {getDeviceCurrent(label)}
          </text>
        )}
      </g>
    );
  };

  // =========================================================================
  // PRECISION VERTICAL THYRISTOR (Anode at yBottom, Cathode at yTop -> Current flows UP)
  // Guarantees 100% continuous wire from (cx, yBottom) straight to (cx, yTop)!
  // =========================================================================
  const renderThyristorVertical = (
    id: string,
    label: string,
    cx: number,
    yTop: number,
    yBottom: number
  ) => {
    const on = isDeviceOn(label);
    const isSelected = inspectedDevice === label;
    const cy = (yTop + yBottom) / 2;
    const activeColor = wireActiveAmber;

    return (
      <g
        key={id}
        onClick={() => setInspectedDevice(isSelected ? null : label)}
        className="cursor-pointer group select-none"
      >
        {/* Glow halo when conducting */}
        {on && (
          <circle
            cx={cx}
            cy={cy}
            r="26"
            fill={activeColor}
            fillOpacity="0.25"
            className="animate-pulse"
          />
        )}
        {isSelected && (
          <circle
            cx={cx}
            cy={cy}
            r="28"
            fill="none"
            stroke="var(--color-sky-400)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        )}

        {/* Continuous Anode Wire: from yBottom all the way up to triangle base (cy + 10) */}
        <line
          x1={cx}
          y1={yBottom}
          x2={cx}
          y2={cy + 10}
          stroke={on ? activeColor : wireInactive}
          strokeWidth="2.5"
          className={fl(on)}
        />

        {/* Thyristor Triangle pointing UP */}
        <polygon
          points={`${cx - 13},${cy + 10} ${cx + 13},${cy + 10} ${cx},${cy - 10}`}
          fill={on ? activeColor : 'var(--color-slate-800)'}
          stroke={on ? 'var(--color-emerald-400)' : 'var(--color-slate-400)'}
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Cathode horizontal crossbar at (cy - 10) */}
        <line
          x1={cx - 15}
          y1={cy - 10}
          x2={cx + 15}
          y2={cy - 10}
          stroke={on ? 'var(--color-emerald-400)' : 'var(--color-slate-400)'}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Angled Gate Lead (to left) with Gate terminal */}
        <path
          d={`M ${cx - 10},${cy - 10} L ${cx - 18},${cy - 2} L ${cx - 24},${cy - 2}`}
          fill="none"
          stroke={on ? 'var(--color-emerald-400)' : 'var(--color-slate-400)'}
          strokeWidth="1.75"
        />
        <circle cx={cx - 24} cy={cy - 2} r="2.5" fill={on ? 'var(--color-emerald-400)' : 'var(--color-slate-400)'} />
        <text
          x={cx - 28}
          y={cy + 1}
          fill={on ? 'var(--color-emerald-400)' : 'var(--color-slate-500)'}
          fontSize="10"
          fontWeight="bold"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="end"
        >
          G
        </text>

        {/* Continuous Cathode Wire: from crossbar (cy - 10) all the way up to yTop */}
        <line
          x1={cx}
          y1={cy - 10}
          x2={cx}
          y2={yTop}
          stroke={on ? activeColor : wireInactive}
          strokeWidth="2.5"
          className={fl(on)}
        />

        {/* Device Label Badge on the right */}
        <rect
          x={cx + 18}
          y={cy - 13}
          width="34"
          height="16"
          rx="3"
          fill="var(--color-slate-900)"
          stroke={on ? activeColor : 'var(--color-slate-600)'}
          strokeWidth="1"
        />
        <text
          x={cx + 35}
          y={cy - 1}
          fill={on ? 'var(--color-emerald-400)' : 'var(--color-slate-300)'}
          fontSize="11"
          fontWeight="bold"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          {label}
        </text>

        {/* Current Readout when conducting */}
        {on && (
          <text
            x={cx + 35}
            y={cy + 15}
            fill="var(--color-emerald-300)"
            fontSize="10"
            fontWeight="bold"
            fontFamily="JetBrains Mono, monospace"
            textAnchor="middle"
          >
            {getDeviceCurrent(label)}
          </text>
        )}
      </g>
    );
  };

  // =========================================================================
  // PRECISION HORIZONTAL DIODE (Anode at xLeft, Cathode at xRight -> Current flows RIGHT)
  // Guarantees 100% continuous wire from (xLeft, cy) straight to (xRight, cy)!
  // =========================================================================
  const renderDiodeHorizontal = (
    id: string,
    label: string,
    cy: number,
    xLeft: number,
    xRight: number
  ) => {
    const on = isDeviceOn(label);
    const isSelected = inspectedDevice === label;
    const cx = (xLeft + xRight) / 2;
    const activeColor = wireActiveEmerald;

    return (
      <g
        key={id}
        onClick={() => setInspectedDevice(isSelected ? null : label)}
        className="cursor-pointer group select-none"
      >
        {on && (
          <circle
            cx={cx}
            cy={cy}
            r="24"
            fill={activeColor}
            fillOpacity="0.25"
            className="animate-pulse"
          />
        )}
        {/* Continuous Anode Wire: from xLeft straight into triangle base (cx - 10) */}
        <line
          x1={xLeft}
          y1={cy}
          x2={cx - 10}
          y2={cy}
          stroke={on ? activeColor : wireInactive}
          strokeWidth="2.5"
          className={fl(on)}
        />

        {/* Diode Triangle pointing RIGHT */}
        <polygon
          points={`${cx - 10},${cy - 13} ${cx - 10},${cy + 13} ${cx + 10},${cy}`}
          fill={on ? activeColor : 'var(--color-slate-800)'}
          stroke={on ? 'var(--color-emerald-400)' : 'var(--color-slate-400)'}
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Cathode vertical crossbar at (cx + 10) */}
        <line
          x1={cx + 10}
          y1={cy - 15}
          x2={cx + 10}
          y2={cy + 15}
          stroke={on ? 'var(--color-emerald-400)' : 'var(--color-slate-400)'}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Continuous Cathode Wire: from crossbar (cx + 10) straight to xRight */}
        <line
          x1={cx + 10}
          y1={cy}
          x2={xRight}
          y2={cy}
          stroke={on ? activeColor : wireInactive}
          strokeWidth="2.5"
          className={fl(on)}
        />

        {/* Badge on top */}
        <rect
          x={cx - 17}
          y={cy - 30}
          width="34"
          height="16"
          rx="3"
          fill="var(--color-slate-900)"
          stroke={on ? activeColor : 'var(--color-slate-600)'}
          strokeWidth="1"
        />
        <text
          x={cx}
          y={cy - 18}
          fill={on ? 'var(--color-emerald-400)' : 'var(--color-slate-300)'}
          fontSize="11"
          fontWeight="bold"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          {label}
        </text>
        {on && (
          <text
            x={cx + 21}
            y={cy - 18}
            fill="var(--color-emerald-300)"
            fontSize="10"
            fontWeight="bold"
            fontFamily="JetBrains Mono, monospace"
            textAnchor="start"
          >
            {getDeviceCurrent(label)}
          </text>
        )}
      </g>
    );
  };

  // =========================================================================
  // PRECISION HORIZONTAL THYRISTOR (Anode at xLeft, Cathode at xRight)
  // Guarantees 100% continuous wire from (xLeft, cy) straight to (xRight, cy)!
  // =========================================================================
  const renderThyristorHorizontal = (
    id: string,
    label: string,
    cy: number,
    xLeft: number,
    xRight: number
  ) => {
    const on = isDeviceOn(label);
    const isSelected = inspectedDevice === label;
    const cx = (xLeft + xRight) / 2;
    const activeColor = wireActiveAmber;

    return (
      <g
        key={id}
        onClick={() => setInspectedDevice(isSelected ? null : label)}
        className="cursor-pointer group select-none"
      >
        {on && (
          <circle
            cx={cx}
            cy={cy}
            r="26"
            fill={activeColor}
            fillOpacity="0.25"
            className="animate-pulse"
          />
        )}
        {/* Continuous Anode Wire */}
        <line
          x1={xLeft}
          y1={cy}
          x2={cx - 10}
          y2={cy}
          stroke={on ? activeColor : wireInactive}
          strokeWidth="2.5"
          className={fl(on)}
        />

        {/* Triangle pointing RIGHT */}
        <polygon
          points={`${cx - 10},${cy - 13} ${cx - 10},${cy + 13} ${cx + 10},${cy}`}
          fill={on ? activeColor : 'var(--color-slate-800)'}
          stroke={on ? 'var(--color-emerald-400)' : 'var(--color-slate-400)'}
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Cathode bar */}
        <line
          x1={cx + 10}
          y1={cy - 15}
          x2={cx + 10}
          y2={cy + 15}
          stroke={on ? 'var(--color-emerald-400)' : 'var(--color-slate-400)'}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Gate Lead */}
        <path
          d={`M ${cx + 10},${cy + 10} L ${cx + 18},${cy + 18} L ${cx + 25},${cy + 18}`}
          fill="none"
          stroke={on ? 'var(--color-emerald-400)' : 'var(--color-slate-400)'}
          strokeWidth="1.75"
        />
        <circle cx={cx + 25} cy={cy + 18} r="2.5" fill={on ? 'var(--color-emerald-400)' : 'var(--color-slate-400)'} />
        <text
          x={cx + 29}
          y={cy + 21}
          fill={on ? 'var(--color-emerald-400)' : 'var(--color-slate-500)'}
          fontSize="10"
          fontWeight="bold"
          fontFamily="JetBrains Mono, monospace"
        >
          G
        </text>

        {/* Continuous Cathode Wire */}
        <line
          x1={cx + 10}
          y1={cy}
          x2={xRight}
          y2={cy}
          stroke={on ? activeColor : wireInactive}
          strokeWidth="2.5"
          className={fl(on)}
        />

        {/* Badge on top */}
        <rect
          x={cx - 17}
          y={cy - 30}
          width="34"
          height="16"
          rx="3"
          fill="var(--color-slate-900)"
          stroke={on ? activeColor : 'var(--color-slate-600)'}
          strokeWidth="1"
        />
        <text
          x={cx}
          y={cy - 18}
          fill={on ? 'var(--color-emerald-400)' : 'var(--color-slate-300)'}
          fontSize="11"
          fontWeight="bold"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          {label}
        </text>
        {on && (
          <text
            x={cx + 21}
            y={cy - 18}
            fill="var(--color-emerald-300)"
            fontSize="10"
            fontWeight="bold"
            fontFamily="JetBrains Mono, monospace"
            textAnchor="start"
          >
            {getDeviceCurrent(label)}
          </text>
        )}
      </g>
    );
  };

  // =========================================================================
  // TEXTBOOK LOAD BRANCH (R, RL, RE, RLE)
  // Perfectly spans topY to botY with ZERO GAPS!
  // =========================================================================
  const renderLoadBranch = (x: number, topY: number, botY: number) => {
    const isLoadActive = iOut > 1e-4;
    const wireColor = isLoadActive ? wireActiveEmerald : wireInactive;
    const compColor = isLoadActive ? 'var(--color-emerald-400)' : 'var(--color-slate-400)';

    return (
      <g>
        {/* Top Terminal Junction with (+) Polar Mark */}
        {renderJunction(x, topY, isLoadActive)}
        <text x={x + 14} y={topY - 8} fill="var(--color-slate-400)" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          DC+
        </text>

        <g key={shownLoad} className="load-fade-in">
        {/* ----------------- CASE 1: PURE RESISTIVE LOAD (R) ----------------- */}
        {shownLoad === 'R' && (() => {
          const rCenterY = (topY + botY) / 2;
          const rTopY = rCenterY - 24;
          const rBotY = rCenterY + 24;
          return (
            <g>
              {/* Lead from top bus down to Resistor */}
              <line x1={x} y1={topY} x2={x} y2={rTopY} stroke={wireColor} strokeWidth="2.5" className={fl(isLoadActive)} />
              {/* Resistor R (Symmetrical clean zigzag) */}
              <path
                d={`M ${x},${rTopY} L ${x + 10},${rTopY + 8} L ${x - 10},${rTopY + 16} L ${x + 10},${rTopY + 24} L ${x - 10},${rTopY + 32} L ${x + 10},${rTopY + 40} L ${x},${rBotY}`}
                fill="none"
                stroke={compColor}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <text x={x + 18} y={rCenterY + 4} fill="var(--color-slate-200)" fontSize="12" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
                R={R}Ω
              </text>
              {/* Lead from Resistor down to bottom bus */}
              <line x1={x} y1={rBotY} x2={x} y2={botY} stroke={wireColor} strokeWidth="2.5" className={fl(isLoadActive)} />
            </g>
          );
        })()}

        {/* ----------------- CASE 2: RESISTOR-INDUCTOR (RL) ----------------- */}
        {shownLoad === 'RL' && (() => {
          const rTopY = topY + 24;
          const rBotY = topY + 68;
          const lTopY = topY + 92;
          const lBotY = topY + 148;
          return (
            <g>
              {/* Top bus to Resistor */}
              <line x1={x} y1={topY} x2={x} y2={rTopY} stroke={wireColor} strokeWidth="2.5" className={fl(isLoadActive)} />
              {/* Resistor R */}
              <path
                d={`M ${x},${rTopY} L ${x + 9},${rTopY + 7} L ${x - 9},${rTopY + 14} L ${x + 9},${rTopY + 21} L ${x - 9},${rTopY + 28} L ${x + 9},${rTopY + 35} L ${x},${rBotY}`}
                fill="none"
                stroke={compColor}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <text x={x + 16} y={rTopY + 26} fill="var(--color-slate-200)" fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
                R={R}Ω
              </text>
              {/* Continuous Wire between R and L */}
              <line x1={x} y1={rBotY} x2={x} y2={lTopY} stroke={wireColor} strokeWidth="2.5" className={fl(isLoadActive)} />
              {/* Inductor L: 3 Arched Loops */}
              <path
                d={`M ${x},${lTopY} C ${x + 15},${lTopY} ${x + 15},${lTopY + 18} ${x},${lTopY + 18} C ${x + 15},${lTopY + 18} ${x + 15},${lTopY + 36} ${x},${lTopY + 36} C ${x + 15},${lTopY + 36} ${x + 15},${lBotY} ${x},${lBotY}`}
                fill="none"
                stroke={compColor}
                strokeWidth="2.2"
              />
              <text x={x + 16} y={lTopY + 32} fill="var(--color-slate-200)" fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
                L={(L * 1000).toFixed(0)}mH
              </text>
              {/* Inductor down to bottom bus */}
              <line x1={x} y1={lBotY} x2={x} y2={botY} stroke={wireColor} strokeWidth="2.5" className={fl(isLoadActive)} />
            </g>
          );
        })()}

        {/* ----------------- CASE 3: RESISTOR-BATTERY (RE) ----------------- */}
        {shownLoad === 'RE' && (() => {
          const rTopY = topY + 24;
          const rBotY = topY + 68;
          const eCenterY = topY + 115;
          const ePosPlateY = eCenterY - 4;
          const eNegPlateY = eCenterY + 4;
          return (
            <g>
              {/* Top bus to Resistor */}
              <line x1={x} y1={topY} x2={x} y2={rTopY} stroke={wireColor} strokeWidth="2.5" className={fl(isLoadActive)} />
              {/* Resistor R */}
              <path
                d={`M ${x},${rTopY} L ${x + 9},${rTopY + 7} L ${x - 9},${rTopY + 14} L ${x + 9},${rTopY + 21} L ${x - 9},${rTopY + 28} L ${x + 9},${rTopY + 35} L ${x},${rBotY}`}
                fill="none"
                stroke={compColor}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <text x={x + 16} y={rTopY + 26} fill="var(--color-slate-200)" fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
                R={R}Ω
              </text>
              {/* Continuous Wire between R and Battery */}
              <line x1={x} y1={rBotY} x2={x} y2={ePosPlateY} stroke={wireColor} strokeWidth="2.5" className={fl(isLoadActive)} />
              {/* DC EMF Battery Plates: Long positive plate top, short thick negative plate bot */}
              <line x1={x - 15} y1={ePosPlateY} x2={x + 15} y2={ePosPlateY} stroke={compColor} strokeWidth="2.5" />
              <line x1={x - 9} y1={eNegPlateY} x2={x + 9} y2={eNegPlateY} stroke="var(--color-slate-400)" strokeWidth="3" />
              <text x={x + 20} y={eCenterY + 4} fill="var(--color-slate-200)" fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
                E={E}V
              </text>
              {/* Battery down to bottom bus */}
              <line x1={x} y1={eNegPlateY} x2={x} y2={botY} stroke={wireColor} strokeWidth="2.5" className={fl(isLoadActive)} />
            </g>
          );
        })()}

        {/* ----------------- CASE 4: RESISTOR-INDUCTOR-BATTERY (RLE) ----------------- */}
        {shownLoad === 'RLE' && (() => {
          const rTopY = topY + 16;
          const rBotY = topY + 54;
          const lTopY = topY + 70;
          const lBotY = topY + 116;
          const eCenterY = topY + 146;
          const ePosPlateY = eCenterY - 4;
          const eNegPlateY = eCenterY + 4;
          return (
            <g>
              {/* Top bus to Resistor */}
              <line x1={x} y1={topY} x2={x} y2={rTopY} stroke={wireColor} strokeWidth="2.5" className={fl(isLoadActive)} />
              {/* Resistor R */}
              <path
                d={`M ${x},${rTopY} L ${x + 8},${rTopY + 6} L ${x - 8},${rTopY + 12} L ${x + 8},${rTopY + 18} L ${x - 8},${rTopY + 24} L ${x + 8},${rTopY + 30} L ${x},${rBotY}`}
                fill="none"
                stroke={compColor}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <text x={x + 14} y={rTopY + 22} fill="var(--color-slate-200)" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
                R={R}Ω
              </text>
              {/* Continuous Wire between R and L */}
              <line x1={x} y1={rBotY} x2={x} y2={lTopY} stroke={wireColor} strokeWidth="2.5" className={fl(isLoadActive)} />
              {/* Inductor L */}
              <path
                d={`M ${x},${lTopY} C ${x + 14},${lTopY} ${x + 14},${lTopY + 15} ${x},${lTopY + 15} C ${x + 14},${lTopY + 15} ${x + 14},${lTopY + 30} ${x},${lTopY + 30} C ${x + 14},${lTopY + 30} ${x + 14},${lBotY} ${x},${lBotY}`}
                fill="none"
                stroke={compColor}
                strokeWidth="2"
              />
              <text x={x + 14} y={lTopY + 26} fill="var(--color-slate-200)" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
                L={(L * 1000).toFixed(0)}mH
              </text>
              {/* Continuous Wire between L and Battery */}
              <line x1={x} y1={lBotY} x2={x} y2={ePosPlateY} stroke={wireColor} strokeWidth="2.5" className={fl(isLoadActive)} />
              {/* Battery Plates */}
              <line x1={x - 14} y1={ePosPlateY} x2={x + 14} y2={ePosPlateY} stroke={compColor} strokeWidth="2.5" />
              <line x1={x - 8} y1={eNegPlateY} x2={x + 8} y2={eNegPlateY} stroke="var(--color-slate-400)" strokeWidth="3" />
              <text x={x + 18} y={eCenterY + 4} fill="var(--color-slate-200)" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
                E={E}V
              </text>
              {/* Battery down to bottom bus */}
              <line x1={x} y1={eNegPlateY} x2={x} y2={botY} stroke={wireColor} strokeWidth="2.5" className={fl(isLoadActive)} />
            </g>
          );
        })()}

        {/* ----------------- CASES 5-7: LOADS WITHOUT A RESISTOR (L, E, LE) -----------------
            The small parasitic resistance still limits the current but is not drawn. */}
        {(shownLoad === 'L' || shownLoad === 'E' || shownLoad === 'LE') && (() => {
          const hasL = shownLoad !== 'E';
          const hasE = shownLoad !== 'L';
          const mid = (topY + botY) / 2;
          const coilH = 54; // three loops of 18
          const coilTop = hasE ? mid - 66 : mid - coilH / 2;
          const coilBot = coilTop + coilH;
          const eCenterY = hasL ? mid + 50 : mid;
          const ePosPlateY = eCenterY - 4;
          const eNegPlateY = eCenterY + 4;
          const wireCls = fl(isLoadActive);
          const coilPath = `M ${x},${coilTop} ` + [0, 1, 2].map((k) => {
            const y0 = coilTop + k * 18;
            return `C ${x + 15},${y0} ${x + 15},${y0 + 18} ${x},${y0 + 18}`;
          }).join(' ');
          return (
            <g>
              {/* Top bus down to the first element */}
              <line x1={x} y1={topY} x2={x} y2={hasL ? coilTop : ePosPlateY} stroke={wireColor} strokeWidth="2.5" className={wireCls} />
              {hasL && (
                <g>
                  <path d={coilPath} fill="none" stroke={compColor} strokeWidth="2.2" />
                  <text x={x + 20} y={coilTop + 32} fill="var(--color-slate-200)" fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
                    L={(L * 1000).toFixed(0)}mH
                  </text>
                  <line x1={x} y1={coilBot} x2={x} y2={hasE ? ePosPlateY : botY} stroke={wireColor} strokeWidth="2.5" className={wireCls} />
                </g>
              )}
              {hasE && (
                <g>
                  <line x1={x - 14} y1={ePosPlateY} x2={x + 14} y2={ePosPlateY} stroke={compColor} strokeWidth="2.5" />
                  <line x1={x - 8} y1={eNegPlateY} x2={x + 8} y2={eNegPlateY} stroke="var(--color-slate-400)" strokeWidth="3" />
                  <text x={x + 18} y={eCenterY + 4} fill="var(--color-slate-200)" fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
                    E={E}V
                  </text>
                  <line x1={x} y1={eNegPlateY} x2={x} y2={botY} stroke={wireColor} strokeWidth="2.5" className={wireCls} />
                </g>
              )}
            </g>
          );
        })()}

        </g>

        {/* Bottom Terminal Junction with (-) Polar Mark */}
        {renderJunction(x, botY, isLoadActive)}

        {/* ----------------- PARALLEL LOAD VOLTMETER ----------------- */}
        <g transform={`translate(${x + 74}, ${(topY + botY) / 2})`}>
          {/* Top metering probe lead */}
          <path
            d={`M -74,${-((botY - topY) / 2)} L 0,${-((botY - topY) / 2)} L 0,-18`}
            fill="none"
            stroke="var(--color-sky-400)"
            strokeWidth="1.25"
            strokeDasharray="3 3"
          />
          {/* Voltmeter dial: just the "V" symbol, reading sits to its right */}
          <circle cx="0" cy="0" r="18" fill="var(--color-slate-900)" stroke="var(--color-sky-400)" strokeWidth="1.9" />
          <text x="0" y="5.5" fill="var(--color-sky-400)" fontSize="16" fontWeight="bold" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
            V
          </text>
          {/* Label + readout outside the dial */}
          <text x="0" y="-26" fill="var(--color-slate-400)" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
            V_LOAD
          </text>
          {/* Bottom metering probe lead */}
          <path
            d={`M 0,18 L 0,${(botY - topY) / 2} L -74,${(botY - topY) / 2}`}
            fill="none"
            stroke="var(--color-sky-400)"
            strokeWidth="1.25"
            strokeDasharray="3 3"
          />
          {/* Readout box sits below the dial (drawn last so it stays on top of the lead) */}
          <rect x="-33" y="28" width="66" height="20" rx="4" fill="var(--color-slate-900)" stroke="var(--color-sky-400)" strokeWidth="1.2" />
          <text x="0" y="42.5" fill="var(--color-sky-300)" fontSize="12" fontWeight="bold" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
            {vOut.toFixed(1)} V
          </text>
        </g>
      </g>
    );
  };

  // =========================================================================
  // FREEWHEELING DIODE BRANCH (D_FW) in parallel across the DC bus
  // Anode at botY, Cathode at topY (points UP)
  // =========================================================================
  const renderFwdBranch = (x: number, topY: number, botY: number, loadX?: number) => {
    const on = isFwdConducting || isDeviceOn('D_FW');
    return (
      <g>
        {/* Freewheeling loop: lights the rails between D_FW and the load */}
        {on && loadX !== undefined && (
          <g>
            <line x1={x} y1={topY} x2={loadX} y2={topY} stroke={wireActiveEmerald} strokeWidth="2.5" className={fl(true)} />
            <line x1={x} y1={botY} x2={loadX} y2={botY} stroke={wireActiveEmerald} strokeWidth="2.5" className={fl(true, -1)} />
          </g>
        )}
        {/* Top & Bot Junctions */}
        {renderJunction(x, topY, on)}
        {renderJunction(x, botY, on)}
        {/* Diode vertically wired from botY straight up to topY */}
        {renderDiodeVertical('d_fw', 'D_FW', x, topY, botY)}
      </g>
    );
  };

  // =========================================================================
  // THREE-PHASE Y-CONNECTED SOURCE: three AC sources joined at a common star point N.
  // Drawn in the same coordinate system as the phase lines; the sources' open terminals
  // connect to each phase line (wireEndX) and the star point to the neutral line (if any).
  // =========================================================================
  const renderWyeSource = (
    cx: number, busX: number, ys: [number, number, number], yN: number | null,
    flows: [number, number, number], wireEndX: number
  ) => {
    const r = 13;
    const wire = (a: boolean) => (a ? wireActiveEmerald : wireInactive);
    const cls = (a: boolean, d: 1 | -1 = 1) => fl(a, d);
    // Current in each star-bus segment = signed sum of the source currents above it
    // (+1 = phase feeds the circuit, -1 = phase returns current, 0 = idle)
    const p0 = flows[0];
    const p1 = flows[0] + flows[1];
    const p2 = flows[0] + flows[1] + flows[2];
    const segs: Array<[number, number, number]> = [[ys[0], ys[1], p0], [ys[1], ys[2], p1]];
    if (yN !== null) segs.push([ys[2], yN, p2]);
    const nodeOn = (i: number) => flows[i] !== 0 || (i > 0 && segs[i - 1][2] !== 0) || (i < segs.length && segs[i][2] !== 0);
    return (
      <g>
        {segs.map(([y1, y2, f], i) => (
          <line key={`wseg-${i}`} x1={busX} y1={y1} x2={busX} y2={y2} stroke={wire(f !== 0)} strokeWidth="2.5" className={cls(f !== 0, f > 0 ? -1 : 1)} />
        ))}
        {ys.map((y, i) => {
          const on = flows[i] !== 0;
          return (
            <g key={`wye-${i}`}>
              <line x1={busX} y1={y} x2={cx - r} y2={y} stroke={wire(on)} strokeWidth="2.5" className={cls(on, flows[i] > 0 ? 1 : -1)} />
              <circle cx={cx} cy={y} r={r} fill="var(--color-slate-900)" stroke="var(--color-sky-400)" strokeWidth="2" />
              <path d={`M ${cx - 7},${y} Q ${cx - 3.5},${y - 7} ${cx},${y} Q ${cx + 3.5},${y + 7} ${cx + 7},${y}`} fill="none" stroke="var(--color-sky-400)" strokeWidth="1.8" />
              <line x1={cx + r} y1={y} x2={wireEndX} y2={y} stroke={wire(on)} strokeWidth="2.5" className={cls(on, flows[i] > 0 ? 1 : -1)} />
              {renderJunction(busX, y, nodeOn(i))}
            </g>
          );
        })}
        {yN !== null ? (
          <g>
            <line x1={busX} y1={yN} x2={wireEndX} y2={yN} stroke={wire(p2 !== 0)} strokeWidth="2.5" className={cls(p2 !== 0, p2 > 0 ? -1 : 1)} />
            {renderJunction(busX, yN, p2 !== 0)}
          </g>
        ) : (
          <text x={busX} y={ys[2] + 18} fill="var(--color-slate-400)" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="JetBrains Mono, monospace">N</text>
        )}
      </g>
    );
  };


  // =========================================================================
  // THREE-PHASE BRIDGE: AC INPUT WIRING
  // Each phase gets its own horizontal lane through the gap between the upper and lower
  // device of the legs and attaches to the middle of ITS OWN leg only. A wire that has to
  // pass another leg hops over it, so no wire ever runs through a device.
  // (Coordinates are in the bridge's own frame: legs at x = 200 / 300 / 400.)
  // =========================================================================
  const BRIDGE_LEG_X = [200, 300, 400] as const;
  const BRIDGE_LANE_Y = [132, 160, 188] as const;
  const BRIDGE_SRC_Y = [110, 160, 210] as const;
  const BRIDGE_SRC_END_X = 100;

  const renderBridgeSource = (flows: [number, number, number]) => {
    const label = (txt: string, y: number, color: string) => (
      <text x="107" y={y} fill={color} fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">{txt}</text>
    );
    return (
      <g>
        {renderWyeSource(65, 39, [BRIDGE_SRC_Y[0], BRIDGE_SRC_Y[1], BRIDGE_SRC_Y[2]], null, flows, BRIDGE_SRC_END_X)}
        {label('Phase A', BRIDGE_SRC_Y[0] - 8, wirePhaseA)}
        {label('Phase B', BRIDGE_SRC_Y[1] - 8, wirePhaseB)}
        {label('Phase C', BRIDGE_SRC_Y[2] + 16, wirePhaseC)}
      </g>
    );
  };

  // top[i] / bot[i] = the upper / lower device of leg i is conducting.
  const renderBridgeFeeds = (top: [boolean, boolean, boolean], bot: [boolean, boolean, boolean]) => {
    const hop = 5;
    const jogX = 118;
    const on = [top[0] || bot[0], top[1] || bot[1], top[2] || bot[2]] as const;
    const midY = 160;
    // Short piece of leg between the phase lane and the leg midpoint: it only carries
    // current when the device on the far side of the midpoint is the one conducting.
    const stubActive = [bot[0], false, top[2]] as const;
    return (
      <g>
        {([0, 1, 2] as const).map((i) => {
          const y0 = BRIDGE_SRC_Y[i];
          const y1 = BRIDGE_LANE_Y[i];
          let d = `M ${BRIDGE_SRC_END_X},${y0}`;
          if (y0 !== y1) d += ` H ${jogX} V ${y1}`;
          // hop over every leg that lies between the source and this phase's own leg
          for (let j = 0; j < i; j++) {
            d += ` H ${BRIDGE_LEG_X[j] - hop} A ${hop} ${hop} 0 0 1 ${BRIDGE_LEG_X[j] + hop} ${y1}`;
          }
          d += ` H ${BRIDGE_LEG_X[i]}`;
          return (
            <path
              key={`bridge-feed-${i}`}
              d={d}
              fill="none"
              stroke={on[i] ? wireActiveEmerald : wireInactive}
              strokeWidth="2.5"
              strokeLinejoin="round"
              className={fl(on[i], top[i] ? 1 : -1)}
            />
          );
        })}
        {([0, 2] as const).map((i) => (
          <line
            key={`bridge-stub-${i}`}
            x1={BRIDGE_LEG_X[i]}
            y1={BRIDGE_LANE_Y[i]}
            x2={BRIDGE_LEG_X[i]}
            y2={midY}
            stroke={stubActive[i] ? wireActiveEmerald : wireInactive}
            strokeWidth={stubActive[i] ? 2.5 : 3.4}
            className={fl(stubActive[i], i === 0 ? -1 : 1)}
          />
        ))}
        {([0, 1, 2] as const).map((i) => renderJunction(BRIDGE_LEG_X[i], BRIDGE_LANE_Y[i], on[i]))}
      </g>
    );
  };

  // =========================================================================
  // AC SOURCE SYMBOL (Single Phase)
  // =========================================================================
  const renderAcSource = (x: number, y: number, label: string) => {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <circle cx="0" cy="0" r="18" fill="var(--color-slate-900)" stroke="var(--color-sky-400)" strokeWidth="2" />
        <path d="M -10,0 Q -5,-8 0,0 Q 5,8 10,0" fill="none" stroke="var(--color-sky-400)" strokeWidth="2" />
        <text
          x="-34"
          y="4"
          fill="var(--color-sky-400)"
          fontSize="12"
          fontWeight="bold"
          fontFamily="JetBrains Mono, monospace"
        >
          {label}
        </text>
      </g>
    );
  };

  // =========================================================================
  // SERIES DC AMMETER on top positive rail
  // =========================================================================
  const renderAmmeter = (x: number, y: number) => (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx="0" cy="0" r="14" fill="var(--color-slate-900)" stroke="var(--color-emerald-500)" strokeWidth="1.8" />
      <text x="0" y="4.5" fill="var(--color-emerald-400)" fontSize="13" fontWeight="bold" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
        A
      </text>
      {/* Readout outside the dial */}
      <rect x="-31" y="-42" width="62" height="20" rx="4" fill="var(--color-slate-900)" stroke="var(--color-emerald-500)" strokeWidth="1.2" />
      <text x="0" y="-28" fill="var(--color-emerald-300)" fontSize="12" fontWeight="bold" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
        {iOut.toFixed(1)} A
      </text>
    </g>
  );

  // =========================================================================
  // SUB-SCHEMATIC CIRCUIT RENDERER (ALL 10 CONVERTERS)
  // =========================================================================
  const renderCircuit = () => {
    switch (topologyId) {
      // ---------------------------------------------------------------------
      // 1. SINGLE-PHASE HALF-WAVE DIODE RECTIFIER
      // ---------------------------------------------------------------------
      case '1ph_hw_diode': {
        const d1On = isDeviceOn('D1');
        const topY = 70;
        const botY = 250;
        const loadX = 500;
        const fwdX = 420;

        return (
          <svg viewBox="0 0 740 330" className="w-full h-full schematic-svg mx-auto block">
            <defs>
              <pattern id="gridPattern1" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="var(--color-slate-700)" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern1)" />

            {/* Centered Circuit Diagram Group */}
            <g transform="translate(75, 0)">
              {/* AC Source */}
              {renderAcSource(80, 160, 'Vs')}
              {/* Source top terminal up to top rail */}
              <line x1="80" y1="142" x2="80" y2={topY} stroke={d1On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d1On)} />
              {/* Top rail to Diode Anode */}
              <line x1="80" y1={topY} x2="190" y2={topY} stroke={d1On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d1On)} />

              {/* Diode D1 (from 190 to 290) */}
              {renderDiodeHorizontal('d1', 'D1', topY, 190, 290)}

              {/* Diode Cathode to Ammeter and Load */}
              <line x1="290" y1={topY} x2={loadX} y2={topY} stroke={d1On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d1On)} />

              {/* Bottom Return Rail */}
              <line x1="80" y1="178" x2="80" y2={botY} stroke={d1On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d1On, -1)} />
              <line x1="80" y1={botY} x2={loadX} y2={botY} stroke={d1On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d1On, -1)} />

              {/* Freewheeling Diode (if toggled) */}
              {hasFreewheelingDiode && renderFwdBranch(fwdX, topY, botY, loadX)}
              {/* Ammeter sits in series with the load, to the right of D_FW */}
              {renderAmmeter(460, topY)}

              {/* Load Branch */}
              {renderLoadBranch(loadX, topY, botY)}
            </g>
          </svg>
        );
      }

      // ---------------------------------------------------------------------
      // 2. SINGLE-PHASE FULL-WAVE DIODE BRIDGE (GRAETZ BRIDGE)
      // ---------------------------------------------------------------------
      case '1ph_fw_diode_bridge': {
        const d1On = isDeviceOn('D1');
        const d2On = isDeviceOn('D2');
        const d3On = isDeviceOn('D3');
        const d4On = isDeviceOn('D4');

        const topRailActive = d1On || d3On;
        const botRailActive = d4On || d2On;

        const topY = 50;
        const midY = 160;
        const botY = 270;
        const leg1X = 220;
        const leg2X = 340;
        const fwdX = 420;
        const loadX = 520;

        return (
          <svg viewBox="0 0 740 330" className="w-full h-full schematic-svg mx-auto block">
            <defs>
              <pattern id="gridPattern2" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="var(--color-slate-700)" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern2)" />

            {/* Centered Circuit Diagram Group */}
            <g transform="translate(72, 0)">
              {/* AC Source at (70, 160) */}
              {renderAcSource(70, midY, 'Vs')}

              {/* Lead 1: From Vs top terminal to Leg 1 midpoint (220, 160) */}
              <line
                x1="88"
                y1={midY}
                x2={leg1X}
                y2={midY}
                stroke={d1On || d4On ? wireActiveEmerald : wireInactive}
                strokeWidth="2.5"
                className={fl(d1On || d4On, d1On ? 1 : -1)}
              />

              {/* Lead 2: From Vs bottom terminal (70, 178) directly into Leg 2 midpoint (340, 160)
                  Drops below bottom rail (Y=296), travels horizontally under Leg 1 with zero overlap to D4, hops cleanly over the bottom DC rail between legs at X=280, rises to Y=160, and connects into the green Leg 2 midpoint node! */}
              <path
                d={`M 70,178 L 70,296 L 280,296 L 280,278 A 8 8 0 0 1 280,262 L 280,${midY} L ${leg2X},${midY}`}
                fill="none"
                stroke={d3On || d2On ? wireActiveEmerald : wireInactive}
                strokeWidth="2.5"
                className={fl(d3On || d2On, d3On ? 1 : -1)}
              />

              {/* Leg 1: D1 Top (midY to topY), D4 Bot (botY to midY) */}
              {renderDiodeVertical('d1', 'D1', leg1X, topY, midY)}
              {renderDiodeVertical('d4', 'D4', leg1X, midY, botY)}

              {/* Leg 2: D3 Top (midY to topY), D2 Bot (botY to midY) */}
              {renderDiodeVertical('d3', 'D3', leg2X, topY, midY)}
              {renderDiodeVertical('d2', 'D2', leg2X, midY, botY)}

              {/* Top DC Positive Bus Segment 1: from Leg 1 to Leg 2 (glows ONLY if D1 is conducting) */}
              <line
                x1={leg1X}
                y1={topY}
                x2={leg2X}
                y2={topY}
                stroke={d1On ? wireActiveEmerald : wireInactive}
                strokeWidth="2.5"
                className={fl(d1On)}
              />

              {/* Top DC Positive Bus Segment 2: from Leg 2 to Load (glows if D1 or D3 conducting) */}
              <line
                x1={leg2X}
                y1={topY}
                x2={loadX - 60}
                y2={topY}
                stroke={topRailActive ? wireActiveEmerald : wireInactive}
                strokeWidth="2.5"
                className={fl(topRailActive)}
              />
              <line
                x1={loadX - 30}
                y1={topY}
                x2={loadX}
                y2={topY}
                stroke={topRailActive ? wireActiveEmerald : wireInactive}
                strokeWidth="2.5"
                className={fl(topRailActive)}
              />

              {/* Bottom DC Negative Bus Segment 1: from Leg 1 to Leg 2 (glows ONLY if D4 is conducting) with gap for Lead 2 jumper hop */}
              <line
                x1={leg1X}
                y1={botY}
                x2={274}
                y2={botY}
                stroke={d4On ? wireActiveEmerald : wireInactive}
                strokeWidth="2.5"
                className={fl(d4On, -1)}
              />
              <line
                x1={286}
                y1={botY}
                x2={leg2X}
                y2={botY}
                stroke={d4On ? wireActiveEmerald : wireInactive}
                strokeWidth="2.5"
                className={fl(d4On, -1)}
              />

              {/* Bottom DC Negative Bus Segment 2: from Leg 2 to Load (glows if D4 or D2 conducting) */}
              <line
                x1={leg2X}
                y1={botY}
                x2={loadX}
                y2={botY}
                stroke={botRailActive ? wireActiveEmerald : wireInactive}
                strokeWidth="2.5"
                className={fl(botRailActive, -1)}
              />

              {/* Solder Junction Dots - Rendered on TOP so connection nodes are crisp and visible */}
              {renderJunction(leg1X, midY, d1On || d4On)}
              {/* The Green Point at Leg 2 midpoint: */}
              {renderJunction(leg2X, midY, d3On || d2On)}
              {renderJunction(leg1X, topY, d1On)}
              {renderJunction(leg2X, topY, d1On || d3On)}
              {renderJunction(leg1X, botY, d4On)}
              {renderJunction(leg2X, botY, d4On || d2On)}

              {/* Freewheeling Diode (if toggled) */}
              {hasFreewheelingDiode && renderFwdBranch(fwdX, topY, botY, loadX)}
              {/* Ammeter sits in series with the load, to the right of D_FW */}
              {renderAmmeter(loadX - 45, topY)}

              {/* Load Branch */}
              {renderLoadBranch(loadX, topY, botY)}
            </g>
          </svg>
        );
      }

      // ---------------------------------------------------------------------
      // 3. SINGLE-PHASE HALF-WAVE THYRISTOR RECTIFIER
      // ---------------------------------------------------------------------
      case '1ph_hw_thyristor': {
        const t1On = isDeviceOn('T1');
        const topY = 70;
        const botY = 250;
        const loadX = 500;
        const fwdX = 420;

        return (
          <svg viewBox="0 0 740 330" className="w-full h-full schematic-svg mx-auto block">
            <defs>
              <pattern id="gridPattern3" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="var(--color-slate-700)" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern3)" />

            {/* Centered Circuit Diagram Group */}
            <g transform="translate(75, 0)">
              {/* AC Source */}
              {renderAcSource(80, 160, 'Vs')}
              <line x1="80" y1="142" x2="80" y2={topY} stroke={t1On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t1On)} />
              <line x1="80" y1={topY} x2="190" y2={topY} stroke={t1On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t1On)} />

              {/* Thyristor T1 */}
              {renderThyristorHorizontal('t1', 'T1', topY, 190, 290)}

              {/* Cathode to Ammeter and Load */}
              <line x1="290" y1={topY} x2={loadX} y2={topY} stroke={t1On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t1On)} />

              {/* Bottom Return Rail */}
              <line x1="80" y1="178" x2="80" y2={botY} stroke={t1On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t1On, -1)} />
              <line x1="80" y1={botY} x2={loadX} y2={botY} stroke={t1On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t1On, -1)} />

              {/* Freewheeling Diode (if toggled) */}
              {hasFreewheelingDiode && renderFwdBranch(fwdX, topY, botY, loadX)}
              {/* Ammeter sits in series with the load, to the right of D_FW */}
              {renderAmmeter(460, topY)}

              {/* Load Branch */}
              {renderLoadBranch(loadX, topY, botY)}
            </g>
          </svg>
        );
      }

      // ---------------------------------------------------------------------
      // 4. SINGLE-PHASE FULLY CONTROLLED BRIDGE
      // ---------------------------------------------------------------------
      case '1ph_fw_fully_controlled': {
        const t1On = isDeviceOn('T1');
        const t2On = isDeviceOn('T2');
        const t3On = isDeviceOn('T3');
        const t4On = isDeviceOn('T4');

        const topRailActive = t1On || t3On;
        const botRailActive = t4On || t2On;

        const topY = 50;
        const midY = 160;
        const botY = 270;
        const leg1X = 220;
        const leg2X = 340;
        const fwdX = 420;
        const loadX = 520;

        return (
          <svg viewBox="0 0 740 330" className="w-full h-full schematic-svg mx-auto block">
            <defs>
              <pattern id="gridPattern4" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="var(--color-slate-700)" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern4)" />

            {/* Centered Circuit Diagram Group */}
            <g transform="translate(72, 0)">
              {/* AC Source */}
              {renderAcSource(70, midY, 'Vs')}

              {/* Lead 1: From Vs top terminal to Leg 1 midpoint (220, 160) */}
              <line
                x1="88"
                y1={midY}
                x2={leg1X}
                y2={midY}
                stroke={t1On || t4On ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(t1On || t4On, t1On ? 1 : -1)}
              />

              {/* Lead 2: From Vs bottom terminal (70, 178) directly into Leg 2 midpoint (340, 160)
                  Drops below the bottom rail (Y=296), travels horizontally under Leg 1 with ZERO overlap to T4, hops cleanly over the bottom DC rail between legs at X=280, rises to Y=160, and connects into the green Leg 2 midpoint node! */}
              <path
                d={`M 70,178 L 70,296 L 280,296 L 280,278 A 8 8 0 0 1 280,262 L 280,${midY} L ${leg2X},${midY}`}
                fill="none"
                stroke={t3On || t2On ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(t3On || t2On, t3On ? 1 : -1)}
              />

              {/* Leg 1: T1 Top, T4 Bot */}
              {renderThyristorVertical('t1', 'T1', leg1X, topY, midY)}
              {renderThyristorVertical('t4', 'T4', leg1X, midY, botY)}

              {/* Leg 2: T3 Top, T2 Bot */}
              {renderThyristorVertical('t3', 'T3', leg2X, topY, midY)}
              {renderThyristorVertical('t2', 'T2', leg2X, midY, botY)}

              {/* Top DC Positive Bus Segment 1: from Leg 1 to Leg 2 (glows ONLY if T1 is conducting) */}
              <line
                x1={leg1X}
                y1={topY}
                x2={leg2X}
                y2={topY}
                stroke={t1On ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(t1On)}
              />

              {/* Top DC Positive Bus Segment 2: from Leg 2 through Ammeter to Load (glows if T1 or T3 conducting) */}
              <line
                x1={leg2X}
                y1={topY}
                x2={loadX - 60}
                y2={topY}
                stroke={topRailActive ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(topRailActive)}
              />
              <line
                x1={loadX - 30}
                y1={topY}
                x2={loadX}
                y2={topY}
                stroke={topRailActive ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(topRailActive)}
              />

              {/* Bottom DC Negative Bus Segment 1: from Leg 1 to Leg 2 (glows ONLY if T4 is conducting) with gap for Lead 2 jumper hop */}
              <line
                x1={leg1X}
                y1={botY}
                x2={274}
                y2={botY}
                stroke={t4On ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(t4On, -1)}
              />
              <line
                x1={286}
                y1={botY}
                x2={leg2X}
                y2={botY}
                stroke={t4On ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(t4On, -1)}
              />

              {/* Bottom DC Negative Bus Segment 2: from Leg 2 to Load (glows if T4 or T2 conducting) */}
              <line
                x1={leg2X}
                y1={botY}
                x2={loadX}
                y2={botY}
                stroke={botRailActive ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(botRailActive, -1)}
              />

              {/* Solder Junction Dots - Rendered on TOP so connection nodes are crisp and visible */}
              {renderJunction(leg1X, midY, t1On || t4On)}
              {/* The Green Point at Leg 2 midpoint: */}
              {renderJunction(leg2X, midY, t3On || t2On)}
              {renderJunction(leg1X, topY, t1On)}
              {renderJunction(leg2X, topY, t1On || t3On)}
              {renderJunction(leg1X, botY, t4On)}
              {renderJunction(leg2X, botY, t4On || t2On)}

              {/* Freewheeling Diode (if toggled) */}
              {hasFreewheelingDiode && renderFwdBranch(fwdX, topY, botY, loadX)}
              {/* Ammeter sits in series with the load, to the right of D_FW */}
              {renderAmmeter(loadX - 45, topY)}

              {/* Load Branch */}
              {renderLoadBranch(loadX, topY, botY)}
            </g>
          </svg>
        );
      }

      // ---------------------------------------------------------------------
      // 5. SINGLE-PHASE SEMI-CONTROLLED BRIDGE
      // ---------------------------------------------------------------------
      case '1ph_fw_semi_controlled': {
        const isAsym = semiConfig === 'asymmetric';
        const t1On = isDeviceOn('T1');
        const t2On = isDeviceOn('T2');
        const d1On = isDeviceOn('D1');
        const d2On = isDeviceOn('D2');

        // Device positions in the bridge
        //   SYMMETRIC : Leg A = T1 (top) / D1 (bottom),  Leg B = T2 (top) / D2 (bottom)
        //   ASYMMETRIC: Leg A = T1 (top) / T2 (bottom),  Leg B = D1 (top) / D2 (bottom)
        const topLeftOn = t1On;
        const topRightOn = isAsym ? d1On : t2On;
        const botLeftOn = isAsym ? t2On : d1On;
        const botRightOn = d2On;

        const nodeAOn = topLeftOn || botLeftOn;
        const nodeBOn = topRightOn || botRightOn;
        // Source only carries current while the SCR and its diagonal diode feed the load;
        // during freewheeling the load is shorted by the bridge itself (Is = 0).
        const srcFeeding = (t1On && d2On) || (t2On && d1On);

        const topRailActive = topLeftOn || topRightOn;
        const botRailActive = botLeftOn || botRightOn;

        const topY = 50;
        const midY = 160;
        const botY = 270;
        const leg1X = 220;
        const leg2X = 340;
        const loadX = 520;

        return (
          <svg viewBox="104 0 590 330" className="w-full h-full schematic-svg mx-auto block">
            <defs>
              <pattern id="gridPattern5" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="var(--color-slate-700)" opacity="0.4" />
              </pattern>
            </defs>
            <rect x="-200" width="1200" height="100%" fill="url(#gridPattern5)" />

            {/* Centered Circuit Diagram Group */}
            <g transform="translate(72, 0)">
              {/* AC Source */}
              {renderAcSource(70, midY, 'Vs')}

              {/* Lead 1: From Vs top terminal to Leg A midpoint */}
              <line
                x1="88"
                y1={midY}
                x2={leg1X}
                y2={midY}
                stroke={srcFeeding ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(srcFeeding, t1On ? 1 : -1)}
              />

              {/* Lead 2: From Vs bottom terminal (70, 178) into Leg B midpoint (340, 160).
                  Drops below the bottom rail, travels under Leg A, hops over the bottom DC rail at X=280,
                  rises to Y=160 and connects into the Leg B midpoint node. */}
              <path
                d={`M 70,178 L 70,296 L 280,296 L 280,278 A 8 8 0 0 1 280,262 L 280,${midY} L ${leg2X},${midY}`}
                fill="none"
                stroke={srcFeeding ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(srcFeeding, t1On ? -1 : 1)}
              />

              {/* Leg A (left) */}
              {renderThyristorVertical('t1', 'T1', leg1X, topY, midY)}
              {isAsym
                ? renderThyristorVertical('t2', 'T2', leg1X, midY, botY)
                : renderDiodeVertical('d1', 'D1', leg1X, midY, botY)}

              {/* Leg B (right) */}
              {isAsym
                ? renderDiodeVertical('d1', 'D1', leg2X, topY, midY)
                : renderThyristorVertical('t2', 'T2', leg2X, topY, midY)}
              {renderDiodeVertical('d2', 'D2', leg2X, midY, botY)}

              {/* Top DC Positive Bus Segment 1: Leg A top -> Leg B top (carries current only if the top-left device conducts) */}
              <line
                x1={leg1X}
                y1={topY}
                x2={leg2X}
                y2={topY}
                stroke={topLeftOn ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(topLeftOn)}
              />

              {/* Top DC Positive Bus Segment 2: Leg B top -> Load */}
              <line
                x1={leg2X}
                y1={topY}
                x2={loadX - 60}
                y2={topY}
                stroke={topRailActive ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(topRailActive)}
              />
              <line
                x1={loadX - 30}
                y1={topY}
                x2={loadX}
                y2={topY}
                stroke={topRailActive ? wireActiveAmber : wireInactive}
                strokeWidth="2.5"
                className={fl(topRailActive)}
              />

              {/* Bottom DC Negative Bus Segment 1: Leg A bottom -> Leg B bottom (gap at X=280 for the Lead 2 jumper hop) */}
              <line
                x1={leg1X}
                y1={botY}
                x2={274}
                y2={botY}
                stroke={botLeftOn ? wireActiveEmerald : wireInactive}
                strokeWidth="2.5"
                className={fl(botLeftOn, -1)}
              />
              <line
                x1={286}
                y1={botY}
                x2={leg2X}
                y2={botY}
                stroke={botLeftOn ? wireActiveEmerald : wireInactive}
                strokeWidth="2.5"
                className={fl(botLeftOn, -1)}
              />

              {/* Bottom DC Negative Bus Segment 2: Leg B bottom -> Load */}
              <line
                x1={leg2X}
                y1={botY}
                x2={loadX}
                y2={botY}
                stroke={botRailActive ? wireActiveEmerald : wireInactive}
                strokeWidth="2.5"
                className={fl(botRailActive, -1)}
              />

              {/* Solder Junction Dots - rendered last so connection nodes stay crisp */}
              {renderJunction(leg1X, midY, nodeAOn)}
              {renderJunction(leg2X, midY, nodeBOn)}
              {renderJunction(leg1X, topY, topLeftOn)}
              {renderJunction(leg2X, topY, topRailActive)}
              {renderJunction(leg1X, botY, botLeftOn)}
              {renderJunction(leg2X, botY, botRailActive)}

              {/* Load Branch */}
              {/* Freewheeling Diode (if toggled) */}
              {hasFreewheelingDiode && renderFwdBranch(430, topY, botY, loadX)}
              {/* Ammeter sits in series with the load, to the right of D_FW */}
              {renderAmmeter(loadX - 45, topY)}
              {renderLoadBranch(loadX, topY, botY)}
            </g>
          </svg>
        );
      }

      // ---------------------------------------------------------------------
      // 6. THREE-PHASE HALF-WAVE DIODE RECTIFIER
      // ---------------------------------------------------------------------
      case '3ph_hw_diode': {
        const d1On = isDeviceOn('D1');
        const d2On = isDeviceOn('D2');
        const d3On = isDeviceOn('D3');
        const anyOn = d1On || d2On || d3On;

        const yPhaseA = 70;
        const yPhaseB = 125;
        const yPhaseC = 180;
        const yNeutral = 265;
        const xCathodeBus = 380;
        const loadX = 520;

        return (
          <svg viewBox="0 0 740 330" className="w-full h-full schematic-svg mx-auto block">
            <defs>
              <pattern id="gridPattern6" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="var(--color-slate-700)" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern6)" />

            {/* Centered Circuit Diagram Group */}
            <g transform="translate(70, 0)">
              {/* 3 Phase Labels on Left */}
              <g transform="translate(40, 0)">
                {renderWyeSource(-20, -46, [yPhaseA, yPhaseB, yPhaseC], yNeutral, [d1On ? 1 : 0, d2On ? 1 : 0, d3On ? 1 : 0], 68)}

                <text x="76" y={yPhaseA - 8} fill={wirePhaseA} fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">Phase A</text>
                <text x="76" y={yPhaseB - 8} fill={wirePhaseB} fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">Phase B</text>
                <text x="76" y={yPhaseC - 8} fill={wirePhaseC} fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">Phase C</text>
                <text x="76" y={yNeutral - 8} fill="var(--color-slate-400)" fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">Neutral N</text>

                {/* Source feed lines straight into each Diode Anode at X=210 */}
                <line x1="68" y1={yPhaseA} x2="210" y2={yPhaseA} stroke={d1On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d1On)} />
                <line x1="68" y1={yPhaseB} x2="210" y2={yPhaseB} stroke={d2On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d2On)} />
                <line x1="68" y1={yPhaseC} x2="210" y2={yPhaseC} stroke={d3On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d3On)} />
                <line x1="68" y1={yNeutral} x2={loadX} y2={yNeutral} stroke={anyOn ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(anyOn, -1)} />
              </g>

              {/* 3 Horizontal Diodes (from X=210 to X=310) */}
              {renderDiodeHorizontal('d1', 'D1', yPhaseA, 210, 310)}
              {renderDiodeHorizontal('d2', 'D2', yPhaseB, 210, 310)}
              {renderDiodeHorizontal('d3', 'D3', yPhaseC, 210, 310)}

              {/* Cathode leads to common vertical Cathode Bus at xCathodeBus */}
              <line x1="310" y1={yPhaseA} x2={xCathodeBus} y2={yPhaseA} stroke={d1On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d1On)} />
              <line x1="310" y1={yPhaseB} x2={xCathodeBus} y2={yPhaseB} stroke={d2On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d2On)} />
              <line x1="310" y1={yPhaseC} x2={xCathodeBus} y2={yPhaseC} stroke={d3On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d3On)} />

              {/* Vertical Common Cathode Bus */}
              {/* Cathode bus: segment A-B carries current only if B or C conducts; B-C only if C conducts */}
              <line x1={xCathodeBus} y1={yPhaseA} x2={xCathodeBus} y2={yPhaseB} stroke={d2On || d3On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d2On || d3On, -1)} />
              <line x1={xCathodeBus} y1={yPhaseB} x2={xCathodeBus} y2={yPhaseC} stroke={d3On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d3On, -1)} />
              {renderJunction(xCathodeBus, yPhaseA, anyOn)}
              {renderJunction(xCathodeBus, yPhaseB, d2On || d3On)}
              {renderJunction(xCathodeBus, yPhaseC, d3On)}

              {/* Top DC Rail from Cathode Bus to Load */}
              <line x1={xCathodeBus} y1={yPhaseA} x2={loadX - 50} y2={yPhaseA} stroke={anyOn ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(anyOn)} />
              <line x1={loadX - 20} y1={yPhaseA} x2={loadX} y2={yPhaseA} stroke={anyOn ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(anyOn)} />

              {/* Load Branch between yPhaseA and yNeutral */}
              {/* Freewheeling Diode (if toggled) */}
              {hasFreewheelingDiode && renderFwdBranch(445, yPhaseA, yNeutral, loadX)}
              {/* Ammeter sits in series with the load, to the right of D_FW */}
              {renderAmmeter(loadX - 35, yPhaseA)}
              {renderLoadBranch(loadX, yPhaseA, yNeutral)}
            </g>
          </svg>
        );
      }

      // ---------------------------------------------------------------------
      // 7. THREE-PHASE HALF-WAVE THYRISTOR RECTIFIER
      // ---------------------------------------------------------------------
      case '3ph_hw_thyristor': {
        const t1On = isDeviceOn('T1');
        const t2On = isDeviceOn('T2');
        const t3On = isDeviceOn('T3');
        const anyOn = t1On || t2On || t3On;

        const yPhaseA = 70;
        const yPhaseB = 125;
        const yPhaseC = 180;
        const yNeutral = 265;
        const xCathodeBus = 380;
        const loadX = 520;

        return (
          <svg viewBox="0 0 740 330" className="w-full h-full schematic-svg mx-auto block">
            <defs>
              <pattern id="gridPattern7" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="var(--color-slate-700)" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern7)" />

            {/* Centered Circuit Diagram Group */}
            <g transform="translate(70, 0)">
              {/* 3 Phase Labels on Left */}
              <g transform="translate(40, 0)">
                {renderWyeSource(-20, -46, [yPhaseA, yPhaseB, yPhaseC], yNeutral, [t1On ? 1 : 0, t2On ? 1 : 0, t3On ? 1 : 0], 68)}

                <text x="76" y={yPhaseA - 8} fill={wirePhaseA} fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">Phase A</text>
                <text x="76" y={yPhaseB - 8} fill={wirePhaseB} fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">Phase B</text>
                <text x="76" y={yPhaseC - 8} fill={wirePhaseC} fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">Phase C</text>
                <text x="76" y={yNeutral - 8} fill="var(--color-slate-400)" fontSize="11" fontWeight="bold" fontFamily="JetBrains Mono, monospace">Neutral N</text>

                {/* Source feed lines into Thyristor Anodes at X=210 */}
                <line x1="68" y1={yPhaseA} x2="210" y2={yPhaseA} stroke={t1On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(t1On)} />
                <line x1="68" y1={yPhaseB} x2="210" y2={yPhaseB} stroke={t2On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(t2On)} />
                <line x1="68" y1={yPhaseC} x2="210" y2={yPhaseC} stroke={t3On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(t3On)} />
                <line x1="68" y1={yNeutral} x2={loadX} y2={yNeutral} stroke={anyOn ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(anyOn, -1)} />
              </g>

              {/* 3 Horizontal Thyristors */}
              {renderThyristorHorizontal('t1', 'T1', yPhaseA, 210, 310)}
              {renderThyristorHorizontal('t2', 'T2', yPhaseB, 210, 310)}
              {renderThyristorHorizontal('t3', 'T3', yPhaseC, 210, 310)}

              {/* Cathode leads to common Cathode Bus */}
              <line x1="310" y1={yPhaseA} x2={xCathodeBus} y2={yPhaseA} stroke={t1On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t1On)} />
              <line x1="310" y1={yPhaseB} x2={xCathodeBus} y2={yPhaseB} stroke={t2On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t2On)} />
              <line x1="310" y1={yPhaseC} x2={xCathodeBus} y2={yPhaseC} stroke={t3On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t3On)} />

              {/* Vertical Common Cathode Bus */}
              {/* Cathode bus: segment A-B carries current only if B or C conducts; B-C only if C conducts */}
              <line x1={xCathodeBus} y1={yPhaseA} x2={xCathodeBus} y2={yPhaseB} stroke={t2On || t3On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(t2On || t3On, -1)} />
              <line x1={xCathodeBus} y1={yPhaseB} x2={xCathodeBus} y2={yPhaseC} stroke={t3On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(t3On, -1)} />
              {renderJunction(xCathodeBus, yPhaseA, anyOn)}
              {renderJunction(xCathodeBus, yPhaseB, t2On || t3On)}
              {renderJunction(xCathodeBus, yPhaseC, t3On)}

              {/* Top DC Rail from Cathode Bus to Load */}
              <line x1={xCathodeBus} y1={yPhaseA} x2={loadX - 50} y2={yPhaseA} stroke={anyOn ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(anyOn)} />
              <line x1={loadX - 20} y1={yPhaseA} x2={loadX} y2={yPhaseA} stroke={anyOn ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(anyOn)} />

              {/* Load Branch */}
              {/* Freewheeling Diode (if toggled) */}
              {hasFreewheelingDiode && renderFwdBranch(445, yPhaseA, yNeutral, loadX)}
              {/* Ammeter sits in series with the load, to the right of D_FW */}
              {renderAmmeter(loadX - 35, yPhaseA)}
              {renderLoadBranch(loadX, yPhaseA, yNeutral)}
            </g>
          </svg>
        );
      }

      // ---------------------------------------------------------------------
      // 8. THREE-PHASE DIODE BRIDGE (6-PULSE)
      // ---------------------------------------------------------------------
      case '3ph_fw_diode_bridge': {
        const d1On = isDeviceOn('D1');
        const d2On = isDeviceOn('D2');
        const d3On = isDeviceOn('D3');
        const d4On = isDeviceOn('D4');
        const d5On = isDeviceOn('D5');
        const d6On = isDeviceOn('D6');

        const topRailActive = d1On || d3On || d5On;
        const botRailActive = d4On || d6On || d2On;

        const topY = 50;
        const midY = 160;
        const botY = 270;
        const legAX = 200;
        const legBX = 300;
        const legCX = 400;
        const loadX = 540;

        return (
          <svg viewBox="0 0 740 330" className="w-full h-full schematic-svg mx-auto block">
            <defs>
              <pattern id="gridPattern8" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="var(--color-slate-700)" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern8)" />

            {/* Centered Circuit Diagram Group */}
            <g transform="translate(65, 0)">
              {/* Three-phase star source (floating neutral) */}
              {renderBridgeSource([d1On ? 1 : d4On ? -1 : 0, d3On ? 1 : d6On ? -1 : 0, d5On ? 1 : d2On ? -1 : 0])}

              {/* Leg A: Top D1, Bot D4 */}
              {renderDiodeVertical('d1', 'D1', legAX, topY, midY)}
              {renderDiodeVertical('d4', 'D4', legAX, midY, botY)}

              {/* Leg B: Top D3, Bot D6 */}
              {renderDiodeVertical('d3', 'D3', legBX, topY, midY)}
              {renderDiodeVertical('d6', 'D6', legBX, midY, botY)}

              {/* Leg C: Top D5, Bot D2 */}
              {renderDiodeVertical('d5', 'D5', legCX, topY, midY)}
              {renderDiodeVertical('d2', 'D2', legCX, midY, botY)}

              {/* AC feeds: one lane per phase, attached to the middle of its own leg */}
              {renderBridgeFeeds([d1On, d3On, d5On], [d4On, d6On, d2On])}

              {/* Top DC Positive Bus Segment 1: from Leg A to Leg B (glows ONLY if D1 is conducting) */}
              <line x1={legAX} y1={topY} x2={legBX} y2={topY} stroke={d1On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d1On)} />

              {/* Top DC Positive Bus Segment 2: from Leg B to Leg C (glows if D1 or D3 conducting) */}
              <line x1={legBX} y1={topY} x2={legCX} y2={topY} stroke={d1On || d3On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d1On || d3On)} />

              {/* Top DC Positive Bus Segment 3: from Leg C to Load (glows if D1, D3 or D5 conducting) */}
              <line x1={legCX} y1={topY} x2={loadX - 55} y2={topY} stroke={topRailActive ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(topRailActive)} />
              <line x1={loadX - 25} y1={topY} x2={loadX} y2={topY} stroke={topRailActive ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(topRailActive)} />

              {/* Bottom DC Negative Bus Segment 1: from Leg A to Leg B (glows ONLY if D4 is conducting) */}
              <line x1={legAX} y1={botY} x2={legBX} y2={botY} stroke={d4On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d4On, -1)} />

              {/* Bottom DC Negative Bus Segment 2: from Leg B to Leg C (glows if D4 or D6 conducting) */}
              <line x1={legBX} y1={botY} x2={legCX} y2={botY} stroke={d4On || d6On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d4On || d6On, -1)} />

              {/* Bottom DC Negative Bus Segment 3: from Leg C to Load (glows if D4, D6 or D2 conducting) */}
              <line x1={legCX} y1={botY} x2={loadX} y2={botY} stroke={botRailActive ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(botRailActive, -1)} />

              {/* Solder Junction Nodes on TOP */}
              {renderJunction(legAX, topY, d1On)}
              {renderJunction(legBX, topY, d1On || d3On)}
              {renderJunction(legCX, topY, d1On || d3On || d5On)}
              {renderJunction(legAX, botY, d4On)}
              {renderJunction(legBX, botY, d4On || d6On)}
              {renderJunction(legCX, botY, d4On || d6On || d2On)}

              {/* Load Branch */}
              {/* Freewheeling Diode (if toggled) */}
              {hasFreewheelingDiode && renderFwdBranch(470, topY, botY, loadX)}
              {/* Ammeter sits in series with the load, to the right of D_FW */}
              {renderAmmeter(loadX - 40, topY)}
              {renderLoadBranch(loadX, topY, botY)}
            </g>
          </svg>
        );
      }

      // ---------------------------------------------------------------------
      // 9. THREE-PHASE SEMI-CONTROLLED BRIDGE
      // ---------------------------------------------------------------------
      case '3ph_fw_semi_controlled': {
        const t1On = isDeviceOn('T1');
        const t3On = isDeviceOn('T3');
        const t5On = isDeviceOn('T5');
        const d4On = isDeviceOn('D4');
        const d6On = isDeviceOn('D6');
        const d2On = isDeviceOn('D2');

        const topRailActive = t1On || t3On || t5On;
        const botRailActive = d4On || d6On || d2On;

        const topY = 50;
        const midY = 160;
        const botY = 270;
        const legAX = 200;
        const legBX = 300;
        const legCX = 400;
        const loadX = 540;

        return (
          <svg viewBox="0 0 740 330" className="w-full h-full schematic-svg mx-auto block">
            <defs>
              <pattern id="gridPattern9" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="var(--color-slate-700)" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern9)" />

            {/* Centered Circuit Diagram Group */}
            <g transform="translate(65, 0)">
              {/* Three-phase star source (floating neutral) */}
              {renderBridgeSource([t1On ? 1 : d4On ? -1 : 0, t3On ? 1 : d6On ? -1 : 0, t5On ? 1 : d2On ? -1 : 0])}

              {/* Leg A: Top T1 (SCR), Bot D4 (Diode) */}
              {renderThyristorVertical('t1', 'T1', legAX, topY, midY)}
              {renderDiodeVertical('d4', 'D4', legAX, midY, botY)}

              {/* Leg B: Top T3 (SCR), Bot D6 (Diode) */}
              {renderThyristorVertical('t3', 'T3', legBX, topY, midY)}
              {renderDiodeVertical('d6', 'D6', legBX, midY, botY)}

              {/* Leg C: Top T5 (SCR), Bot D2 (Diode) */}
              {renderThyristorVertical('t5', 'T5', legCX, topY, midY)}
              {renderDiodeVertical('d2', 'D2', legCX, midY, botY)}

              {/* AC feeds: one lane per phase, attached to the middle of its own leg */}
              {renderBridgeFeeds([t1On, t3On, t5On], [d4On, d6On, d2On])}

              {/* Top DC Positive Bus Segment 1: from Leg A to Leg B (glows ONLY if T1 is conducting) */}
              <line x1={legAX} y1={topY} x2={legBX} y2={topY} stroke={t1On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t1On)} />

              {/* Top DC Positive Bus Segment 2: from Leg B to Leg C (glows if T1 or T3 conducting) */}
              <line x1={legBX} y1={topY} x2={legCX} y2={topY} stroke={t1On || t3On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t1On || t3On)} />

              {/* Top DC Positive Bus Segment 3: from Leg C to Load (glows if T1, T3 or T5 conducting) */}
              <line x1={legCX} y1={topY} x2={loadX - 55} y2={topY} stroke={topRailActive ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(topRailActive)} />
              <line x1={loadX - 25} y1={topY} x2={loadX} y2={topY} stroke={topRailActive ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(topRailActive)} />

              {/* Bottom DC Negative Bus Segment 1: from Leg A to Leg B (glows ONLY if D4 is conducting) */}
              <line x1={legAX} y1={botY} x2={legBX} y2={botY} stroke={d4On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d4On, -1)} />

              {/* Bottom DC Negative Bus Segment 2: from Leg B to Leg C (glows if D4 or D6 conducting) */}
              <line x1={legBX} y1={botY} x2={legCX} y2={botY} stroke={d4On || d6On ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(d4On || d6On, -1)} />

              {/* Bottom DC Negative Bus Segment 3: from Leg C to Load (glows if D4, D6 or D2 conducting) */}
              <line x1={legCX} y1={botY} x2={loadX} y2={botY} stroke={botRailActive ? wireActiveEmerald : wireInactive} strokeWidth="2.5" className={fl(botRailActive, -1)} />

              {/* Solder Junction Nodes on TOP */}
              {renderJunction(legAX, topY, t1On)}
              {renderJunction(legBX, topY, t1On || t3On)}
              {renderJunction(legCX, topY, t1On || t3On || t5On)}
              {renderJunction(legAX, botY, d4On)}
              {renderJunction(legBX, botY, d4On || d6On)}
              {renderJunction(legCX, botY, d4On || d6On || d2On)}

              {/* Load Branch */}
              {/* Freewheeling Diode (if toggled) */}
              {hasFreewheelingDiode && renderFwdBranch(470, topY, botY, loadX)}
              {/* Ammeter sits in series with the load, to the right of D_FW */}
              {renderAmmeter(loadX - 40, topY)}
              {renderLoadBranch(loadX, topY, botY)}
            </g>
          </svg>
        );
      }

      // ---------------------------------------------------------------------
      // 10. THREE-PHASE FULLY CONTROLLED BRIDGE (6-PULSE)
      // ---------------------------------------------------------------------
      case '3ph_fw_fully_controlled': {
        const t1On = isDeviceOn('T1');
        const t2On = isDeviceOn('T2');
        const t3On = isDeviceOn('T3');
        const t4On = isDeviceOn('T4');
        const t5On = isDeviceOn('T5');
        const t6On = isDeviceOn('T6');

        const topRailActive = t1On || t3On || t5On;
        const botRailActive = t4On || t6On || t2On;

        const topY = 50;
        const midY = 160;
        const botY = 270;
        const legAX = 200;
        const legBX = 300;
        const legCX = 400;
        const loadX = 540;

        return (
          <svg viewBox="0 0 740 330" className="w-full h-full schematic-svg mx-auto block">
            <defs>
              <pattern id="gridPattern10" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="var(--color-slate-700)" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern10)" />

            {/* Centered Circuit Diagram Group */}
            <g transform="translate(65, 0)">
              {/* Three-phase star source (floating neutral) */}
              {renderBridgeSource([t1On ? 1 : t4On ? -1 : 0, t3On ? 1 : t6On ? -1 : 0, t5On ? 1 : t2On ? -1 : 0])}

              {/* Leg A: Top T1, Bot T4 */}
              {renderThyristorVertical('t1', 'T1', legAX, topY, midY)}
              {renderThyristorVertical('t4', 'T4', legAX, midY, botY)}

              {/* Leg B: Top T3, Bot T6 */}
              {renderThyristorVertical('t3', 'T3', legBX, topY, midY)}
              {renderThyristorVertical('t6', 'T6', legBX, midY, botY)}

              {/* Leg C: Top T5, Bot T2 */}
              {renderThyristorVertical('t5', 'T5', legCX, topY, midY)}
              {renderThyristorVertical('t2', 'T2', legCX, midY, botY)}

              {/* AC feeds: one lane per phase, attached to the middle of its own leg */}
              {renderBridgeFeeds([t1On, t3On, t5On], [t4On, t6On, t2On])}

              {/* Top DC Positive Bus Segment 1: from Leg A to Leg B (glows ONLY if T1 is conducting) */}
              <line x1={legAX} y1={topY} x2={legBX} y2={topY} stroke={t1On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t1On)} />

              {/* Top DC Positive Bus Segment 2: from Leg B to Leg C (glows if T1 or T3 conducting) */}
              <line x1={legBX} y1={topY} x2={legCX} y2={topY} stroke={t1On || t3On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t1On || t3On)} />

              {/* Top DC Positive Bus Segment 3: from Leg C to Load (glows if T1, T3 or T5 conducting) */}
              <line x1={legCX} y1={topY} x2={loadX - 55} y2={topY} stroke={topRailActive ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(topRailActive)} />
              <line x1={loadX - 25} y1={topY} x2={loadX} y2={topY} stroke={topRailActive ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(topRailActive)} />

              {/* Bottom DC Negative Bus Segment 1: from Leg A to Leg B (glows ONLY if T4 is conducting) */}
              <line x1={legAX} y1={botY} x2={legBX} y2={botY} stroke={t4On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t4On, -1)} />

              {/* Bottom DC Negative Bus Segment 2: from Leg B to Leg C (glows if T4 or T6 conducting) */}
              <line x1={legBX} y1={botY} x2={legCX} y2={botY} stroke={t4On || t6On ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(t4On || t6On, -1)} />

              {/* Bottom DC Negative Bus Segment 3: from Leg C to Load (glows if T4, T6 or T2 conducting) */}
              <line x1={legCX} y1={botY} x2={loadX} y2={botY} stroke={botRailActive ? wireActiveAmber : wireInactive} strokeWidth="2.5" className={fl(botRailActive, -1)} />

              {/* Solder Junction Nodes on TOP */}
              {renderJunction(legAX, topY, t1On)}
              {renderJunction(legBX, topY, t1On || t3On)}
              {renderJunction(legCX, topY, t1On || t3On || t5On)}
              {renderJunction(legAX, botY, t4On)}
              {renderJunction(legBX, botY, t4On || t6On)}
              {renderJunction(legCX, botY, t4On || t6On || t2On)}

              {/* Load Branch */}
              {/* Freewheeling Diode (if toggled) */}
              {hasFreewheelingDiode && renderFwdBranch(470, topY, botY, loadX)}
              {/* Ammeter sits in series with the load, to the right of D_FW */}
              {renderAmmeter(loadX - 40, topY)}
              {renderLoadBranch(loadX, topY, botY)}
            </g>
          </svg>
        );
      }

      default:
        return null;
    }
  };

  const activeSwitchesList = Object.entries(deviceStates).filter(([_, s]) => s.conducting);

  return (
    <div
      ref={rootRef}
      className={`${isPlaying ? '' : 'circuit-paused'} ${isFullscreen ? 'schematic-fs fixed inset-0 z-[100] rounded-none bg-slate-950' : 'h-full rounded-xl bg-slate-900/90 backdrop-blur'} flex flex-col overflow-hidden shadow-lg transition-colors border border-slate-800 text-slate-100`}
    >
      {/* Top Banner with Synchronized Status & Angle: readouts on the left, Full screen pinned to the right edge */}
      <div
        className="px-4 py-2.5 border-b flex items-start justify-between gap-3 text-xs transition-colors bg-slate-950/60 border-slate-800 text-slate-200"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 min-w-0">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold uppercase tracking-wider">Interactive Circuit Schematic</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-amber-400 font-bold text-sm">ωt = {phaseAngleDeg.toFixed(1)}°</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-sm whitespace-nowrap tabular-nums">
            <span className="text-slate-400">
              Vo: <span className="text-sky-400 font-bold text-lg">{vOut.toFixed(1)} V</span>
            </span>
            <span className="text-slate-400">
              Io: <span className="text-emerald-400 font-bold text-lg">{iOut.toFixed(2)} A</span>
            </span>
          </div>
        </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit full screen (Esc)' : 'Full screen (F)'}
            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            aria-pressed={isFullscreen}
            className="no-print inline-flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-md border border-slate-700 bg-slate-900 text-slate-300 hover:text-sky-300 hover:border-sky-500/60 transition-colors font-sans text-xs font-semibold"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Full screen'}</span>
          </button>
      </div>

      {/* Conduction Banner (sits between the title bar and the circuit)
          Fixed height, single line, and a fixed-width device area: conduction changes only swap the text inside,
          so nothing slides or re-wraps when a device turns on or off. */}
      <div className="px-4 h-10 bg-slate-950/80 border-b border-slate-800 flex flex-nowrap items-center gap-3 text-xs overflow-hidden">
        {/* Active Conduction Loop */}
        <div className="flex items-center gap-2 text-slate-300 min-w-0 flex-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="font-semibold text-slate-200 shrink-0">Conducting Loop:</span>
          <span className="font-mono text-emerald-400 truncate">{activeBranchDesc}</span>
        </div>

        {/* Live Active Switches Badges (left-aligned in a fixed-width slot) */}
        <div className="flex items-center gap-1.5 text-[13px] font-mono shrink-0 whitespace-nowrap">
          <span className="text-slate-500 mr-1 hidden sm:inline">Active Devices:</span>
          <div className="flex items-center justify-start gap-1.5 sm:w-[13.5rem] overflow-hidden">
            {activeSwitchesList.length > 0 ? (
              activeSwitchesList.map(([key, s]) => (
                <span
                  key={key}
                  onClick={() => setInspectedDevice(key)}
                  className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold cursor-pointer hover:bg-emerald-500/25 transition-colors tabular-nums min-w-[5.5rem] text-center"
                >
                  {key} ({s.current.toFixed(1)}A)
                </span>
              ))
            ) : (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">All Switches Extinguished</span>
            )}
            {isFwdConducting && (
              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold tabular-nums min-w-[5.5rem] text-center">
                D_FW ({iFwd.toFixed(1)}A)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Schematic SVG Canvas with CAD Grid */}
      <div
        className="relative flex-1 flex flex-col items-stretch justify-center gap-3 p-3 overflow-hidden min-h-[170px] sm:min-h-[300px] transition-colors bg-gradient-to-b from-slate-950 to-slate-900/90"
      >
        {/* Keyed on topology / bridge arrangement: a new circuit remounts and fades in instead of popping */}
        <div
          key={`${topologyId}-${semiConfig}`}
          className="schematic-fade flex-1 min-w-0 min-h-[200px] sm:min-h-[280px] w-full flex items-center justify-center"
        >
          {renderCircuit()}
        </div>

        {onLoadTypeChange && onToggleFwd && (
          <LoadFwdSelector
            loadType={controlLoadType ?? loadType}
            onLoadTypeChange={onLoadTypeChange}
            hasFreewheelingDiode={controlHasFwd ?? hasFreewheelingDiode}
            onToggleFwd={onToggleFwd}
            isFwdConducting={isFwdConducting}
            iFwd={iFwd}
            R={R}
            L={L}
            E={E}
            semiConfig={semiConfig}
            semiEnabled={(controlTopologyId ?? topologyId) === '1ph_fw_semi_controlled'}
            onSemiConfigChange={onSemiConfigChange}
            alpha={alpha}
          />
        )}

        {/* Selected Component Inspection Overlay Card */}
        {inspectedDevice && (
          <div className="absolute top-3 left-4 bg-slate-950/95 backdrop-blur border border-sky-500/50 rounded-lg p-2.5 shadow-2xl text-xs font-mono max-w-xs z-10 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1 mb-1.5">
              <span className="font-bold text-sky-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                {inspectedDevice} Probe Telemetry
              </span>
              <button
                onClick={() => setInspectedDevice(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-1"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1 text-[13px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">State:</span>
                <span className={isDeviceOn(inspectedDevice) ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                  {isDeviceOn(inspectedDevice) ? 'CONDUCTING (ON)' : 'BLOCKING (OFF)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current:</span>
                <span className="text-emerald-300 font-bold">{getDeviceCurrent(inspectedDevice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Terminal V_AK:</span>
                <span className="text-slate-300">{getDeviceVoltage(inspectedDevice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thyristor Gate:</span>
                <span className="text-amber-300">{deviceStates[inspectedDevice]?.conducting ? 'LATCHED' : 'READY'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {playbackSlot}

    </div>
  );
};
