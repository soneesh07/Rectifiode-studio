import React from 'react';
import { SimulationResult } from '../types/converter';
import { CONVERTER_CONFIGS } from '../simulator/engine';
import { Pin, PinOff } from 'lucide-react';

interface Props {
  current: SimulationResult;
  reference: SimulationResult | null;
  onPin: () => void;
  onClear: () => void;
}

interface Row {
  label: string;
  get: (r: SimulationResult) => number | string;
  unit?: string;
  digits?: number;
}

const ROWS: Row[] = [
  { label: 'Converter', get: (r) => CONVERTER_CONFIGS[r.params.topologyId].name },
  { label: 'Firing angle α', get: (r) => (CONVERTER_CONFIGS[r.params.topologyId].controlled ? r.params.alpha : 0), unit: '°', digits: 0 },
  { label: 'Load', get: (r) => `${r.params.loadType}${r.params.hasFreewheelingDiode ? ' + FWD' : ''}` },
  { label: 'Average Vo', get: (r) => r.vAvg, unit: ' V', digits: 1 },
  { label: 'RMS Vo', get: (r) => r.vRms, unit: ' V', digits: 1 },
  { label: 'Average Io', get: (r) => r.iAvg, unit: ' A', digits: 2 },
  { label: 'RMS Io', get: (r) => r.iRms, unit: ' A', digits: 2 },
  { label: 'Voltage ripple factor', get: (r) => r.rippleFactorV * 100, unit: ' %', digits: 1 },
  { label: 'Power factor', get: (r) => r.powerFactor, digits: 3 },
  { label: 'Current THD', get: (r) => r.thdCurrent, unit: ' %', digits: 1 },
  { label: 'Conduction', get: (r) => (r.conductionMode.includes('DCM') ? 'DCM' : 'CCM') },
];

/** Pin a run as a reference, then change settings and compare against it. */
export const ComparePanel: React.FC<Props> = ({ current, reference, onPin, onClear }) => {
  const fmt = (v: number | string, row: Row) =>
    typeof v === 'number' ? `${v.toFixed(row.digits ?? 1)}${row.unit ?? ''}` : v;

  return (
    <div className="flex flex-col rounded-xl overflow-hidden shadow-lg border bg-slate-900/90 border-slate-800 text-slate-200 backdrop-blur">
      <div className="px-4 py-3 border-b flex items-center gap-2 text-left bg-slate-950/60 border-slate-800">
        <Pin className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Compare Mode</h2>
      </div>
      <div className="p-4 space-y-3 text-xs text-slate-300">
        <p className="text-slate-400">Pin a run as the reference, change settings, and compare.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onPin}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
        >
          <Pin className="w-3.5 h-3.5" />
          {reference ? 'Re-pin current as reference' : 'Pin current as reference'}
        </button>
        {reference && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          >
            <PinOff className="w-3.5 h-3.5" />
            Clear reference
          </button>
        )}
      </div>

      {!reference ? (
        <p className="text-slate-400 leading-relaxed">
          Press the button, then change the converter, α or the load. The pinned output voltage and current appear as dashed lines on the scope,
          and a table shows both runs side by side.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="py-1.5 pr-3 font-medium">Quantity</th>
                <th className="py-1.5 pr-3 font-medium">Reference</th>
                <th className="py-1.5 pr-3 font-medium">Current</th>
                <th className="py-1.5 font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {ROWS.map((row) => {
                const a = row.get(reference);
                const b = row.get(current);
                const numeric = typeof a === 'number' && typeof b === 'number';
                const d = numeric ? (b as number) - (a as number) : 0;
                const changed = numeric ? Math.abs(d) > 1e-9 : a !== b;
                return (
                  <tr key={row.label} className="border-b border-slate-800/60">
                    <td className="py-1.5 pr-3 font-sans text-slate-300">{row.label}</td>
                    <td className="py-1.5 pr-3 text-slate-400">{fmt(a, row)}</td>
                    <td className={`py-1.5 pr-3 ${changed ? 'text-amber-300' : 'text-slate-200'}`}>{fmt(b, row)}</td>
                    <td className="py-1.5 text-slate-300">
                      {numeric && changed ? `${d >= 0 ? '+' : ''}${d.toFixed(row.digits ?? 1)}${row.unit ?? ''}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
};
