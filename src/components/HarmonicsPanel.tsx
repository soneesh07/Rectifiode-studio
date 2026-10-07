import React, { useState } from 'react';
import { SimulationResult, HarmonicComponent } from '../types/converter';
import { BarChart3, Zap, Activity, Info } from 'lucide-react';

interface HarmonicsPanelProps {
  result: SimulationResult;
}

export const HarmonicsPanel: React.FC<HarmonicsPanelProps> = ({ result }) => {
  const [harmonicTarget, setHarmonicTarget] = useState<'current' | 'voltage'>('current');

  const harmonics: HarmonicComponent[] =
    harmonicTarget === 'current' ? result.harmonicsIs : result.harmonicsVo;

  const maxMagnitude = Math.max(1e-3, ...harmonics.map((h) => h.magnitude));

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden shadow-lg transition-colors border bg-slate-900/90 border-slate-800 text-slate-200 backdrop-blur"
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left transition-colors bg-slate-950/60 border-slate-800 text-slate-200"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Harmonic & Power Quality Spectrum (FFT)
          </h2>
        </div>

        {/* Target Switcher */}
        <div className="flex items-center p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setHarmonicTarget('current')}
            className={`px-3 py-1 font-medium rounded-md transition-colors ${
              harmonicTarget === 'current'
                ? 'bg-slate-800 text-purple-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Line Current is(t)
          </button>
          <button
            onClick={() => setHarmonicTarget('voltage')}
            className={`px-3 py-1 font-medium rounded-md transition-colors ${
              harmonicTarget === 'voltage'
                ? 'bg-slate-800 text-sky-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Output Voltage vo(t)
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Power Quality KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {/* THD Current */}
          <div className="flex flex-col items-center text-center bg-slate-950/80 px-2.5 py-3.5 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-300 block font-medium">THD Current (THDi)</span>
            <span className="text-2xl font-bold font-mono leading-tight text-purple-400 mt-0.5 block">
              {result.thdCurrent.toFixed(1)}%
            </span>
            <span className="text-[13px] text-slate-400">Grid current distortion</span>
          </div>

          {/* Displacement Power Factor (DPF) */}
          <div className="flex flex-col items-center text-center bg-slate-950/80 px-2.5 py-3.5 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-300 block font-medium">Displacement PF</span>
            <span className="text-2xl font-bold font-mono leading-tight text-amber-400 mt-0.5 block">
              {result.displacementPowerFactor.toFixed(3)}
            </span>
            <span className="text-[13px] text-slate-400">DPF = cos(φ₁)</span>
          </div>

          {/* Distortion Factor (DF) */}
          <div className="flex flex-col items-center text-center bg-slate-950/80 px-2.5 py-3.5 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-300 block font-medium">Distortion Factor</span>
            <span className="text-2xl font-bold font-mono leading-tight text-emerald-400 mt-0.5 block">
              {result.distortionFactor.toFixed(3)}
            </span>
            <span className="text-[13px] text-slate-400">DF = I₁,rms / Is,rms</span>
          </div>

          {/* Total True Power Factor */}
          <div className="flex flex-col items-center text-center bg-slate-950/80 px-2.5 py-3.5 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-300 block font-medium">True Power Factor</span>
            <span className="text-2xl font-bold font-mono leading-tight text-sky-400 mt-0.5 block">
              {(result.displacementPowerFactor * result.distortionFactor).toFixed(3)}
            </span>
            <span className="text-[13px] text-slate-400">PF = DPF × DF</span>
          </div>

          {/* Source Line Current RMS */}
          <div className="flex flex-col items-center text-center bg-slate-950/80 px-2.5 py-3.5 rounded-lg border border-slate-800 col-span-2 sm:col-span-4 lg:col-span-1">
            <span className="text-xs text-slate-300 block font-medium">Supply Current RMS</span>
            <span className="text-2xl font-bold font-mono leading-tight text-slate-200 mt-0.5 block">
              {result.iSourceRms.toFixed(2)} A
            </span>
            <span className="text-[13px] text-slate-400">Fund: {result.iSourceFundamentalRms.toFixed(2)}A</span>
          </div>
        </div>

        {/* FFT Bar Chart */}
        <div className="bg-slate-950/90 p-4 rounded-lg border border-slate-800">
          <div className="flex flex-col items-start gap-1 mb-3 text-xs text-left">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium text-sm">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>
                {harmonicTarget === 'current'
                  ? 'Source Current Harmonic Spectrum (Orders 1 - 25)'
                  : 'Output Voltage Ripple Harmonic Spectrum (Orders 1 - 25)'}
              </span>
            </div>
            <span className="text-[13px] text-slate-500 font-mono">
              Base Frequency: {result.params.frequency} Hz
            </span>
          </div>

          {/* Spectrum Bars */}
          <div className="h-44 flex items-end gap-1 sm:gap-1.5 pt-6 pb-2 px-1 border-b border-slate-800 relative">
            {/* Horizontal grid markings */}
            <div className="absolute inset-x-0 top-6 border-b border-slate-800/60 pointer-events-none" />
            <div className="absolute inset-x-0 top-20 border-b border-slate-800/40 pointer-events-none" />

            {harmonics.map((h) => {
              const heightPct = Math.max(2, (h.magnitude / maxMagnitude) * 100);
              const isDominant = h.percentage > 15;
              const isFundamental = h.order === 1;

              return (
                <div
                  key={h.order}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                    <div className="bg-slate-800 border border-slate-700 text-[12px] font-mono p-1.5 rounded shadow-xl whitespace-nowrap text-slate-200">
                      <div>Order: <strong>h={h.order}</strong> ({h.frequencyHz} Hz)</div>
                      <div>Magnitude: <strong>{h.magnitude.toFixed(2)} {harmonicTarget === 'current' ? 'A' : 'V'}</strong></div>
                      <div>Relative: <strong>{h.percentage.toFixed(1)}%</strong></div>
                    </div>
                  </div>

                  {/* Percentage label on top of dominant bars */}
                  {isDominant && (
                    <span className="text-[11px] font-mono text-purple-300 mb-0.5 -rotate-90 sm:rotate-0 origin-bottom">
                      {h.percentage.toFixed(0)}%
                    </span>
                  )}

                  {/* Bar */}
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t transition-all ${
                      isFundamental
                        ? 'bg-gradient-to-t from-purple-600 to-purple-400 group-hover:to-purple-300'
                        : isDominant
                        ? 'bg-gradient-to-t from-amber-600 to-amber-400 group-hover:to-amber-300'
                        : 'bg-slate-700 group-hover:bg-slate-600'
                    }`}
                  />

                  {/* Order label at bottom */}
                  <span
                    className={`text-[11px] font-mono mt-1 ${
                      isDominant || isFundamental ? 'text-amber-300 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {h.order}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center justify-center gap-1 text-[12px] text-slate-500 font-mono mt-2 text-center">
            <span>Harmonic Order (n = f_harmonic / f_base)</span>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-purple-400 inline-block" /> Fundamental (h=1)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> Significant Harmonics (&gt;15%)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
