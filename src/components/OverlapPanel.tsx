import React, { useState } from 'react';
import { SimulationResult } from '../types/converter';
import { CONVERTER_CONFIGS } from '../simulator/engine';
import { computeOverlap } from '../simulator/overlap';
import { AlertTriangle, Activity } from 'lucide-react';

interface Props {
  result: SimulationResult;
}

/** Analytical source-inductance panel. Does not change the simulated waveforms. */
export const OverlapPanel: React.FC<Props> = ({ result }) => {
  const { params } = result;
  const cfg = CONVERTER_CONFIGS[params.topologyId];
  const [lsMh, setLsMh] = useState<number>(2);

  const alphaDeg = cfg.controlled ? params.alpha : 0;
  const o = computeOverlap({
    topologyId: params.topologyId,
    vRms: params.vRms,
    frequency: params.frequency,
    alphaDeg,
    LsHenry: lsMh / 1000,
    Io: result.iAvg,
  });
  const vIdeal = result.vAvg;
  const vReal = vIdeal - o.dropV;
  const pct = Math.abs(vIdeal) > 1e-9 ? (o.dropV / Math.abs(vIdeal)) * 100 : 0;
  const isDCM = result.conductionMode.includes('DCM');

  const Card: React.FC<{ label: string; value: string; sub?: string; tone: string }> = ({ label, value, sub, tone }) => (
    <div className="flex flex-col items-center text-center px-3 py-3 rounded-lg border bg-slate-950/80 border-slate-800/80">
      <span className="text-xs text-slate-300 font-medium">{label}</span>
      <span className={`mt-1 text-2xl font-bold font-mono leading-none ${tone}`}>{value}</span>
      {sub && <span className="text-[12px] text-slate-400 mt-1">{sub}</span>}
    </div>
  );

  return (
    <div className="flex flex-col rounded-xl overflow-hidden shadow-lg border bg-slate-900/90 border-slate-800 text-slate-200 backdrop-blur">
      <div className="px-4 py-3 border-b flex items-center gap-2 text-left bg-slate-950/60 border-slate-800">
        <Activity className="w-4 h-4 text-sky-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Source Inductance &amp; Overlap Angle</h2>
      </div>
      <div className="p-4 space-y-4 text-xs text-slate-300">
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-slate-400">Source inductance per phase (Ls)</span>
          <span className="font-mono text-amber-400 font-semibold">{lsMh.toFixed(1)} mH</span>
        </div>
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={lsMh}
          onChange={(e) => setLsMh(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
      </div>

      {/* Same card grid whether or not overlap applies (values dimmed to "—"), so the panel never changes height */}
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2.5 transition-opacity duration-300 ${o.applicable ? '' : 'opacity-40'}`}>
        <Card label="Overlap angle μ" value={o.applicable ? `${o.muDeg.toFixed(1)}°` : '—'} tone="text-sky-400" />
        <Card label="Voltage drop ΔVdc" value={o.applicable ? `${o.dropV.toFixed(1)} V` : '—'} sub={o.applicable ? `${pct.toFixed(1)}% of ideal` : '\u00A0'} tone="text-red-400" />
        <Card label="Ideal Vdc (Ls = 0)" value={o.applicable ? `${vIdeal.toFixed(1)} V` : '—'} tone="text-sky-300" />
        <Card label="Vdc with Ls" value={o.applicable ? `${vReal.toFixed(1)} V` : '—'} tone="text-emerald-400" />
      </div>
      <p className={`leading-relaxed min-h-[3.25em] ${o.applicable ? 'text-slate-400' : 'text-slate-300'}`}>{o.note}</p>

      {o.failed && (
        <div className="flex items-start gap-2 text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Overlap would exceed the angle available before the next device must take over, so commutation fails. Reduce Ls or the load current, or lower α.</span>
        </div>
      )}
      {isDCM && o.applicable && (
        <div className="flex items-start gap-2 text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Discontinuous conduction: the constant-current assumption does not hold, so treat these values as rough.</span>
        </div>
      )}
      <p className="text-slate-500 leading-relaxed">
        First-order estimate using the simulated average load current. The waveforms above still assume Ls = 0.
      </p>
      </div>
    </div>
  );
};
