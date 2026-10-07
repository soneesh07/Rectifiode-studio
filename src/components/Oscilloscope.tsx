import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  SimulationResult,
  SimulationSample,
} from '../types/converter';
import { Crosshair, Download, Maximize2, Minimize2 } from 'lucide-react';
import { useTheme, useThemeColor, withAlpha } from '../context/ThemeContext';

interface OscilloscopeProps {
  simulationResult: SimulationResult;
  currentSampleIndex: number;
  onSampleChange: (index: number) => void;
  /** Number of AC cycles shown on the scope (1, 2 or 3). */
  cyclesToDisplay: number;
  onChangeCycles: (cycles: number) => void;
  reference?: SimulationResult | null; // pinned run drawn as a dashed overlay
}

/** Plot margins shared by drawing and pointer hit-testing; tighter on phones so the plot gets more width. */
const getPads = (canvasWidth: number) =>
  canvasWidth < 560 ? { left: 56, right: 12 } : { left: 90, right: 24 };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** Blend two runs of the same length so waveforms glide from the old shape to the new one. */
const blendResults = (from: SimulationResult, to: SimulationResult, k: number, withDevices: boolean): SimulationResult => {
  const n = to.samples.length;
  const samples: SimulationSample[] = new Array(n);
  const opt = (a: number | undefined, b: number | undefined) => (b === undefined ? undefined : lerp(a ?? b, b, k));
  for (let i = 0; i < n; i++) {
    const a = from.samples[i];
    const b = to.samples[i];
    let deviceStates = b.deviceStates;
    if (withDevices) {
      deviceStates = {};
      for (const key of Object.keys(b.deviceStates)) {
        const sb = b.deviceStates[key];
        const sa = a.deviceStates[key];
        deviceStates[key] = sa
          ? { conducting: sb.conducting, current: lerp(sa.current, sb.current, k), anodeToCathodeVoltage: lerp(sa.anodeToCathodeVoltage, sb.anodeToCathodeVoltage, k) }
          : sb;
      }
    }
    samples[i] = {
      ...b,
      vSourcePhaseA: lerp(a.vSourcePhaseA, b.vSourcePhaseA, k),
      vSourcePhaseB: opt(a.vSourcePhaseB, b.vSourcePhaseB),
      vSourcePhaseC: opt(a.vSourcePhaseC, b.vSourcePhaseC),
      iSourcePhaseA: lerp(a.iSourcePhaseA, b.iSourcePhaseA, k),
      iSourcePhaseB: opt(a.iSourcePhaseB, b.iSourcePhaseB),
      iSourcePhaseC: opt(a.iSourcePhaseC, b.iSourcePhaseC),
      vOut: lerp(a.vOut, b.vOut, k),
      iOut: lerp(a.iOut, b.iOut, k),
      deviceStates,
    };
  }
  return {
    ...to,
    samples,
    vAvg: lerp(from.vAvg, to.vAvg, k),
    vRms: lerp(from.vRms, to.vRms, k),
    iAvg: lerp(from.iAvg, to.iAvg, k),
    iRms: lerp(from.iRms, to.iRms, k),
  };
};

/**
 * Editable phase-angle readout for the Time Scrubber.
 * Shows the live ωt while idle; click it, type an angle in degrees and press Enter (or click away)
 * to jump the scrubber to the nearest simulated sample. Esc cancels.
 */
const AngleInput: React.FC<{
  valueDeg: number;
  maxDeg: number;
  onCommit: (deg: number) => void;
}> = ({ valueDeg, maxDeg, onCommit }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    setEditing(false);
    // accept things like "135", "135.5" or "135°"
    const typed = parseFloat(draft.replace('°', '').trim());
    if (Number.isNaN(typed)) return; // invalid text: just fall back to the live value
    onCommit(Math.min(maxDeg, Math.max(0, typed)));
  };

  return (
    <label
      className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md border border-slate-700 bg-slate-900 focus-within:border-amber-500/70 focus-within:ring-1 focus-within:ring-amber-500/40 transition-colors"
      title={`Type an angle (0 – ${maxDeg.toFixed(0)}°) and press Enter`}
    >
      <span className="font-mono text-[13px] text-slate-500 select-none">ωt =</span>
      <input
        type="text"
        inputMode="decimal"
        value={editing ? draft : valueDeg.toFixed(0)}
        onFocus={(e) => {
          setDraft(valueDeg.toFixed(0));
          setEditing(true);
          e.target.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur(); // blur triggers commit()
          } else if (e.key === 'Escape') {
            setEditing(false);
            e.currentTarget.blur();
          }
        }}
        className="w-12 bg-transparent text-right font-mono text-xs font-medium text-amber-400 outline-none"
        aria-label="Phase angle in degrees"
      />
      <span className="font-mono text-xs text-amber-400 select-none">°</span>
    </label>
  );
};

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  simulationResult: liveResult,
  currentSampleIndex,
  onSampleChange,
  cyclesToDisplay,
  onChangeCycles,
  reference,
}) => {
  const { isLight } = useTheme();
  const tc = useThemeColor(); // palette colours for canvas drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // ---- Smooth transitions ---------------------------------------------------
  // When a setting changes (load R -> RL, alpha, L, E, D_FW ...) the new waveforms are not swapped in
  // at once: the traces glide from the old shape to the new one in ~0.4 s. A different converter or
  // a different number of displayed cycles changes the sample grid, so those switch instantly.
  const [displayResult, setDisplayResult] = useState<SimulationResult>(liveResult);
  // A new converter / cycle count has a different sample grid: show it at once, never a stale frame of the old one.
  const simulationResult =
    displayResult.samples.length === liveResult.samples.length &&
    displayResult.params.topologyId === liveResult.params.topologyId
      ? displayResult
      : liveResult;
  const shownRef = useRef<SimulationResult>(liveResult);
  const morphRaf = useRef(0);
  const [showDeviceCurrents, setShowDeviceCurrents] = useState(false);
  const [showDeviceVoltages, setShowDeviceVoltages] = useState(false);
  useEffect(() => {
    cancelAnimationFrame(morphRaf.current);
    const from = shownRef.current;
    const to = liveResult;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const compatible =
      from !== to &&
      !reduce &&
      from.samples.length === to.samples.length &&
      from.params.topologyId === to.params.topologyId &&
      from.params.cyclesToDisplay === to.params.cyclesToDisplay;
    if (!compatible) {
      shownRef.current = to;
      setDisplayResult(to);
      return;
    }
    const DURATION = 420; // ms
    const t0 = performance.now();
    const withDevices = showDeviceCurrents || showDeviceVoltages;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / DURATION);
      const frame = k >= 1 ? to : blendResults(from, to, easeInOut(k), withDevices);
      shownRef.current = frame;
      setDisplayResult(frame);
      if (k < 1) morphRaf.current = requestAnimationFrame(step);
    };
    morphRaf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(morphRaf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveResult]);

  // ---- Full screen ----------------------------------------------------------
  // Browser Fullscreen API when available, otherwise a fixed full-viewport overlay (iPhone Safari).
  const usingNativeFs = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    const el = rootRef.current;
    if (el && document.fullscreenEnabled && el.requestFullscreen) {
      usingNativeFs.current = true;
      el.requestFullscreen().catch(() => {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen();
      } else if ((e.key === 'f' || e.key === 'F') && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen]);

  // Channel visibility toggles
  const [showSource, setShowSource] = useState(true);
  const [showIsource, setShowIsource] = useState(true);
  const [showGates, setShowGates] = useState(true);
  const [showVout, setShowVout] = useState(true);
  const [showIout, setShowIout] = useState(true);
  const [showFiringMarks, setShowFiringMarks] = useState(false);
  const [showReference, setShowReference] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<string>('all'); // 'all' or a device key such as 'T1'

  // Space per channel: every visible channel gets at least this many pixels, so turning all
  // channels on grows the scope instead of squeezing the traces together.
  const [spaceMode, setSpaceMode] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  const PANEL_MIN_PX = { compact: 190, comfortable: 235, spacious: 300 }[spaceMode];
  const PANEL_GAP = 10; // visual gap between stacked channels

  // Redraw + re-measure on resize / phone rotation
  const [viewportTick, setViewportTick] = useState(0);
  useEffect(() => {
    const onResize = () => setViewportTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  const isPhone = typeof window !== 'undefined' && window.innerWidth < 640;
  // Also redraw when the canvas box itself changes (full screen, space mode, channel count)
  const canvasBoxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = canvasBoxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setViewportTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cursor mode: 'single' (playback sweep) or 'dual' (delta measurement)
  const [cursorMode, setCursorMode] = useState<'single' | 'dual'>('single');
  const samples = simulationResult.samples;
  const sampleCount = samples.length;

  const [cursorAIndex, setCursorAIndex] = useState<number>(Math.floor(sampleCount * 0.25));
  const [cursorBIndex, setCursorBIndex] = useState<number>(Math.floor(sampleCount * 0.75));
  const [activeDragTarget, setActiveDragTarget] = useState<'none' | 'single' | 'A' | 'B'>('none');

  const currentSample = samples[currentSampleIndex] || samples[0];
  const sampleA = samples[Math.min(sampleCount - 1, Math.max(0, cursorAIndex))] || samples[0];
  const sampleB = samples[Math.min(sampleCount - 1, Math.max(0, cursorBIndex))] || samples[0];

  // Scope colours come from the shared palette tokens (index.css), so dark, light and print
  // all follow the same shades as the rest of the UI. Resolved lazily at draw time.
  const makeColors = () => ({
        bg: tc('slate-950'),
        grid: tc('slate-800'),
        gridSub: tc('slate-900'),
        axisFaint: tc('slate-800'),
        axisMid: tc('slate-700'),
        axisStrong: tc('slate-500'),
        axisDeg: tc('slate-100'),
        axisRad: tc('sky-400'),
        axisTime: tc('slate-400'),
        text: tc('slate-400'),
        cursor: tc('amber-500'),
        cursorA: tc('sky-400'),
        cursorB: tc('amber-500'),
        phaseA: tc('red-400'),
        phaseB: tc('amber-400'),
        phaseC: tc('indigo-400'),
        iSource: tc('purple-400'),
        vOut: tc('sky-400'),
        vAvg: tc('sky-600'),
        iOut: tc('emerald-500'),
        iAvg: tc('emerald-600'),
        gate: tc('amber-400'),
        switches: [tc('pink-500'), tc('purple-500'), tc('sky-500'), tc('amber-500'), tc('emerald-500'), tc('purple-500')],
        devices: [tc('pink-500'), tc('purple-500'), tc('sky-500'), tc('amber-500'), tc('emerald-500'), tc('red-500'), tc('indigo-500')],
      });

  // Determine active channels to split vertical height
  const isControlled = Object.keys(currentSample?.gatePulses || {}).length > 0;
  const activePanels: string[] = [];
  if (showSource) activePanels.push('source');
  if (showIsource) activePanels.push('isource');
  if (showGates && isControlled) activePanels.push('gates');
  // Height is sized as if the gate panel were present, so switching between controlled and uncontrolled
  // converters never changes the scope's height (uncontrolled ones just get slightly taller panels).
  const heightPanels = activePanels.length + (showGates && !isControlled ? 1 : 0);
  if (showVout) activePanels.push('vout');
  if (showIout) activePanels.push('iout');
  if (showDeviceCurrents) activePanels.push('devices');
  if (showDeviceVoltages) activePanels.push('devvolt');

  // Per-device selection: one device, or all devices overlaid
  const deviceKeys = Object.keys(samples[0]?.deviceStates || {});
  const devSel = deviceKeys.includes(selectedDevice) ? selectedDevice : 'all';
  const shownDevKeys = devSel === 'all' ? deviceKeys : [devSel];

  if (activePanels.length === 0) activePanels.push('vout');

  const savePng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scope_${simulationResult.params.topologyId}_alpha${simulationResult.params.alpha}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  // Draw oscilloscope waveform on canvas
  const drawWaveforms = useCallback(() => {
    const COLORS = makeColors();
    const canvas = canvasRef.current;
    if (!canvas || sampleCount === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // Pinned reference run: sampled at the same fraction of the screen
    const refSamples: SimulationSample[] | null = showReference && reference ? reference.samples : null;
    const refAt = (i: number): SimulationSample | null => {
      if (!refSamples || refSamples.length === 0) return null;
      const j = Math.min(refSamples.length - 1, Math.round((i / (sampleCount - 1)) * (refSamples.length - 1)));
      return refSamples[j];
    };

    // Calculate maximum voltage and current scales across dataset
    let maxV = 10;
    let maxI = 1;
    let maxIs = 1;
    for (let i = 0; i < sampleCount; i++) {
      const s = samples[i];
      maxV = Math.max(maxV, Math.abs(s.vSourcePhaseA), Math.abs(s.vOut));
      if (s.vSourcePhaseB !== undefined) maxV = Math.max(maxV, Math.abs(s.vSourcePhaseB));
      if (s.vSourcePhaseC !== undefined) maxV = Math.max(maxV, Math.abs(s.vSourcePhaseC));
      maxI = Math.max(maxI, Math.abs(s.iOut));
      maxIs = Math.max(maxIs, Math.abs(s.iSourcePhaseA));
      if (s.iSourcePhaseB !== undefined) maxIs = Math.max(maxIs, Math.abs(s.iSourcePhaseB));
      if (s.iSourcePhaseC !== undefined) maxIs = Math.max(maxIs, Math.abs(s.iSourcePhaseC));
    }
    if (refSamples) {
      for (let j = 0; j < refSamples.length; j++) {
        maxV = Math.max(maxV, Math.abs(refSamples[j].vOut));
        maxI = Math.max(maxI, Math.abs(refSamples[j].iOut));
      }
    }
    maxV *= 1.25; // headroom
    maxI *= 1.35;
    maxIs *= 1.35;

    // Layout panels vertically
    const panelCount = activePanels.length;
    const { left: paddingLeft, right: paddingRight } = getPads(width); // tighter margins on phones
    const paddingTop = 16;
    const paddingBottom = 58; // generous bottom margin for angle, radian, time graduations & axis name
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeightTotal = height - paddingTop - paddingBottom;
    const panelHeight = (plotHeightTotal - PANEL_GAP * (panelCount - 1)) / panelCount;

    // Helper x mapping
    const getX = (idx: number) => paddingLeft + (idx / (sampleCount - 1)) * plotWidth;

    // Angle markers: one every pi/2 (90 deg), aligned to whole cycles
    const totalPeriods = simulationResult.params.cyclesToDisplay || 2;
    const angleDivs = totalPeriods * 4;
    const piLabel = (k: number) => {
      if (k === 0) return '0';
      if (k % 2 === 0) return k === 2 ? 'π' : `${k / 2}π`;
      return k === 1 ? 'π/2' : `${k}π/2`;
    };

    // Colour-coded device legend, top-right of a panel
    const drawDeviceLegend = (keys: string[], colorOf: (k: string) => string, panelTop: number, rightX: number) => {
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      let x = rightX - 8;
      for (let n = keys.length - 1; n >= 0; n--) {
        const k = keys[n];
        const w = ctx.measureText(k).width;
        ctx.fillStyle = colorOf(k);
        ctx.fillText(k, x, panelTop + 14);
        x -= w + 12;
      }
    };

    // Draw panels
    activePanels.forEach((panelType, panelIdx) => {
      const panelTop = paddingTop + panelIdx * (panelHeight + PANEL_GAP);
      const panelBottom = panelTop + panelHeight;
      const panelCenterY = panelTop + panelHeight / 2;

      // Panel borders & graticule grid
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(paddingLeft, panelTop, plotWidth, panelHeight);

      // Horizontal center zero-axis or reference
      ctx.strokeStyle = panelType === 'gates' ? COLORS.gridSub : tc('slate-700');
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, panelCenterY);
      ctx.lineTo(paddingLeft + plotWidth, panelCenterY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Vertical angle markers: pi/2 (faint), pi (medium), 2pi multiples (strong)
      for (let k = 1; k < angleDivs; k++) {
        const gx = paddingLeft + (k / angleDivs) * plotWidth;
        const isCycle = k % 4 === 0;
        const isPi = k % 2 === 0;
        ctx.strokeStyle = isCycle ? COLORS.axisStrong : isPi ? COLORS.axisMid : COLORS.axisFaint;
        ctx.lineWidth = isCycle ? 1.4 : 1;
        ctx.setLineDash(isCycle ? [] : isPi ? [6, 3] : [2, 4]);
        ctx.beginPath();
        ctx.moveTo(gx, panelTop);
        ctx.lineTo(gx, panelBottom);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Panel specific drawings
      if (panelType === 'source') {
        // Source voltages
        const isThreePhase = samples[0].vSourcePhaseB !== undefined;
        const scaleY = (panelHeight * 0.40) / maxV;

        // Channel Tag & Descriptive Header inside panel top-left
        ctx.textAlign = 'left';
        if (isThreePhase) {
          ctx.fillStyle = tc('red-400');
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          ctx.fillText('CH1: AC Phase Voltages v_an(t) [Red], v_bn(t) [Yel], v_cn(t) [Blu]', paddingLeft + 8, panelTop + 14);
        } else {
          ctx.fillStyle = tc('red-400');
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          ctx.fillText('CH1: AC Supply Voltage v_s(t) [V]', paddingLeft + 8, panelTop + 14);
        }

        // Y-Axis Unit & Scale on the left
        ctx.textAlign = 'right';
        ctx.fillStyle = tc('slate-400');
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText('V_src [V]', paddingLeft - 8, panelTop + 12);

        ctx.fillStyle = COLORS.text;
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(`+${maxV.toFixed(0)} V`, paddingLeft - 8, panelCenterY - panelHeight * 0.36);
        ctx.fillText('0 V', paddingLeft - 8, panelCenterY + 3);
        ctx.fillText(`-${maxV.toFixed(0)} V`, paddingLeft - 8, panelCenterY + panelHeight * 0.36);

        // Zero reference tick mark
        ctx.fillStyle = tc('slate-500');
        ctx.beginPath();
        ctx.moveTo(paddingLeft - 4, panelCenterY);
        ctx.lineTo(paddingLeft, panelCenterY - 3);
        ctx.lineTo(paddingLeft, panelCenterY + 3);
        ctx.closePath();
        ctx.fill();

        if (isThreePhase) {
          // Phase A
          ctx.strokeStyle = COLORS.phaseA;
          ctx.lineWidth = 1.75;
          ctx.beginPath();
          for (let i = 0; i < sampleCount; i++) {
            const x = getX(i);
            const y = panelCenterY - samples[i].vSourcePhaseA * scaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Phase B
          ctx.strokeStyle = COLORS.phaseB;
          ctx.lineWidth = 1.75;
          ctx.beginPath();
          for (let i = 0; i < sampleCount; i++) {
            const x = getX(i);
            const y = panelCenterY - (samples[i].vSourcePhaseB || 0) * scaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Phase C
          ctx.strokeStyle = COLORS.phaseC;
          ctx.lineWidth = 1.75;
          ctx.beginPath();
          for (let i = 0; i < sampleCount; i++) {
            const x = getX(i);
            const y = panelCenterY - (samples[i].vSourcePhaseC || 0) * scaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else {
          // Single phase AC
          ctx.strokeStyle = COLORS.phaseA;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < sampleCount; i++) {
            const x = getX(i);
            const y = panelCenterY - samples[i].vSourcePhaseA * scaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (panelType === 'isource') {
        // Grid Source Current is(t)
        const isThreePhase = samples[0].iSourcePhaseB !== undefined;
        const scaleY = (panelHeight * 0.40) / maxIs;

        ctx.textAlign = 'left';
        ctx.fillStyle = tc('purple-400');
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        if (isThreePhase) {
          ctx.fillText('CH2: AC Grid Line Currents i_a(t) [Red], i_b(t) [Yel], i_c(t) [Blu]', paddingLeft + 8, panelTop + 14);
        } else {
          ctx.fillText('CH2: AC Source Supply Current i_s(t) [A]', paddingLeft + 8, panelTop + 14);
        }

        ctx.textAlign = 'right';
        ctx.fillStyle = tc('slate-400');
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText('I_src [A]', paddingLeft - 8, panelTop + 12);

        ctx.fillStyle = COLORS.text;
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(`+${maxIs.toFixed(1)} A`, paddingLeft - 8, panelCenterY - panelHeight * 0.36);
        ctx.fillText('0 A', paddingLeft - 8, panelCenterY + 3);
        ctx.fillText(`-${maxIs.toFixed(1)} A`, paddingLeft - 8, panelCenterY + panelHeight * 0.36);

        // Zero tick
        ctx.fillStyle = tc('slate-500');
        ctx.beginPath();
        ctx.moveTo(paddingLeft - 4, panelCenterY);
        ctx.lineTo(paddingLeft, panelCenterY - 3);
        ctx.lineTo(paddingLeft, panelCenterY + 3);
        ctx.closePath();
        ctx.fill();

        if (isThreePhase) {
          // Phase A line current
          ctx.strokeStyle = tc('red-400');
          ctx.lineWidth = 1.75;
          ctx.beginPath();
          for (let i = 0; i < sampleCount; i++) {
            const x = getX(i);
            const y = panelCenterY - samples[i].iSourcePhaseA * scaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Phase B line current
          ctx.strokeStyle = tc('amber-400');
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < sampleCount; i++) {
            const x = getX(i);
            const y = panelCenterY - (samples[i].iSourcePhaseB || 0) * scaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Phase C line current
          ctx.strokeStyle = tc('indigo-400');
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < sampleCount; i++) {
            const x = getX(i);
            const y = panelCenterY - (samples[i].iSourcePhaseC || 0) * scaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else {
          // Single phase AC supply current
          ctx.strokeStyle = COLORS.iSource;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          for (let i = 0; i < sampleCount; i++) {
            const x = getX(i);
            const y = panelCenterY - samples[i].iSourcePhaseA * scaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (panelType === 'gates') {
        // Gate trigger pulses logic trace
        ctx.textAlign = 'left';
        ctx.fillStyle = tc('amber-400');
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText(`CH3: SCR Gate Pulses v_g(ωt) [Logic] (Firing Angle α = ${simulationResult.params.alpha}°)`, paddingLeft + 8, panelTop + 14);

        ctx.textAlign = 'right';
        ctx.fillStyle = tc('slate-400');
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText('Gate [0/1]', paddingLeft - 8, panelTop + 12);

        const gateKeys = Object.keys(samples[0]?.gatePulses || {});
        const gateTrackHeight = (panelHeight - 18) / Math.max(1, gateKeys.length);

        gateKeys.forEach((gKey, gIdx) => {
          const trackBaseY = panelTop + 14 + (gIdx + 1) * gateTrackHeight;
          const trackHighY = trackBaseY - gateTrackHeight * 0.72;

          ctx.fillStyle = tc('slate-400');
          ctx.font = '10px JetBrains Mono, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(gKey, paddingLeft - 6, trackBaseY - 2);

          ctx.strokeStyle = COLORS.gate;
          ctx.lineWidth = 1.75;
          ctx.beginPath();

          for (let i = 0; i < sampleCount; i++) {
            const isHigh = samples[i].gatePulses[gKey];
            const x = getX(i);
            const y = isHigh ? trackHighY : trackBaseY;

            if (i === 0) ctx.moveTo(x, y);
            else {
              const prevHigh = samples[i - 1].gatePulses[gKey];
              if (isHigh !== prevHigh) {
                ctx.lineTo(x, prevHigh ? trackHighY : trackBaseY);
              }
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        });
      } else if (panelType === 'vout') {
        // Output voltage Vo(t)
        const scaleY = (panelHeight * 0.40) / maxV;

        ctx.textAlign = 'left';
        ctx.fillStyle = tc('sky-400');
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText(`CH4: Output Voltage v_o(t) [V] (V_dc = ${simulationResult.vAvg.toFixed(1)} V, V_rms = ${simulationResult.vRms.toFixed(1)} V)`, paddingLeft + 8, panelTop + 14);

        ctx.textAlign = 'right';
        ctx.fillStyle = tc('slate-400');
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText('V_out [V]', paddingLeft - 8, panelTop + 12);

        ctx.fillStyle = COLORS.text;
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(`+${maxV.toFixed(0)} V`, paddingLeft - 8, panelCenterY - panelHeight * 0.36);
        ctx.fillText('0 V', paddingLeft - 8, panelCenterY + 3);
        ctx.fillText(`-${maxV.toFixed(0)} V`, paddingLeft - 8, panelCenterY + panelHeight * 0.36);

        // Zero tick
        ctx.fillStyle = tc('slate-500');
        ctx.beginPath();
        ctx.moveTo(paddingLeft - 4, panelCenterY);
        ctx.lineTo(paddingLeft, panelCenterY - 3);
        ctx.lineTo(paddingLeft, panelCenterY + 3);
        ctx.closePath();
        ctx.fill();

        // Vo DC average dashed line
        const vAvgY = panelCenterY - simulationResult.vAvg * scaleY;
        ctx.strokeStyle = COLORS.vAvg;
        ctx.lineWidth = 1.25;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, vAvgY);
        ctx.lineTo(paddingLeft + plotWidth, vAvgY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label on average line
        ctx.fillStyle = tc('sky-600');
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`V_dc: ${simulationResult.vAvg.toFixed(1)}V`, paddingLeft + plotWidth - 6, vAvgY - 4);

        // Vo Waveform line
        ctx.strokeStyle = COLORS.vOut;
        ctx.lineWidth = 2.25;
        ctx.beginPath();
        for (let i = 0; i < sampleCount; i++) {
          const x = getX(i);
          const y = panelCenterY - samples[i].vOut * scaleY;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        if (refSamples) {
          ctx.save();
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = tc('slate-400');
          ctx.lineWidth = 1.75;
          ctx.beginPath();
          for (let i = 0; i < sampleCount; i++) {
            const x = getX(i);
            const y = panelCenterY - (refAt(i)?.vOut ?? 0) * scaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.restore();
          ctx.textAlign = 'right';
          ctx.fillStyle = tc('slate-400');
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.fillText('- - reference', paddingLeft + plotWidth - 6, panelTop + 14);
        }
      } else if (panelType === 'iout') {
        // Load Current Io(t)
        const baseZeroY = panelBottom - 8;
        const scaleY = (panelHeight - 22) / maxI;

        ctx.textAlign = 'left';
        ctx.fillStyle = tc('emerald-400');
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText(`CH5: Load Output Current i_o(t) [A] (I_dc = ${simulationResult.iAvg.toFixed(2)} A, I_rms = ${simulationResult.iRms.toFixed(2)} A)`, paddingLeft + 8, panelTop + 14);

        ctx.textAlign = 'right';
        ctx.fillStyle = tc('slate-400');
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText('I_out [A]', paddingLeft - 8, panelTop + 12);

        ctx.fillStyle = COLORS.text;
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(`+${maxI.toFixed(1)} A`, paddingLeft - 8, panelTop + 24);
        ctx.fillText('0 A', paddingLeft - 8, baseZeroY + 3);

        // Zero tick
        ctx.fillStyle = tc('slate-500');
        ctx.beginPath();
        ctx.moveTo(paddingLeft - 4, baseZeroY);
        ctx.lineTo(paddingLeft, baseZeroY - 3);
        ctx.lineTo(paddingLeft, baseZeroY + 3);
        ctx.closePath();
        ctx.fill();

        // Io DC average line
        const iAvgY = baseZeroY - simulationResult.iAvg * scaleY;
        ctx.strokeStyle = COLORS.iAvg;
        ctx.lineWidth = 1.25;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, iAvgY);
        ctx.lineTo(paddingLeft + plotWidth, iAvgY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label on average line
        ctx.fillStyle = tc('emerald-600');
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`I_dc: ${simulationResult.iAvg.toFixed(2)}A`, paddingLeft + plotWidth - 6, iAvgY - 4);

        // Io waveform line (plain trace, like every other channel)
        ctx.strokeStyle = COLORS.iOut;
        ctx.lineWidth = 2.25;
        ctx.beginPath();
        for (let i = 0; i < sampleCount; i++) {
          const x = getX(i);
          const y = baseZeroY - samples[i].iOut * scaleY;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        if (refSamples) {
          ctx.save();
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = tc('slate-400');
          ctx.lineWidth = 1.75;
          ctx.beginPath();
          for (let i = 0; i < sampleCount; i++) {
            const x = getX(i);
            const y = baseZeroY - (refAt(i)?.iOut ?? 0) * scaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.restore();
          ctx.textAlign = 'right';
          ctx.fillStyle = tc('slate-400');
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.fillText('- - reference', paddingLeft + plotWidth - 6, panelTop + 14);
        }
      } else if (panelType === 'devices') {
        // Device Currents
        const baseZeroY = panelBottom - 8;
        const scaleY = (panelHeight - 22) / maxI;

        ctx.textAlign = 'left';
        ctx.fillStyle = tc('pink-500');
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('CH6: Device Currents i_sw(t) [A]', paddingLeft + 8, panelTop + 14);

        ctx.textAlign = 'right';
        ctx.fillStyle = tc('slate-400');
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText('I_dev [A]', paddingLeft - 8, panelTop + 12);

        ctx.fillStyle = COLORS.text;
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText('0 A', paddingLeft - 8, baseZeroY + 3);

        const devColor = (key: string) =>
          COLORS.devices[deviceKeys.indexOf(key) % COLORS.devices.length];
        const devDash = (key: string) => (deviceKeys.indexOf(key) >= COLORS.devices.length ? [5, 3] : []);

        let devMaxI = 1;
        shownDevKeys.forEach((key) => {
          for (let i = 0; i < sampleCount; i++) devMaxI = Math.max(devMaxI, Math.abs(samples[i].deviceStates[key]?.current || 0));
        });
        const devScaleY = (panelHeight - 22) / (devMaxI * 1.15);
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.text;
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(`+${(devMaxI * 1.15).toFixed(1)} A`, paddingLeft - 8, panelTop + 24);

        shownDevKeys.forEach((key) => {
          ctx.strokeStyle = devColor(key);
          ctx.setLineDash(devDash(key));
          ctx.lineWidth = devSel === 'all' ? 1.5 : 2.25;
          ctx.beginPath();
          for (let i = 0; i < sampleCount; i++) {
            const x = getX(i);
            const devCurr = samples[i].deviceStates[key]?.current || 0;
            const y = baseZeroY - devCurr * devScaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        });
        ctx.setLineDash([]);
        drawDeviceLegend(shownDevKeys, devColor, panelTop, paddingLeft + plotWidth);
      } else if (panelType === 'devvolt') {
        // Device voltages (anode-to-cathode)
        const devColor = (key: string) =>
          COLORS.devices[deviceKeys.indexOf(key) % COLORS.devices.length];
        const devDash = (key: string) => (deviceKeys.indexOf(key) >= COLORS.devices.length ? [5, 3] : []);

        let devMaxV = 10;
        shownDevKeys.forEach((key) => {
          for (let i = 0; i < sampleCount; i++) devMaxV = Math.max(devMaxV, Math.abs(samples[i].deviceStates[key]?.anodeToCathodeVoltage || 0));
        });
        devMaxV *= 1.15;
        const halfH = (panelHeight - 26) / 2;

        ctx.textAlign = 'left';
        ctx.fillStyle = tc('indigo-500');
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('CH7: Device Voltage v_AK(t) [V]', paddingLeft + 8, panelTop + 14);

        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.text;
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(`+${devMaxV.toFixed(0)} V`, paddingLeft - 8, panelTop + 24);
        ctx.fillText('0 V', paddingLeft - 8, panelCenterY + 3);
        ctx.fillText(`-${devMaxV.toFixed(0)} V`, paddingLeft - 8, panelBottom - 6);

        shownDevKeys.forEach((key) => {
          ctx.strokeStyle = devColor(key);
          ctx.setLineDash(devDash(key));
          ctx.lineWidth = devSel === 'all' ? 1.5 : 2.25;
          ctx.beginPath();
          for (let i = 0; i < sampleCount; i++) {
            const x = getX(i);
            const v = samples[i].deviceStates[key]?.anodeToCathodeVoltage || 0;
            const y = panelCenterY - (v / devMaxV) * halfH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        });
        ctx.setLineDash([]);
        drawDeviceLegend(shownDevKeys, devColor, panelTop, paddingLeft + plotWidth);
      }
    });

    // Firing instants: dashed line at every gate-pulse rising edge
    if (showFiringMarks && isControlled) {
      const gateKeys = Object.keys(samples[0]?.gatePulses || {});
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = tc('amber-500');
      ctx.fillStyle = tc('amber-500');
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      const bottomY = height - paddingBottom;
      gateKeys.forEach((key) => {
        for (let i = 1; i < sampleCount; i++) {
          if (samples[i].gatePulses[key] && !samples[i - 1].gatePulses[key]) {
            const x = getX(i);
            ctx.beginPath();
            ctx.moveTo(x, paddingTop);
            ctx.lineTo(x, bottomY);
            ctx.stroke();
            ctx.fillText(key, x, paddingTop - 4);
          }
        }
      });
      ctx.restore();
    }

    // Horizontal X-Axis: ticks + labels at every pi/2 (radians prominent, then degrees, then time)
    const axisY = height - paddingBottom;
    ctx.strokeStyle = COLORS.axisStrong;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, axisY);
    ctx.lineTo(paddingLeft + plotWidth, axisY);
    ctx.stroke();

    for (let k = 0; k <= angleDivs; k++) {
      const ax = paddingLeft + (k / angleDivs) * plotWidth;
      const deg = k * 90;
      const isMajor = k % 2 === 0; // pi multiples
      const timeMs = ((k / 4) * simulationResult.period * 1000).toFixed(1);

      ctx.strokeStyle = COLORS.axisStrong;
      ctx.lineWidth = isMajor ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(ax, axisY);
      ctx.lineTo(ax, axisY + (isMajor ? 7 : 5));
      ctx.stroke();

      // Keep the first / last labels inside the canvas
      ctx.textAlign = k === 0 ? 'left' : k === angleDivs ? 'right' : 'center';
      const tx = k === 0 ? ax - 2 : k === angleDivs ? ax + 2 : ax;

      // Row 1: radians (primary marker: π/2, π, 3π/2, 2π ...)
      ctx.fillStyle = COLORS.axisRad;
      ctx.font = `bold ${isMajor ? 12 : 11}px JetBrains Mono, monospace`;
      ctx.fillText(piLabel(k), tx, axisY + 19);

      // Row 2: degrees
      ctx.fillStyle = COLORS.axisDeg;
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${deg}°`, tx, axisY + 31);

      // Row 3: time
      ctx.fillStyle = COLORS.axisTime;
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.fillText(`${timeMs}ms`, tx, axisY + 42);
    }

    // Explicit X-Axis Name in Bottom Margins
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Horizontal Axis: Phase Angle ωt [rad] / [°] / Time t [ms]', paddingLeft, height - 4);

    ctx.fillStyle = COLORS.axisTime;
    ctx.textAlign = 'right';
    ctx.fillText(`Period T = ${(simulationResult.period * 1000).toFixed(1)} ms (f = ${simulationResult.params.frequency} Hz, Marker every π/2)`, paddingLeft + plotWidth, height - 4);

    // CURSOR RENDERING
    if (cursorMode === 'single') {
      // Single Sweep Cursor
      const cursorX = getX(currentSampleIndex);
      ctx.strokeStyle = COLORS.cursor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(cursorX, paddingTop);
      ctx.lineTo(cursorX, height - paddingBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.cursor;
      ctx.beginPath();
      ctx.moveTo(cursorX - 5, paddingTop);
      ctx.lineTo(cursorX + 5, paddingTop);
      ctx.lineTo(cursorX, paddingTop + 7);
      ctx.closePath();
      ctx.fill();
    } else {
      // DUAL CURSORS (A and B)
      const xA = getX(cursorAIndex);
      const xB = getX(cursorBIndex);

      // Shaded delta measurement region between Cursor A and B
      ctx.fillStyle = withAlpha(tc('sky-400'), 0.06);
      ctx.fillRect(Math.min(xA, xB), paddingTop, Math.abs(xB - xA), height - paddingTop - paddingBottom);

      // Cursor A (Sky Blue)
      ctx.strokeStyle = COLORS.cursorA;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(xA, paddingTop);
      ctx.lineTo(xA, height - paddingBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.cursorA;
      ctx.fillRect(xA - 10, paddingTop - 2, 20, 14);
      ctx.fillStyle = tc('slate-900');
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('A', xA, paddingTop + 8);

      // Cursor B (Amber)
      ctx.strokeStyle = COLORS.cursorB;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(xB, paddingTop);
      ctx.lineTo(xB, height - paddingBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.cursorB;
      ctx.fillRect(xB - 10, paddingTop - 2, 20, 14);
      ctx.fillStyle = tc('slate-900');
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('B', xB, paddingTop + 8);
    }

    ctx.restore();
  }, [samples, currentSampleIndex, cursorMode, cursorAIndex, cursorBIndex, activePanels, sampleCount, simulationResult, isLight, tc, viewportTick, reference, showReference, showFiringMarks, devSel, PANEL_GAP]);

  useEffect(() => {
    drawWaveforms();
  }, [drawWaveforms]);

  // Handle canvas mouse scrubbing & dragging
  const handleCanvasInteraction = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const { left: paddingLeft, right: paddingRight } = getPads(rect.width);
    const plotWidth = rect.width - paddingLeft - paddingRight;

    const mouseX = clientX - rect.left - paddingLeft;
    const frac = Math.max(0, Math.min(1, mouseX / plotWidth));
    const targetIdx = Math.round(frac * (sampleCount - 1));

    if (cursorMode === 'single') {
      onSampleChange(targetIdx);
    } else {
      // In Dual mode, drag closest or designated cursor
      if (activeDragTarget === 'A') {
        setCursorAIndex(targetIdx);
        onSampleChange(targetIdx);
      } else if (activeDragTarget === 'B') {
        setCursorBIndex(targetIdx);
        onSampleChange(targetIdx);
      } else {
        // Pick nearest
        const distA = Math.abs(targetIdx - cursorAIndex);
        const distB = Math.abs(targetIdx - cursorBIndex);
        if (distA < distB) {
          setCursorAIndex(targetIdx);
          setActiveDragTarget('A');
          onSampleChange(targetIdx);
        } else {
          setCursorBIndex(targetIdx);
          setActiveDragTarget('B');
          onSampleChange(targetIdx);
        }
      }
    }
  };

  // Delta calculations for dual cursors
  const deltaT_ms = Math.abs(sampleB.time - sampleA.time) * 1000;
  const deltaTheta_deg = Math.abs(sampleB.phaseAngleDeg - sampleA.phaseAngleDeg);
  const deltaVo = sampleB.vOut - sampleA.vOut;
  const deltaIo = sampleB.iOut - sampleA.iOut;
  const deltaFreqHz = deltaT_ms > 1e-3 ? (1000 / deltaT_ms).toFixed(1) : '∞';

  return (
    <div
      ref={rootRef}
      className={`flex flex-col overflow-hidden shadow-lg transition-colors border border-slate-800 text-slate-100 ${
        isFullscreen ? 'fixed inset-0 z-[100] rounded-none bg-slate-950 h-screen' : 'h-full rounded-xl bg-slate-900/90 backdrop-blur'
      }`}
    >
      {/* Top Oscilloscope Toolbar: left = time-base (cycles, spacing) · centre = active waveforms · right = cursors, full screen, PNG */}
      <div
        className="no-print px-4 py-2.5 border-b grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-2 text-xs transition-colors bg-slate-950/60 border-slate-800 text-slate-200"
      >
        {/* Left: displayed AC cycles + channel spacing */}
        <div className="flex flex-wrap items-center gap-3 justify-self-start">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[13px] font-medium">Displayed AC Cycles:</span>
            <div className="flex items-center border border-slate-800 rounded overflow-hidden text-[13px] font-mono">
              {[1, 2, 3].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChangeCycles(c)}
                  className={`px-2.5 py-0.5 transition-colors ${
                    cyclesToDisplay === c
                      ? 'bg-slate-700 text-amber-300 font-semibold'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {c}T
                </button>
              ))}
            </div>
          </div>

          {/* Space per channel */}
          <div className="pl-3 border-l border-slate-800 flex items-center gap-2">
            <span className="text-slate-500 text-[13px] font-medium">Spacing:</span>
            <div className="flex items-center border border-slate-800 rounded overflow-hidden text-[13px] font-mono">
              {([['compact', 'S'], ['comfortable', 'M'], ['spacious', 'L']] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSpaceMode(mode)}
                  title={`${mode} channel height`}
                  className={`px-2.5 py-0.5 transition-colors ${
                    spaceMode === mode ? 'bg-slate-700 text-amber-300 font-semibold' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Centre: active waveforms */}
        {/* Channel Visibility Toggles */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="text-slate-500 text-[13px] font-medium mr-1">Channels:</span>
          <button
            onClick={() => setShowSource(!showSource)}
            className={`px-2 py-0.5 rounded text-[13px] font-mono transition-colors ${
              showSource ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-500 hover:bg-slate-800'
            }`}
          >
            v_s(t)
          </button>
          <button
            onClick={() => setShowIsource(!showIsource)}
            className={`px-2 py-0.5 rounded text-[13px] font-mono transition-colors ${
              showIsource ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-500 hover:bg-slate-800'
            }`}
          >
            i_s(t)
          </button>
          {isControlled && (
            <button
              onClick={() => setShowGates(!showGates)}
              className={`px-2 py-0.5 rounded text-[13px] font-mono transition-colors ${
                showGates ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-500 hover:bg-slate-800'
              }`}
            >
              Gate(α)
            </button>
          )}
          {isControlled && (
            <button
              onClick={() => setShowFiringMarks(!showFiringMarks)}
              title="Mark every firing instant on all panels"
              className={`px-2 py-0.5 rounded text-[13px] font-mono transition-colors ${
                showFiringMarks ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-500 hover:bg-slate-800'
              }`}
            >
              Fire
            </button>
          )}
          <button
            onClick={() => setShowVout(!showVout)}
            className={`px-2 py-0.5 rounded text-[13px] font-mono transition-colors ${
              showVout ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-500 hover:bg-slate-800'
            }`}
          >
            v_o(t)
          </button>
          <button
            onClick={() => setShowIout(!showIout)}
            className={`px-2 py-0.5 rounded text-[13px] font-mono transition-colors ${
              showIout ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:bg-slate-800'
            }`}
          >
            i_o(t)
          </button>
          <button
            onClick={() => setShowDeviceCurrents(!showDeviceCurrents)}
            className={`px-2 py-0.5 rounded text-[13px] font-mono transition-colors ${
              showDeviceCurrents ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'text-slate-500 hover:bg-slate-800'
            }`}
          >
            i_sw(t)
          </button>
          <button
            onClick={() => setShowDeviceVoltages(!showDeviceVoltages)}
            className={`px-2 py-0.5 rounded text-[13px] font-mono transition-colors ${
              showDeviceVoltages ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:bg-slate-800'
            }`}
          >
            v_AK(t)
          </button>
          {reference && (
            <button
              onClick={() => setShowReference(!showReference)}
              title="Show or hide the pinned reference waveforms"
              className={`px-2 py-0.5 rounded text-[13px] font-mono transition-colors ${
                showReference ? 'bg-slate-500/25 text-slate-300 border border-slate-500/40' : 'text-slate-500 hover:bg-slate-800'
              }`}
            >
              Ref
            </button>
          )}
          {(showDeviceCurrents || showDeviceVoltages) && (
            <select
              value={devSel}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="px-1.5 py-0.5 rounded text-[13px] font-mono bg-slate-800 text-slate-200 border border-slate-700 cursor-pointer"
              aria-label="Device shown in the device waveform panels"
            >
              <option value="all">All devices</option>
              {deviceKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: dual cursors, full screen, PNG download (rightmost) */}
        <div className="flex flex-wrap items-center gap-2 lg:justify-self-end">
            <button
              onClick={() => {
                setCursorMode(cursorMode === 'single' ? 'dual' : 'single');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                cursorMode === 'dual'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crosshair className="w-4 h-4" />
              <span>Measure</span>
            </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit full screen (Esc)' : 'Full screen (F)'}
            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            aria-pressed={isFullscreen}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-sky-300 hover:border-sky-500/60 transition-colors text-sm font-semibold cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Full screen'}</span>
          </button>
            <button
              onClick={savePng}
              title="Save the scope as a PNG image"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>PNG</span>
            </button>
        </div>
      </div>

      {/* Cursor readout: its own strip above the plot, so it never covers a trace or a channel title */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/40 flex justify-end">
          {/* Digital Readout Cursor HUD Banner */}
          {cursorMode === 'single' ? (
            <div className="bg-slate-950/85 border border-slate-700/60 rounded-lg px-4 py-1.5 font-mono text-sm flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-300">
              <div>
                <span className="text-slate-400">t:</span>{' '}
                <span className="text-slate-100 font-bold text-base">
                  {(currentSample.time * 1000).toFixed(2)} ms
                </span>
              </div>
              <div>
                <span className="text-slate-400">θ:</span>{' '}
                <span className="text-amber-400 font-bold text-base">
                  {currentSample.phaseAngleDeg.toFixed(1)}°
                </span>
              </div>
              <div>
                <span className="text-slate-400">Vo:</span>{' '}
                <span className="text-sky-400 font-bold text-base">
                  {currentSample.vOut.toFixed(1)} V
                </span>
              </div>
              <div>
                <span className="text-slate-400">Io:</span>{' '}
                <span className="text-emerald-400 font-bold text-base">
                  {currentSample.iOut.toFixed(2)} A
                </span>
              </div>
              <div>
                <span className="text-slate-400">Is:</span>{' '}
                <span className="text-purple-400 font-bold text-base">
                  {currentSample.iSourcePhaseA.toFixed(2)} A
                </span>
              </div>
            </div>
          ) : (
            /* Dual-Cursor Measurement Delta HUD Banner */
            <div className="bg-slate-950/90 border border-sky-500/40 rounded-lg px-3 py-1.5 font-mono text-sm flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-300">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold">Cursor A</span>
                <span>{(sampleA.time * 1000).toFixed(1)}ms ({sampleA.phaseAngleDeg.toFixed(0)}°)</span>
                <span>Vo: {sampleA.vOut.toFixed(1)}V</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">Cursor B</span>
                <span>{(sampleB.time * 1000).toFixed(1)}ms ({sampleB.phaseAngleDeg.toFixed(0)}°)</span>
                <span>Vo: {sampleB.vOut.toFixed(1)}V</span>
              </div>
              <div className="pl-3 border-l border-slate-700 flex items-center gap-3 text-emerald-300 font-semibold">
                <span>Δt = {deltaT_ms.toFixed(2)}ms</span>
                <span>Δθ = {deltaTheta_deg.toFixed(1)}°</span>
                <span>ΔVo = {deltaVo.toFixed(1)}V</span>
                <span>ΔIo = {deltaIo.toFixed(2)}A</span>
                <span className="text-sky-300">f_Δ = {deltaFreqHz}Hz</span>
              </div>
            </div>
          )}
      </div>

      {/* Main canvas area. Height = channels x per-channel minimum, so many channels never get squeezed.
          Full screen: the plot fills the screen and scrolls only if even the minimum does not fit. */}
      <div className={`relative ${isFullscreen ? 'flex-1 min-h-0 overflow-y-auto' : ''} cursor-crosshair`}>
        <div
          ref={canvasBoxRef}
          className="relative w-full"
          style={
            isFullscreen
              ? { height: '100%', minHeight: `${activePanels.length * 120 + 90}px` }
              : { height: `${Math.max(isPhone ? 460 : 560, heightPanels * (PANEL_MIN_PX + PANEL_GAP) + 90)}px` }
          }
        >
          <canvas
            ref={canvasRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              handleCanvasInteraction(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1 || e.pointerType === 'touch') {
                handleCanvasInteraction(e.clientX);
              }
            }}
            onPointerUp={() => setActiveDragTarget('none')}
            onPointerCancel={() => setActiveDragTarget('none')}
            style={{ touchAction: 'pan-y' }}
            className="w-full h-full block"
          />
        </div>
      </div>

      {/* Synchronized Scrubber Slider / Dual Cursor Adjustment */}
      <div className="no-print px-4 py-2 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 text-xs">
        {cursorMode === 'single' ? (
          <div className="flex-1 flex items-center gap-3">
            <span className="text-[13px] text-slate-400 font-medium whitespace-nowrap">Time Scrubber:</span>
            <input
              type="range"
              min={0}
              max={sampleCount - 1}
              value={currentSampleIndex}
              onChange={(e) => onSampleChange(Number(e.target.value))}
              className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <AngleInput
              valueDeg={currentSample.phaseAngleDeg}
              maxDeg={samples[sampleCount - 1]?.phaseAngleDeg ?? 360}
              onCommit={(deg) => {
                // phase angle grows monotonically with sample index, so snap to the nearest sample
                let best = 0;
                let bestErr = Infinity;
                for (let i = 0; i < sampleCount; i++) {
                  const err = Math.abs(samples[i].phaseAngleDeg - deg);
                  if (err < bestErr) { bestErr = err; best = i; }
                }
                onSampleChange(best);
              }}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-6">
            {/* Cursor A Slider */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[13px] font-bold text-sky-400 whitespace-nowrap">Cursor A:</span>
              <input
                type="range"
                min={0}
                max={sampleCount - 1}
                value={cursorAIndex}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCursorAIndex(val);
                  onSampleChange(val);
                }}
                className="flex-1 accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="font-mono text-[13px] text-sky-300 w-12 text-right">
                {sampleA.phaseAngleDeg.toFixed(0)}°
              </span>
            </div>

            {/* Cursor B Slider */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[13px] font-bold text-amber-400 whitespace-nowrap">Cursor B:</span>
              <input
                type="range"
                min={0}
                max={sampleCount - 1}
                value={cursorBIndex}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCursorBIndex(val);
                  onSampleChange(val);
                }}
                className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="font-mono text-[13px] text-amber-300 w-12 text-right">
                {sampleB.phaseAngleDeg.toFixed(0)}°
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
