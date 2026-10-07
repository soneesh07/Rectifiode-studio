import React, { useState, useRef, useEffect } from 'react';
import {
  RotateCcw,
  Info,
  Sun,
  Moon,
  Printer,
  Crosshair,
  ChevronDown,
  Check,
  Activity,
  Layers,
  Zap,
} from 'lucide-react';
import { ConverterTopologyId } from '../types/converter';
import { CONVERTER_CONFIGS } from '../simulator/engine';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  currentTopologyId: ConverterTopologyId;
  onSelectTopology: (id: ConverterTopologyId) => void;
  conductionMode: string;
  onOpenCcmDcmModal: () => void;
  /** Apply a conduction-mode preset straight from the dropdown. */
  onApplyConductionPreset: (kind: 'ccm' | 'dcm' | 'r') => void;
  phaseAngleDeg: number;
  onJumpToAngle: (deg: number) => void;
  /** Jump to the first gate-firing instant (thyristor converters only). */
  onJumpToFiring: () => void;
  /** Current firing angle α in degrees, shown next to the firing-pulse option. */
  alphaDeg: number;
  onReset: () => void;
  onOpenQuickGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTopologyId,
  onSelectTopology,
  conductionMode,
  onOpenCcmDcmModal,
  onApplyConductionPreset,
  phaseAngleDeg,
  onJumpToAngle,
  onJumpToFiring,
  alphaDeg,
  onReset,
  onOpenQuickGuide,
}) => {
  const { theme, setTheme } = useTheme();

  // Dropdown states for the interactive points
  const [openSinglePhase, setOpenSinglePhase] = useState(false);
  const [openThreePhase, setOpenThreePhase] = useState(false);
  const [openSyncMenu, setOpenSyncMenu] = useState(false);
  const [openCondMenu, setOpenCondMenu] = useState(false);

  const singleRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef<HTMLDivElement>(null);
  const condRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (singleRef.current && !singleRef.current.contains(e.target as Node)) {
        setOpenSinglePhase(false);
      }
      if (threeRef.current && !threeRef.current.contains(e.target as Node)) {
        setOpenThreePhase(false);
      }
      if (syncRef.current && !syncRef.current.contains(e.target as Node)) {
        setOpenSyncMenu(false);
      }
      if (condRef.current && !condRef.current.contains(e.target as Node)) {
        setOpenCondMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentConfig = CONVERTER_CONFIGS[currentTopologyId];
  const isSinglePhaseActive = currentConfig?.category === 'Single Phase';
  const isThreePhaseActive = currentConfig?.category === 'Three Phase';
  const isCcm = conductionMode.includes('Continuous');

  const singlePhaseList = Object.values(CONVERTER_CONFIGS).filter(
    (c) => c.category === 'Single Phase'
  );
  const threePhaseList = Object.values(CONVERTER_CONFIGS).filter(
    (c) => c.category === 'Three Phase'
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <header
      className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-b sticky top-0 z-30 transition-colors backdrop-blur bg-slate-950/90 border-slate-800 text-slate-100 shadow-lg"
    >
      {/* Zone 1: Brand lockup — diode mark + "Rectifiode Studio" wordmark */}
      <div className="flex items-center gap-3 shrink-0" aria-label="Rectifiode Studio">
        {/* Logo mark: teal tile, diode symbol, glowing amber cathode bar */}
        <svg viewBox="0 0 512 512" className="w-11 h-11 shrink-0" role="img" aria-label="Rectifiode Studio logo">
          <defs>
            <filter id="rf-logo-glow" x="-60%" y="-30%" width="220%" height="160%">
              <feGaussianBlur stdDeviation="16" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="512" height="512" rx="116" fill="#0F766E" />
          <path d="M70 256 H163 M361 256 H442" stroke="#FFFFFF" strokeWidth="18" strokeLinecap="round" fill="none" />
          <polygon points="163,151 163,361 337,256" fill="#FFFFFF" />
          <path d="M361 151 V361" stroke="#FBBF24" strokeWidth="29" strokeLinecap="round" fill="none" filter="url(#rf-logo-glow)" />
        </svg>
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[26px] font-semibold tracking-tight leading-none text-slate-50">
              Rectifi<span className="text-sky-400">ode</span>
            </span>
            <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.3em] text-amber-400 leading-none translate-y-[-1px]">
              Studio
            </span>
          </div>
          <span className="mt-1.5 flex items-center gap-1.5 text-[13px] font-mono font-semibold tracking-wider leading-none">
            <span className="id-glow id-glow-name">D.Soneesh</span>
            <span className="id-glow-dot" aria-hidden="true" />
            <span className="id-glow id-glow-roll">24EE10051</span>
          </span>
        </div>
      </div>

      {/* Zone 2: Interactive Header Points with Real Functionality - Center Aligned */}
      <div className="no-print hidden xl:flex flex-1 min-w-0 justify-center items-center px-4">
        <nav className="flex items-center gap-2 xl:gap-3 text-xs font-medium min-w-0 max-w-full">
        {/* Current converter: name, phase count, pulse number and type */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-slate-900/70 border-slate-700 flex-none w-[clamp(240px,22vw,300px)] 2xl:w-[440px] overflow-hidden"
          title={currentConfig?.description}
        >
          <span
            className={`shrink-0 min-w-[2.25rem] text-center text-[12px] font-mono font-bold px-1.5 rounded transition-colors duration-300 ${
              isThreePhaseActive ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {isThreePhaseActive ? '3Φ' : '1Φ'}
          </span>
          <span key={currentConfig?.name} className="swap-fade flex flex-col leading-tight min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-100 truncate">{currentConfig?.name}</span>
            <span className="text-[12px] text-slate-400 truncate">
              {currentConfig?.controlled ? 'Controlled (SCR)' : 'Uncontrolled (diode)'} · {currentConfig?.pulseCountPerCycle}-pulse
            </span>
          </span>
        </div>

        {/* Point 3: Conduction-mode presets dropdown (CCM / DCM / pure R) + link to the theory modal */}
        <div className="relative" ref={condRef}>
          <button
            type="button"
            onClick={() => {
              setOpenCondMenu(!openCondMenu);
              setOpenSyncMenu(false);
              setOpenSinglePhase(false);
              setOpenThreePhase(false);
            }}
            aria-haspopup="menu"
            aria-expanded={openCondMenu}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer group ${
              isCcm
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
            }`}
            title="Conduction-mode presets: force CCM, trigger DCM or switch to a pure R load"
          >
            <Activity
              className={`w-3.5 h-3.5 shrink-0 ${
                isCcm ? 'text-emerald-500' : 'text-amber-500'
              }`}
            />
            <span className="whitespace-nowrap">Conduction<span className="hidden 2xl:inline"> Presets</span></span>
            <span
              className={`text-[12px] font-mono font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                isCcm
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {isCcm ? 'CCM' : 'DCM'}
            </span>
            <ChevronDown
              className={`w-3 h-3 shrink-0 transition-transform ${openCondMenu ? 'rotate-180' : ''}`}
            />
          </button>

          {openCondMenu && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-xl border shadow-xl p-2 z-50 animate-in fade-in duration-100 text-xs bg-slate-900 border-slate-700">
              <div className="font-semibold text-slate-400 text-[12px] uppercase tracking-wider px-2 py-1">
                Jump to Conduction Mode
              </div>
              <div className="space-y-1 mt-1">
                {([
                  ['ccm', 'Enforce CCM (High L)', 'CCM', 'text-emerald-500'],
                  ['dcm', 'Trigger DCM (Low L)', 'DCM', 'text-amber-500'],
                  ['r', 'Pure Resistive (R Load)', 'R', 'text-sky-500'],
                ] as const).map(([kind, label, tag, tagColor]) => (
                  <button
                    key={kind}
                    onClick={() => {
                      onApplyConductionPreset(kind);
                      setOpenCondMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <span>{label}</span>
                    <span className={`font-mono text-[12px] ${tagColor}`}>{tag}</span>
                  </button>
                ))}
                <div className="border-t border-slate-800 my-1" />
                <button
                  onClick={() => {
                    onOpenCcmDcmModal();
                    setOpenCondMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 flex items-center justify-between cursor-pointer text-slate-300"
                >
                  <span>CCM / DCM theory &amp; analysis</span>
                  <span className="font-mono text-[12px] text-slate-500">→</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Point 4: Phase Jump — jump the schematic + scope to a chosen angle */}
        <div className="relative" ref={syncRef}>
          <button
            type="button"
            onClick={() => {
              setOpenSyncMenu(!openSyncMenu);
              setOpenCondMenu(false);
              setOpenSinglePhase(false);
              setOpenThreePhase(false);
            }}
            aria-haspopup="menu"
            aria-expanded={openSyncMenu}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              openSyncMenu
                ? 'bg-indigo-500/25 border-indigo-400/60 text-indigo-200'
                : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25'
            }`}
            title="Jump the animation to a specific phase angle (ωt)"
          >
            <Crosshair className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Phase Jump<span className="hidden xl:inline font-mono font-normal opacity-70"> ωt</span></span>
            <ChevronDown
              className={`w-3 h-3 shrink-0 transition-transform ${openSyncMenu ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Sync Options Dropdown */}
          {openSyncMenu && (
            <div
              className="absolute right-0 mt-1.5 w-60 rounded-xl border shadow-xl p-2 z-50 animate-in fade-in duration-100 text-xs bg-slate-900 border-slate-700"
            >
              <div className="font-semibold text-slate-400 text-[12px] uppercase tracking-wider px-2 py-1">
                Jump to Phase Angle
              </div>
              <div className="space-y-1 mt-1">
                <button
                  onClick={() => {
                    onJumpToAngle(0);
                    setOpenSyncMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>Cycle Start (ωt = 0°)</span>
                  <span className="font-mono text-[12px] text-slate-400">0°</span>
                </button>
                {/* Firing instant: only meaningful when the converter has thyristors; dimmed for diode circuits */}
                <button
                  type="button"
                  disabled={!currentConfig?.controlled}
                  aria-disabled={!currentConfig?.controlled}
                  onClick={() => {
                    if (!currentConfig?.controlled) return;
                    onJumpToFiring();
                    setOpenSyncMenu(false);
                  }}
                  title={
                    currentConfig?.controlled
                      ? 'Jump to the first gate-firing instant'
                      : 'Not available: diode rectifiers have no firing angle (they commutate naturally)'
                  }
                  className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between ${
                    currentConfig?.controlled
                      ? 'hover:bg-slate-800 cursor-pointer'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  <span>Firing Angle Pulse (ωt = α)</span>
                  <span className="font-mono text-[12px] text-amber-500">
                    {currentConfig?.controlled ? `α = ${alphaDeg}°` : 'α'}
                  </span>
                </button>
                <button
                  onClick={() => {
                    onJumpToAngle(90);
                    setOpenSyncMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>Voltage Peak (ωt = 90°)</span>
                  <span className="font-mono text-[12px] text-sky-500">π/2</span>
                </button>
                <button
                  onClick={() => {
                    onJumpToAngle(180);
                    setOpenSyncMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>Zero Crossing (ωt = 180°)</span>
                  <span className="font-mono text-[12px] text-slate-400">π</span>
                </button>
              </div>
            </div>
          )}
        </div>
        </nav>
      </div>

      {/* Print-only: what was printed and when (the buttons below are hidden on paper) */}
      <div className="hidden print:flex flex-col items-end text-right text-xs font-mono text-slate-300">
        <span className="font-semibold text-slate-100">{currentConfig?.name}</span>
        <span>
          {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Zone 3: Actions (Theme switch, Print / PDF, User Guide, Reset) */}
      <div className="no-print flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Theme switch: two explicit choices, so the active one is always visible */}
        <div
          role="group"
          aria-label="Colour theme"
          className="flex items-center p-0.5 rounded-lg border border-slate-700 bg-slate-900/80"
        >
          {([
            { id: 'dark', label: 'Dark', hint: 'Dark theme (lab)', Icon: Moon },
            { id: 'light', label: 'Light', hint: 'Light theme (lecture slides)', Icon: Sun },
          ] as const).map(({ id, label, hint, Icon }) => {
            const active = theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                aria-pressed={active}
                title={hint}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden 2xl:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {/* User Guide button: sits between the theme switch and Print, styled to stand out */}
        <button
          type="button"
          onClick={onOpenQuickGuide}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all border cursor-pointer bg-sky-500/15 border-sky-400/60 text-sky-300 hover:bg-sky-500/30 hover:text-sky-200 shadow-[0_0_12px_-3px_var(--color-sky-400)]"
          title="Open the User Guide"
        >
          <Info className="w-3.5 h-3.5" />
          <span>User Guide</span>
        </button>

        {/* Print / PDF: always printed with the light shades, whichever theme is on screen */}
        <button
          type="button"
          onClick={handlePrint}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors border cursor-pointer bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700 hover:text-slate-50"
          title="Print or save as PDF. Prints in the light palette (saves ink) whichever theme is on screen"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print<span className="hidden 2xl:inline"> / PDF</span></span>
        </button>

        {/* Reset Lab Button */}
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-sm cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Lab</span>
        </button>
      </div>
    </header>
  );
};
