import React from 'react';
import {
  ConverterConfig,
  ConverterTopologyId,
  SimulationParams,
} from '../types/converter';
import { CONVERTER_CONFIGS } from '../simulator/engine';
import { TopologySelect } from './TopologySelect';
import { Sliders, Zap, Layers, Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';

/** Time-sweep (playback) state + callbacks, rendered by <PlaybackPanel/> under the circuit schematic. */
export interface PlaybackControls {
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  currentSampleIndex: number;
  sampleCount: number;
  onSampleChange: (index: number) => void;
}

interface ControlPanelProps {
  params: SimulationParams;
  onChangeParams: (newParams: SimulationParams) => void;
}

/**
 * Tick labels that sit exactly under their value on a range input.
 * Native range thumbs travel (width - thumbWidth), so each label is offset to follow the thumb centre;
 * the first/last labels are pinned to the edges. Every tick is clickable and sets that value.
 */
const THUMB_PX = 16;
interface Tick { value: number; label: React.ReactNode; onPick?: () => void; }
const Ticks: React.FC<{ min: number; max: number; ticks: Tick[]; disabled?: boolean }> = ({ min, max, ticks, disabled }) => (
  <div className="relative h-4 mt-1 text-[12px] text-slate-500 select-none">
    {ticks.map((t, i) => {
      const p = ((t.value - min) / (max - min)) * 100;
      const style: React.CSSProperties =
        p <= 0 ? { left: 0 } : p >= 100 ? { right: 0 } : { left: `calc(${p}% + ${(0.5 - p / 100) * THUMB_PX}px)`, transform: 'translateX(-50%)' };
      return (
        <span key={i} className="absolute top-0 whitespace-nowrap leading-4" style={style}>
          {t.onPick && !disabled ? (
            <button type="button" onClick={t.onPick} className="cursor-pointer hover:text-slate-200 transition-colors">
              {t.label}
            </button>
          ) : (
            t.label
          )}
        </span>
      );
    })}
  </div>
);

export const ControlPanel: React.FC<ControlPanelProps> = ({
  params,
  onChangeParams,
}) => {
  const currentConfig: ConverterConfig = CONVERTER_CONFIGS[params.topologyId];

  const updateParam = <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
    onChangeParams({
      ...params,
      [key]: value,
    });
  };

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden shadow-lg transition-colors border bg-slate-900/90 border-slate-800 text-slate-200 backdrop-blur"
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-start text-left transition-colors bg-slate-950/60 border-slate-800 text-slate-200"
      >
        <div className="flex items-center justify-start gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 text-left">
            Converter Configuration
          </h2>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Converter Topology Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Topology Selection
          </label>
          <TopologySelect
            value={params.topologyId}
            configs={Object.values(CONVERTER_CONFIGS)}
            onChange={(newId) => {
              const cfg = CONVERTER_CONFIGS[newId];
              onChangeParams({
                ...params,
                topologyId: newId,
                alpha: cfg.controlled ? cfg.defaultAlpha : 0,
              });
            }}
          />
          <p className="mt-1.5 text-[13px] text-slate-400 leading-snug min-h-[2.75em]">
            {currentConfig.description}
          </p>
        </div>

        {/* Input AC Voltage & Frequency Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 items-start pt-2 border-t border-slate-800/80">
          {/* RMS Input Voltage */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-400">RMS Voltage (Vs,rms)</span>
              <span className="font-mono text-amber-400 font-semibold">{params.vRms} V</span>
            </div>
            <input
              type="range"
              min={24}
              max={480}
              step={1}
              value={params.vRms}
              onChange={(e) => updateParam('vRms', Number(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <Ticks
              min={24}
              max={480}
              ticks={[24, 120, 230, 480].map((v) => ({ value: v, label: `${v}V`, onPick: () => updateParam('vRms', v) }))}
            />
          </div>

          {/* Frequency */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-400">AC Frequency (f)</span>
              <span className="font-mono text-amber-400 font-semibold">{params.frequency} Hz</span>
            </div>
            <input
              type="range"
              min={20}
              max={400}
              step={5}
              value={params.frequency}
              onChange={(e) => updateParam('frequency', Number(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <Ticks
              min={20}
              max={400}
              ticks={[
                { value: 20, label: '20Hz', onPick: () => updateParam('frequency', 20) },
                { value: 200, label: '200Hz', onPick: () => updateParam('frequency', 200) },
                { value: 400, label: '400Hz', onPick: () => updateParam('frequency', 400) },
              ]}
            />
            <div className="flex items-center gap-1.5 mt-1.5">
              {[50, 60, 400].map((hz) => (
                <button
                  key={hz}
                  type="button"
                  onClick={() => updateParam('frequency', hz)}
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-mono transition-colors cursor-pointer ${
                    params.frequency === hz
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold'
                      : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  {hz} Hz
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Firing Angle α Control.
            Always rendered so the layout never changes height; for diode (uncontrolled) topologies it
            is faded out and made non-interactive, and the scale labels crossfade into an explanatory note. */}
        {(() => {
          const active = currentConfig.controlled;
          return (
            <div
              aria-disabled={!active}
              inert={!active}
              className={`pt-2 border-t border-slate-800/80 bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/20 transition-[opacity,filter] duration-300 ease-out ${
                active ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none select-none'
              }`}
            >
              <div className="flex justify-between items-center text-xs mb-1">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold text-amber-200">Firing Angle (α)</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateParam('alpha', Math.max(0, params.alpha - 5))}
                    className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[12px]"
                  >
                    -5°
                  </button>
                  <span className="font-mono text-amber-400 font-bold text-sm px-1">
                    {params.alpha}°
                  </span>
                  <button
                    onClick={() => updateParam('alpha', Math.min(180, params.alpha + 5))}
                    className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[12px]"
                  >
                    +5°
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={180}
                step={1}
                value={params.alpha}
                onChange={(e) => updateParam('alpha', Number(e.target.value))}
                className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
              {/* Scale labels and the "uncontrolled" note share one cell, so the card keeps its height */}
              <div className="grid mt-1 text-[12px] font-mono">
                <div
                  aria-hidden={!active}
                  className={`col-start-1 row-start-1 text-slate-400 transition-opacity duration-300 ${
                    active ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <Ticks
                    min={0}
                    max={180}
                    disabled={!active}
                    ticks={[
                      { value: 0, label: '0° (Diode)', onPick: () => updateParam('alpha', 0) },
                      { value: 30, label: '30°', onPick: () => updateParam('alpha', 30) },
                      { value: 60, label: '60°', onPick: () => updateParam('alpha', 60) },
                      { value: 90, label: '90° (0V DC)', onPick: () => updateParam('alpha', 90) },
                      { value: 120, label: '120°', onPick: () => updateParam('alpha', 120) },
                      { value: 180, label: '180°', onPick: () => updateParam('alpha', 180) },
                    ]}
                  />
                </div>
                <div
                  aria-hidden={active}
                  className={`col-start-1 row-start-1 flex items-center gap-2 text-slate-200 font-sans transition-opacity duration-300 ${
                    active ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                  <span>Uncontrolled diode rectifier: natural commutation, α = 0°</span>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
};

/**
 * Load parameters (R, L, E).
 * Lives in the left column, directly under the converter configuration.
 */
export const LoadParametersPanel: React.FC<ControlPanelProps> = ({
  params,
  onChangeParams,
}) => {
  const updateParam = <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
    onChangeParams({
      ...params,
      [key]: value,
    });
  };

  const showL = params.loadType.includes('L');
  const showE = params.loadType.includes('E');
  const hasR = params.loadType.includes('R');

  return (
    <div className="flex flex-col flex-1 rounded-xl overflow-hidden shadow-lg transition-colors border bg-slate-900/90 border-slate-800 text-slate-200 backdrop-blur">
      <div className="px-4 py-2.5 border-b flex items-center justify-between transition-colors bg-slate-950/60 border-slate-800 text-slate-200">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Load Parameters
          </h2>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-y-4">
        {/* Resistor R */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">{hasR ? 'Resistance (R)' : 'Parasitic resistance (Rp)'}</span>
            <span className="font-mono text-emerald-400 font-semibold">{params.R} Ω</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            step={1}
            value={params.R}
            onChange={(e) => updateParam('R', Number(e.target.value))}
            className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <Ticks
            min={1}
            max={100}
            ticks={[{ value: 1, label: '1 Ω' }, { value: 50, label: '50 Ω' }, { value: 100, label: '100 Ω' }]}
          />
        </div>

        {/* Inductor L — always rendered, dimmed when not in the load */}
        <div
          aria-disabled={!showL}
          className={`transition-[opacity,filter] duration-300 ease-out ${
            showL ? 'opacity-100' : 'opacity-35 grayscale pointer-events-none select-none'
          }`}
        >
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">
              Inductance (L){!showL && <span className="ml-2 font-mono text-[12px] text-slate-500">· not in circuit</span>}
            </span>
            <span className="font-mono text-emerald-400 font-semibold">
              {(params.L * 1000).toFixed(0)} mH
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={0.2}
            step={0.005}
            value={params.L}
            disabled={!showL}
            tabIndex={showL ? 0 : -1}
            onChange={(e) => updateParam('L', Number(e.target.value))}
            className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:cursor-not-allowed"
          />
          <Ticks
            min={0}
            max={0.2}
            ticks={[{ value: 0, label: '0 mH' }, { value: 0.1, label: '100 mH' }, { value: 0.2, label: '200 mH' }]}
          />
        </div>

        {/* DC Battery EMF E — always rendered, dimmed when not in the load */}
        <div
          aria-disabled={!showE}
          className={`transition-[opacity,filter] duration-300 ease-out ${
            showE ? 'opacity-100' : 'opacity-35 grayscale pointer-events-none select-none'
          }`}
        >
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">
              Back-EMF (E){showE && params.E < 0 ? ' — reversed' : ''}
              {!showE && <span className="ml-2 font-mono text-[12px] text-slate-500">· not in circuit</span>}
            </span>
            <span className="font-mono text-emerald-400 font-semibold">{params.E} V</span>
          </div>
          <input
            type="range"
            min={-150}
            max={150}
            step={2}
            value={params.E}
            disabled={!showE}
            tabIndex={showE ? 0 : -1}
            onChange={(e) => updateParam('E', Number(e.target.value))}
            className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:cursor-not-allowed"
          />
          <Ticks
            min={-150}
            max={150}
            ticks={[{ value: -150, label: '-150 V' }, { value: 0, label: '0 V' }, { value: 150, label: '150 V' }]}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Playback (time-sweep) controls: reset, step, Sweep/Pause and speed.
 * Rendered as a flat, left-aligned bar inside the schematic card, just above the Conducting Loop banner.
 */
export const PlaybackPanel: React.FC<{ playback: PlaybackControls }> = ({ playback }) => {
  const iconBtn =
    'h-11 w-11 shrink-0 flex items-center justify-center rounded-lg border border-slate-800 bg-slate-950/50 text-slate-300 hover:text-slate-50 hover:bg-slate-800 hover:border-slate-700 transition-colors';

  return (
    <div className="no-print border-t border-slate-800 bg-slate-950/60 text-slate-200">
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="text-sm font-semibold text-slate-300 w-full sm:w-auto">Playback:</span>

        {/* Transport + speed, left-aligned */}
        <div className="flex flex-1 basis-[300px] items-center gap-3">
          <button
            type="button"
            onClick={() => playback.onSampleChange(0)}
            title="Reset to t=0"
            className={iconBtn}
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => playback.onSampleChange(Math.max(0, playback.currentSampleIndex - 25))}
            title="Step Back"
            className={iconBtn}
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={playback.onTogglePlay}
            className={`h-11 min-w-[7rem] flex-1 flex items-center justify-center gap-2 font-semibold rounded-lg border text-base transition-colors ${
              playback.isPlaying
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500 text-slate-950 border-emerald-500 hover:bg-emerald-400 shadow-sm'
            }`}
          >
            {playback.isPlaying ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Sweep</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() =>
              playback.onSampleChange(Math.min(playback.sampleCount - 1, playback.currentSampleIndex + 25))
            }
            title="Step Forward"
            className={iconBtn}
          >
            <SkipForward className="w-5 h-5" />
          </button>

        </div>

        {/* Speed selector */}
        <div className="h-11 flex flex-1 basis-[260px] items-stretch border border-slate-800 rounded-lg overflow-hidden text-sm font-mono">
          {[0.1, 0.25, 0.5, 1.0, 2.0].map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => playback.onChangeSpeed(spd)}
              className={`flex-1 px-2 transition-colors ${
                playback.playbackSpeed === spd
                  ? 'bg-slate-700 text-amber-300 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
