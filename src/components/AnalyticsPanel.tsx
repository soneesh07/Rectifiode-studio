import React from 'react';
import { SimulationResult } from '../types/converter';
import { CONVERTER_CONFIGS, getVrmsFormula } from '../simulator/engine';
import { Activity, Gauge, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';
import { MathFormula } from './MathFormula';

interface AnalyticsPanelProps {
  result: SimulationResult;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ result }) => {
  const cfg = CONVERTER_CONFIGS[result.params.topologyId];

  const formatV = (val: number) => `${val.toFixed(1)} V`;
  const formatI = (val: number) => `${val.toFixed(2)} A`;
  const formatP = (val: number) => (val > 1000 ? `${(val / 1000).toFixed(2)} kW` : `${val.toFixed(1)} W`);

  const isDCM = result.conductionMode.includes('DCM');
  const isResistive = result.params.loadType === 'R';

  // Live (simulated) value shown next to the analytical value, with % deviation
  const SimulatedValue: React.FC<{ simulated: number; theory?: number; accent: string }> = ({ simulated, theory, accent }) => {
    const dev = theory !== undefined && Math.abs(theory) > 1e-9 ? ((simulated - theory) / Math.abs(theory)) * 100 : undefined;
    const devColor =
      dev === undefined || !isResistive
        ? 'text-slate-400'
        : Math.abs(dev) < 1 ? 'text-emerald-400' : Math.abs(dev) < 5 ? 'text-amber-400' : 'text-red-400';
    return (
      <div className="ml-auto flex items-center gap-2.5 pl-3 border-l border-slate-800">
        <div className="flex flex-col items-end leading-tight">
          <span className="text-slate-500 text-[12px] font-mono uppercase tracking-wider">Simulated</span>
          <span className={`font-mono text-xl font-bold ${accent}`}>{simulated.toFixed(1)} V</span>
        </div>
        {dev !== undefined && (
          <div className="flex flex-col items-end leading-tight">
            <span className="text-slate-500 text-[12px] font-mono uppercase tracking-wider">Δ vs theory</span>
            <span className={`font-mono text-sm font-medium ${devColor}`}>
              {dev >= 0 ? '+' : ''}{dev.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden shadow-lg transition-colors border bg-slate-900/90 border-slate-800 text-slate-200 backdrop-blur"
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between transition-colors bg-slate-950/60 border-slate-800 text-slate-200"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Converter Measurements & Metrics
          </h2>
        </div>
        {/* Conduction Mode Badge */}
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium ${
            isDCM
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
          }`}
        >
          {isDCM ? (
            <AlertTriangle className="w-3 h-3 text-amber-400" />
          ) : (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          )}
          <span>{result.conductionMode}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Primary DC & RMS Output Metrics (Grid) - Center Aligned */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Vdc (Average) */}
          <div
            className="flex flex-col items-center text-center px-3 py-4 rounded-lg border transition-colors bg-slate-950/80 border-slate-800/80"
          >
            <span className="text-xs text-slate-300 block font-medium text-center">
              Average Vo (DC)
            </span>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold font-mono leading-none text-sky-400">
                {result.vAvg.toFixed(1)}
              </span>
              <span className="text-base text-slate-400 font-mono">V</span>
            </div>
            <span className="text-[13px] text-slate-400 block mt-1 text-center">
              DC output voltage
            </span>
          </div>

          {/* Vrms */}
          <div
            className="flex flex-col items-center text-center px-3 py-4 rounded-lg border transition-colors bg-slate-950/80 border-slate-800/80"
          >
            <span className="text-xs text-slate-300 block font-medium text-center">
              RMS Voltage (Vo,rms)
            </span>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold font-mono leading-none text-sky-300">
                {result.vRms.toFixed(1)}
              </span>
              <span className="text-base text-slate-400 font-mono">V</span>
            </div>
            <span className="text-[13px] text-slate-400 block mt-1 text-center">
              Effective load potential
            </span>
          </div>

          {/* Idc (Average) */}
          <div
            className="flex flex-col items-center text-center px-3 py-4 rounded-lg border transition-colors bg-slate-950/80 border-slate-800/80"
          >
            <span className="text-xs text-slate-300 block font-medium text-center">
              Average Io (DC)
            </span>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold font-mono leading-none text-emerald-400">
                {result.iAvg.toFixed(2)}
              </span>
              <span className="text-base text-slate-400 font-mono">A</span>
            </div>
            <span className="text-[13px] text-slate-400 block mt-1 text-center">
              DC load current
            </span>
          </div>

          {/* Irms */}
          <div
            className="flex flex-col items-center text-center px-3 py-4 rounded-lg border transition-colors bg-slate-950/80 border-slate-800/80"
          >
            <span className="text-xs text-slate-300 block font-medium text-center">
              RMS Current (Io,rms)
            </span>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold font-mono leading-none text-emerald-300">
                {result.iRms.toFixed(2)}
              </span>
              <span className="text-base text-slate-400 font-mono">A</span>
            </div>
            <span className="text-[13px] text-slate-400 block mt-1 text-center">
              Peak: {result.peakCurrent.toFixed(2)}A
            </span>
          </div>
        </div>

        {/* Secondary Engineering Ratios - Center Aligned */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80"
        >
          {/* Ripple Factor */}
          <div
            className="flex flex-col items-center text-center px-2.5 py-3.5 rounded-lg border transition-colors bg-slate-950/50 border-slate-800/60"
          >
            <span className="text-xs text-slate-300 block text-center">
              Ripple Factor (RF)
            </span>
            <span className="text-2xl font-bold font-mono leading-tight text-amber-400 mt-0.5 block text-center">
              {(result.rippleFactorV * 100).toFixed(1)}%
            </span>
            <span className="text-[13px] text-slate-400 block mt-0.5 text-center">
              γ = √(FF² - 1)
            </span>
          </div>

          {/* Form Factor */}
          <div
            className="flex flex-col items-center text-center px-2.5 py-3.5 rounded-lg border transition-colors bg-slate-950/50 border-slate-800/60"
          >
            <span className="text-xs text-slate-300 block text-center">
              Form Factor (FF)
            </span>
            <span
              className="text-2xl font-bold font-mono leading-tight mt-0.5 block text-center text-slate-200"
            >
              {result.formFactorV.toFixed(3)}
            </span>
            <span className="text-[13px] text-slate-400 block mt-0.5 text-center">
              FF = Vrms / Vdc
            </span>
          </div>

          {/* Active Power */}
          <div
            className="flex flex-col items-center text-center px-2.5 py-3.5 rounded-lg border transition-colors bg-slate-950/50 border-slate-800/60"
          >
            <span className="text-xs text-slate-300 block text-center">
              Active Power (P)
            </span>
            <span className="text-2xl font-bold font-mono leading-tight text-purple-400 mt-0.5 block text-center">
              {formatP(result.pActive)}
            </span>
            <span className="text-[13px] text-slate-400 block mt-0.5 text-center">
              Average real power
            </span>
          </div>

          {/* Power Factor */}
          <div
            className="flex flex-col items-center text-center px-2.5 py-3.5 rounded-lg border transition-colors bg-slate-950/50 border-slate-800/60"
          >
            <span className="text-xs text-slate-300 block text-center">
              Power Factor (PF)
            </span>
            <span
              className="text-2xl font-bold font-mono leading-tight mt-0.5 block text-center text-slate-200"
            >
              {result.powerFactor.toFixed(3)}
            </span>
            <span className="text-[13px] text-slate-400 block mt-0.5 text-center">
              {result.powerFactor < 0 ? 'PF = P / S (power returned to grid)' : 'PF = P / S (AC side)'}
            </span>
          </div>
        </div>

        {/* Theoretical vs Numerical Validation Box */}
        <div
          className="p-3 rounded-lg border bg-gradient-to-r from-slate-950 to-slate-900 border-slate-800"
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>Theoretical Analytical Formula (Resistive Reference)</span>
            </div>
            {result.params.loadType === 'R' && result.theoreticalVdc !== undefined && (
              <span className="font-mono text-sm text-emerald-400 font-medium">
                Numerical match: ±{(Math.abs(result.vAvg - result.theoreticalVdc) / result.theoreticalVdc * 100).toFixed(2)}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div
              className="px-3 py-2 min-h-[110px] rounded-md border overflow-x-auto bg-slate-900/80 border-slate-800"
            >
              <span className="text-slate-500 text-[12px] font-mono uppercase tracking-wider block mb-1">
                Average output voltage
              </span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <MathFormula
                  tex={`V_{\\text{dc}} = ${cfg.theoreticalFormulaVdc}`}
                  className="text-amber-300"
                />
                {result.theoreticalVdc !== undefined && (
                  <span
                    className="font-mono text-sm px-2 py-0.5 rounded bg-slate-800 text-slate-300"
                  >
                    = {result.theoreticalVdc.toFixed(1)} V
                  </span>
                )}
                <SimulatedValue simulated={result.vAvg} theory={result.theoreticalVdc} accent="text-amber-300" />
              </div>
            </div>
            <div
              className="px-3 py-2 min-h-[110px] rounded-md border overflow-x-auto bg-slate-900/80 border-slate-800"
            >
              <span className="text-slate-500 text-[12px] font-mono uppercase tracking-wider block mb-1">
                RMS output voltage
              </span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <MathFormula
                  tex={`V_{\\text{rms}} = ${getVrmsFormula(result.params.topologyId, result.params.alpha)}`}
                  className="text-sky-300"
                />
                {result.theoreticalVrms !== undefined && (
                  <span
                    className="font-mono text-sm px-2 py-0.5 rounded bg-slate-800 text-slate-300"
                  >
                    = {result.theoreticalVrms.toFixed(1)} V
                  </span>
                )}
                <SimulatedValue simulated={result.vRms} theory={result.theoreticalVrms} accent="text-sky-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
