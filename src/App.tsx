import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import { SimulationResult,
  ConverterTopologyId,
  SimulationParams,
  composeLoad,
} from './types/converter';
import { runSimulation, CONVERTER_CONFIGS } from './simulator/engine';
import { Header } from './components/Header';
import { ControlPanel, LoadParametersPanel, PlaybackPanel } from './components/ControlPanel';
import { Oscilloscope } from './components/Oscilloscope';
import { SchematicView } from './components/SchematicView';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { OverlapPanel } from './components/OverlapPanel';
import { ComparePanel } from './components/ComparePanel';
import { CollapsibleSection } from './components/CollapsibleSection';
import { HarmonicsPanel } from './components/HarmonicsPanel';
import { TheoryPanel } from './components/TheoryPanel';
import { CcmDcmModal } from './components/CcmDcmModal';
import { X, HelpCircle, CheckCircle, Lightbulb } from 'lucide-react';

const DEFAULT_PARAMS: SimulationParams = {
  topologyId: '1ph_fw_fully_controlled',
  vRms: 230,
  frequency: 50,
  alpha: 45,
  loadType: 'RL',
  R: 12,
  L: 0.05,
  E: 0,
  cyclesToDisplay: 2,
  hasFreewheelingDiode: false,
  semiConfig: 'symmetric',
};

export default function App() {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [currentSampleIndex, setCurrentSampleIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(0.5);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showCcmDcmModal, setShowCcmDcmModal] = useState<boolean>(false);
  const [reference, setReference] = useState<SimulationResult | null>(null); // pinned run for compare mode

  // Compute numerical simulation.
  // The run takes 60-200 ms, so it uses a deferred copy of the settings: controls (buttons, sliders)
  // react immediately, then the circuit, scope and metrics update together once the run is ready.
  // `view` is the settings the displayed results belong to, so schematic and waveforms never disagree.
  const view = useDeferredValue(params);
  const simulationResult = useMemo(() => {
    return runSimulation(view);
  }, [view]);

  const samples = simulationResult.samples;
  const sampleCount = samples.length;

  // Keep sample index in valid bounds
  useEffect(() => {
    if (currentSampleIndex >= sampleCount) {
      setCurrentSampleIndex(0);
    }
  }, [sampleCount, currentSampleIndex]);

  // Animation frame loop for sweeping the synchronized cursor
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    if (!isPlaying || sampleCount === 0) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const animate = (now: number) => {
      const deltaSeconds = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Pedagogical sweep: 6 seconds per full screen display at 1.0x speed
      const BASE_SWEEP_DURATION_SECONDS = 6.0;
      const stepAdvance = (deltaSeconds * playbackSpeed / BASE_SWEEP_DURATION_SECONDS) * sampleCount;

      setCurrentSampleIndex((prev) => {
        const next = prev + stepAdvance;
        return next >= sampleCount ? next % sampleCount : next;
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, sampleCount, playbackSpeed, simulationResult.period, params.cyclesToDisplay]);

  // Keyboard shortcuts: Space = play/pause, ←/→ = step (Shift = 5x), +/- = firing angle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const mult = e.shiftKey ? 5 : 1;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        setCurrentSampleIndex((i) => {
          const n = sampleCount || 1;
          return (((Math.floor(i) + dir * 5 * mult) % n) + n) % n;
        });
      } else if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
        if (!CONVERTER_CONFIGS[params.topologyId].controlled) return;
        e.preventDefault();
        const d = (e.key === '+' || e.key === '=') ? 1 : -1;
        setParams((prev) => ({ ...prev, alpha: Math.min(180, Math.max(0, prev.alpha + d * mult)) }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sampleCount, params.topologyId]);

  const handleReset = () => {
    setParams(DEFAULT_PARAMS);
    setCurrentSampleIndex(0);
  };

  // First gate-firing instant of the displayed run (rising edge of any gate pulse)
  const handleJumpToFiring = () => {
    setIsPlaying(false);
    let idx = -1;
    for (let i = 1; i < samples.length && idx === -1; i++) {
      const g = samples[i].gatePulses;
      const gPrev = samples[i - 1].gatePulses;
      for (const k of Object.keys(g)) {
        if (g[k] && !gPrev[k]) { idx = i; break; }
      }
    }
    setCurrentSampleIndex(idx === -1 ? 0 : idx);
  };

  const handleJumpToAngle = (targetDeg: number) => {
    setIsPlaying(false);
    const idx = samples.findIndex((s) => s.phaseAngleDeg >= targetDeg);
    if (idx !== -1) {
      setCurrentSampleIndex(idx);
    } else {
      setCurrentSampleIndex(0);
    }
  };

  const roundedIndex = Math.min(sampleCount - 1, Math.floor(currentSampleIndex));
  const activeSample = samples[roundedIndex] || samples[0];

  return (
    <div
      className="min-h-screen flex flex-col font-sans transition-colors bg-slate-950 text-slate-100"
    >
      {/* Top Navbar */}
      <Header
        currentTopologyId={params.topologyId}
        onSelectTopology={(id) => {
          setParams((prev) => ({ ...prev, topologyId: id }));
          setCurrentSampleIndex(0);
        }}
        conductionMode={simulationResult.conductionMode}
        onOpenCcmDcmModal={() => setShowCcmDcmModal(true)}
        onApplyConductionPreset={(kind) =>
          setParams((prev) => {
            if (kind === 'ccm') {
              return {
                ...prev,
                loadType: composeLoad(prev.loadType.includes('R'), true, prev.loadType.includes('E')),
                L: Math.max(0.08, prev.L * 3), // high inductance → continuous current
              };
            }
            if (kind === 'dcm') {
              return { ...prev, loadType: 'RL', L: 0.003, alpha: Math.max(45, prev.alpha) }; // low L → discontinuous
            }
            return { ...prev, loadType: 'R', L: 0 };
          })
        }
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        phaseAngleDeg={activeSample?.phaseAngleDeg || 0}
        onJumpToAngle={handleJumpToAngle}
        onJumpToFiring={handleJumpToFiring}
        alphaDeg={params.alpha}
        onReset={handleReset}
        onOpenQuickGuide={() => setShowGuideModal(true)}
      />

      {/* Main App Grid */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1720px] w-full mx-auto space-y-4">
        {/* Top Split: Controls & Schematic */}
        <div className="grid grid-cols-1 lg:grid-cols-12 print:grid-cols-12 gap-4">
          {/* Left - 6 cols: topology, source, firing angle, load type, then the R / L / E sliders */}
          <div className="lg:col-span-6 print:col-span-6 flex flex-col gap-4">
            <ControlPanel
              params={params}
              onChangeParams={setParams}
            />
            <LoadParametersPanel params={params} onChangeParams={setParams} />
          </div>

          {/* Right - 6 cols: circuit schematic (playback controls sit inside it, above the Conducting Loop strip) */}
          <div className="lg:col-span-6 print:col-span-6 flex flex-col gap-4">
            <div className="flex-1 flex flex-col min-h-0">
              <SchematicView
                topologyId={view.topologyId}
                deviceStates={activeSample?.deviceStates || {}}
                loadType={view.loadType}
                R={view.R}
                L={view.L}
                E={view.E}
                vOut={activeSample?.vOut || 0}
                iOut={activeSample?.iOut || 0}
                activeBranchDesc={activeSample?.activeBranchDescription || 'OFF'}
                phaseAngleDeg={activeSample?.phaseAngleDeg || 0}
                hasFreewheelingDiode={view.hasFreewheelingDiode}
                controlLoadType={params.loadType}
                controlHasFwd={params.hasFreewheelingDiode}
                controlTopologyId={params.topologyId}
                playbackSpeed={playbackSpeed}
                frequency={view.frequency}
                iPeak={simulationResult.peakCurrent}
                isFwdConducting={activeSample?.isFwdConducting}
                iFwd={activeSample?.iFwd || 0}
                semiConfig={view.semiConfig}
                isPlaying={isPlaying}
                onLoadTypeChange={(t) => setParams((prev) => ({ ...prev, loadType: t }))}
                onSemiConfigChange={(c) => setParams((prev) => ({ ...prev, semiConfig: c }))}
                alpha={params.alpha}
                onToggleFwd={(on) => setParams((prev) => ({ ...prev, hasFreewheelingDiode: on }))}
                playbackSlot={
                  <PlaybackPanel
                    playback={{
                      isPlaying,
                      onTogglePlay: () => setIsPlaying(!isPlaying),
                      playbackSpeed,
                      onChangeSpeed: setPlaybackSpeed,
                      currentSampleIndex: roundedIndex,
                      sampleCount,
                      onSampleChange: (idx) => {
                        setIsPlaying(false);
                        setCurrentSampleIndex(idx);
                      },
                    }}
                  />
                }
              />
            </div>
          </div>
        </div>

        {/* Middle: High-Resolution Oscilloscope with Dual Cursors and Grid Current is(t) */}
        <div className="w-full">
          <Oscilloscope
            simulationResult={simulationResult}
            currentSampleIndex={roundedIndex}
            onSampleChange={(idx) => {
              setIsPlaying(false);
              setCurrentSampleIndex(idx);
            }}
            cyclesToDisplay={params.cyclesToDisplay}
            onChangeCycles={(c) => setParams((prev) => ({ ...prev, cyclesToDisplay: c }))}
            reference={reference}
          />
        </div>

        {/* Measurements & Metrics */}
        <div className="w-full">
          <AnalyticsPanel result={simulationResult} />
        </div>

        {/* Compare mode: pin a run, then change settings and compare */}
        <div className="w-full">
          <CollapsibleSection title="Compare Mode" defaultOpen={false}>
            <ComparePanel
              current={simulationResult}
              reference={reference}
              onPin={() => setReference(simulationResult)}
              onClear={() => setReference(null)}
            />
          </CollapsibleSection>
        </div>

        {/* Source inductance: analytical overlap angle and voltage drop */}
        <div className="w-full">
          <CollapsibleSection title="Source Inductance & Overlap Angle (analytical)" defaultOpen={false}>
            <OverlapPanel result={simulationResult} />
          </CollapsibleSection>
        </div>

        {/* Power Quality & Harmonic Spectrum (FFT) */}
        <div className="w-full">
          <CollapsibleSection title="Power Quality & Harmonics" defaultOpen={false}>
            <HarmonicsPanel result={simulationResult} />
          </CollapsibleSection>
        </div>

        {/* Educational Theory & Physics Notes (expanded by default) */}
        <div className="w-full">
          <CollapsibleSection title="Theory & Physics Notes" defaultOpen={false}>
            <TheoryPanel topologyId={params.topologyId} semiConfig={params.semiConfig} alpha={params.alpha} />
          </CollapsibleSection>
        </div>
      </main>

      {/* User Guide Modal */}
      {showGuideModal && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-slate-100 text-sm">User Guide</h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded cursor-pointer"
                aria-label="Close guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-5 text-xs text-slate-300 leading-relaxed">
              <p>
                <strong className="text-slate-100">Rectifiode Studio</strong> simulates 10 AC-DC
                rectifiers (5 single-phase, 5 three-phase). Change a setting and every view updates:
                circuit, waveforms, measurements and harmonics.
              </p>

              {[
                {
                  title: 'Quick start',
                  items: [
                    ['Converter', 'Pick one of 10 rectifiers from Topology Selection.'],
                    ['Settings', 'Set source voltage, frequency, firing angle α (thyristor types) and the load, then press Sweep.'],
                    ['Reset Lab', 'Restores all defaults (top right).'],
                  ],
                },
                {
                  title: 'Playback and shortcuts',
                  items: [
                    ['Space', 'Play / pause the sweep.'],
                    ['← / →', 'Step through the waveform (hold Shift for bigger steps).'],
                    ['+ / −', 'Raise or lower the firing angle α (thyristor types).'],
                    ['Speed', 'Choose 0.1x to 2x under the circuit; the step buttons and Reset sit beside Sweep.'],
                    ['F / Esc', 'Enter or leave full screen on the circuit or the oscilloscope, whichever you used.'],
                  ],
                },
                {
                  title: 'Load, bypass and bridge',
                  items: [
                    ['Load chain', 'Switch R, L and E on or off in any combination. Without R, the small parasitic Rp limits current.'],
                    ['D_FW', 'Fit a freewheeling diode for inductive loads. Conducting diodes glow green, thyristors amber.'],
                    ['Bridge arrangement', 'Symmetric or asymmetric; active only for the half-controlled bridge and dimmed otherwise.'],
                  ],
                },
                {
                  title: 'Header menus',
                  items: [
                    ['Conduction Presets', 'Dropdown to force CCM, trigger DCM or switch to a pure R load. "CCM / DCM theory" opens the explanation.'],
                    ['Phase Jump', 'Jump the circuit and scope to ωt = 0°, the firing instant (α), the voltage peak or another angle.'],
                    ['Theme, Print / PDF', 'Dark or light theme; print always uses the light palette.'],
                  ],
                },
                {
                  title: 'Oscilloscope',
                  items: [
                    ['Channels', 'Toggle voltages, currents and gates; the device menu picks one device or all.'],
                    ['Cursors', 'Click or drag to freeze at any ωt, or press Measure to place cursors A and B and read the differences.'],
                    ['Full screen, PNG', 'Full screen enlarges the scope; PNG saves an image.'],
                  ],
                },
                {
                  title: 'Analysis',
                  items: [
                    ['Measurements', 'Vdc, Vrms, Idc, ripple, power factor and the CCM/DCM badge, compared with theory.'],
                    ['Harmonics, theory', 'Expand these sections for the FFT spectrum and the formulas.'],
                    ['Source inductance', 'Set Ls to see overlap angle μ and the voltage drop (analytical only).'],
                    ['Compare mode', 'Pin a run, change settings and compare against dashed reference traces.'],
                  ],
                },
              ].map((sec) => (
                <section key={sec.title} className="space-y-2">
                  <h4 className="text-[13px] font-bold text-amber-300">{sec.title}</h4>
                  <ul className="space-y-1.5">
                    {sec.items.map(([k, v]) => (
                      <li key={k} className="flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-slate-100">{k}:</strong> {v}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-xs cursor-pointer shadow-sm"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CCM & DCM Conduction Mode Physics Modal */}
      <CcmDcmModal
        isOpen={showCcmDcmModal}
        onClose={() => setShowCcmDcmModal(false)}
        result={simulationResult}
        params={params}
        onChangeParams={setParams}
      />
    </div>
  );
}
