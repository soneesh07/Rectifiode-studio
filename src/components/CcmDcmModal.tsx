import React from 'react';
import { X, Activity, Zap, CheckCircle, AlertTriangle, Gauge, Cpu } from 'lucide-react';
import { SimulationResult, SimulationParams } from '../types/converter';

interface CcmDcmModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: SimulationResult;
  params: SimulationParams;
  onChangeParams: (newParams: SimulationParams) => void;
}

export const CcmDcmModal: React.FC<CcmDcmModalProps> = ({
  isOpen,
  onClose,
  result,
  params,
}) => {

  if (!isOpen) return null;

  const isCcm = result.conductionMode.includes('Continuous');
  const tauMs = params.R > 0 ? ((params.L / params.R) * 1000).toFixed(1) : '∞';

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 bg-slate-900 border-slate-700 text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isCcm
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
              }`}
            >
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Conduction Mode: CCM vs DCM
              </h2>
              <p className="text-xs text-slate-500">
                The physics behind continuous and discontinuous conduction. Presets are in the header dropdown.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Status Banner */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            isCcm
              ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
              : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {isCcm ? (
              <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
            )}
            <div>
              <div className="font-bold text-sm">
                Current State: {result.conductionMode}
              </div>
              <div className="text-xs opacity-90">
                {isCcm
                  ? 'Load current io(t) is strictly positive (io > 0) throughout the entire period without returning to zero.'
                  : 'Load current io(t) drops to zero (io = 0) during each cycle before the subsequent switch is fired.'}
              </div>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[13px] font-bold font-mono uppercase tracking-wider shrink-0 ${
              isCcm
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isCcm ? 'Continuous (CCM)' : 'Discontinuous (DCM)'}
          </span>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl border bg-slate-950/60 border-slate-800">
            <span className="text-slate-500 block text-[13px]">Load Inductance L</span>
            <span className="font-mono font-bold text-sm text-sky-500">{(params.L * 1000).toFixed(1)} mH</span>
          </div>
          <div className="p-3 rounded-xl border bg-slate-950/60 border-slate-800">
            <span className="text-slate-500 block text-[13px]">Time Constant τ = L/R</span>
            <span className="font-mono font-bold text-sm text-purple-500">{tauMs} ms</span>
          </div>
          <div className="p-3 rounded-xl border bg-slate-950/60 border-slate-800">
            <span className="text-slate-500 block text-[13px]">Current Ripple Factor</span>
            <span className="font-mono font-bold text-sm text-amber-500">{result.rippleFactorI.toFixed(2)}</span>
          </div>
          <div className="p-3 rounded-xl border bg-slate-950/60 border-slate-800">
            <span className="text-slate-500 block text-[13px]">Average Current Io</span>
            <span className="font-mono font-bold text-sm text-emerald-500">{result.iAvg.toFixed(2)} A</span>
          </div>
        </div>

        {/* Key Physics Theory for Electrical Engineering Students */}
        <div className="p-4 rounded-xl border space-y-2 text-xs bg-slate-950/50 border-slate-800 text-slate-300">
          <div className="font-bold flex items-center gap-1.5 text-slate-100">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>Physical Principles for Classroom Lectures & Problem Sets</span>
          </div>
          <ul className="list-disc list-inside space-y-1.5 leading-relaxed pl-1 text-[13px]">
            <li>
              <strong>Continuous Conduction Mode (CCM):</strong> Occurs when the energy stored in the inductor (0.5 · L · Io²) is sufficient to sustain positive current until the next commutation instant (γ ≥ π/m). The output voltage follows the classical analytical formula Vdc = (2·Vm/π) · cos α (or (3√3·Vm/π) · cos α for 3-phase).
            </li>
            <li>
              <strong>Discontinuous Conduction Mode (DCM):</strong> Occurs when the load current falls to zero before the next pair of thyristors are fired. During the dead interval, io = 0, and if a back-EMF E is present, vo(t) = E. The classical cosine formula no longer applies directly and requires piecewise integration up to extinction angle β.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
