import React, { useMemo } from 'react';
import { MathFormula } from './MathFormula';
import {
  ConverterTopologyId,
  SimulationParams,
  SimulationResult,
} from '../types/converter';
import { CONVERTER_CONFIGS } from '../simulator/engine';
import { useTheme } from '../context/ThemeContext';
import { TrendingUp, Calculator, Download, CheckCircle, Compass, Zap, ArrowRight, Play } from 'lucide-react';

interface CharacteristicsCurvePanelProps {
  params: SimulationParams;
  result: SimulationResult;
  onChangeAlpha: (alpha: number) => void;
  currentPhaseAngleDeg: number;
}

export const CharacteristicsCurvePanel: React.FC<CharacteristicsCurvePanelProps> = ({
  params,
  result,
  onChangeAlpha,
  currentPhaseAngleDeg,
}) => {
  const { isLight } = useTheme();
  const cfg = CONVERTER_CONFIGS[params.topologyId];
  const isControlled = cfg.controlled;

  const Vm = Math.SQRT2 * params.vRms;
  const VmLine = Math.sqrt(2) * (params.vRms * Math.sqrt(3));

  // Compute theoretical transfer curve Vdc(alpha) from 0 to 180 degrees
  const curvePoints = useMemo(() => {
    const pts: { alpha: number; vdc: number }[] = [];
    const hasFwd = params.hasFreewheelingDiode || params.loadType === 'R';

    for (let a = 0; a <= 180; a += 2) {
      const aRad = (a * Math.PI) / 180;
      let v = 0;

      switch (params.topologyId) {
        case '1ph_hw_diode':
          v = Vm / Math.PI;
          break;
        case '1ph_fw_diode_bridge':
          v = (2 * Vm) / Math.PI;
          break;
        case '1ph_hw_thyristor':
          v = (Vm / (2 * Math.PI)) * (1 + Math.cos(aRad));
          break;
        case '1ph_fw_fully_controlled':
          if (hasFwd) {
            v = (Vm / Math.PI) * (1 + Math.cos(aRad));
          } else {
            // Highly inductive RL continuous conduction
            v = ((2 * Vm) / Math.PI) * Math.cos(aRad);
          }
          break;
        case '1ph_fw_semi_controlled':
          v = (Vm / Math.PI) * (1 + Math.cos(aRad));
          break;
        case '3ph_hw_diode':
          v = (3 * Math.sqrt(3) * Vm) / (2 * Math.PI);
          break;
        case '3ph_hw_thyristor':
          if (hasFwd && a > 30) {
            v = (3 * Vm) / (2 * Math.PI) * (1 + Math.cos(aRad + Math.PI / 6));
          } else {
            v = (3 * Math.sqrt(3) * Vm) / (2 * Math.PI) * Math.cos(aRad);
          }
          break;
        case '3ph_fw_diode_bridge':
          v = (3 * VmLine) / Math.PI;
          break;
        case '3ph_fw_semi_controlled':
          v = (3 * VmLine) / (2 * Math.PI) * (1 + Math.cos(aRad));
          break;
        case '3ph_fw_fully_controlled':
          if (hasFwd && a > 60) {
            v = (3 * VmLine) / Math.PI * (1 + Math.cos(aRad + Math.PI / 3));
          } else {
            v = (3 * VmLine) / Math.PI * Math.cos(aRad);
          }
          break;
        default:
          v = (2 * Vm) / Math.PI;
      }

      pts.push({ alpha: a, vdc: v });
    }
    return pts;
  }, [params.topologyId, Vm, VmLine, params.hasFreewheelingDiode, params.loadType]);

  // Current theoretical Vdc at active alpha
  const currentTheoryVdc = useMemo(() => {
    const pt = curvePoints.find((p) => Math.abs(p.alpha - params.alpha) <= 1);
    return pt ? pt.vdc : result.vAvg;
  }, [curvePoints, params.alpha, result.vAvg]);

  // Difference between simulation and theoretical formula
  const diffPercent = Math.abs(currentTheoryVdc) > 1e-2
    ? (Math.abs(result.vAvg - currentTheoryVdc) / Math.abs(currentTheoryVdc)) * 100
    : 0;

  // SVG Chart Dimensions
  const chartW = 540;
  const chartH = 200;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 35;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  // Max and Min for Y scale
  const maxVdc = Math.max(10, ...curvePoints.map((p) => p.vdc), result.vAvg);
  const minVdc = Math.min(-10, ...curvePoints.map((p) => p.vdc), result.vAvg);
  const vdcRange = Math.max(1, maxVdc - minVdc);

  const getX = (alpha: number) => padL + (alpha / 180) * plotW;
  const getY = (vdc: number) => padT + (1 - (vdc - minVdc) / vdcRange) * plotH;
  const zeroY = getY(0);

  // SVG Path for the curve
  const pathData = curvePoints.reduce((acc, p, idx) => {
    const x = getX(p.alpha);
    const y = getY(p.vdc);
    return idx === 0 ? `M ${x},${y}` : `${acc} L ${x},${y}`;
  }, '');

  // Operating point coordinates
  const opX = getX(params.alpha);
  const opY = getY(result.vAvg);

  // CSV Export Handler
  const handleExportCsv = () => {
    const headers = [
      'Time_s',
      'PhaseAngle_deg',
      'SourceVoltage_V',
      'SourceCurrent_A',
      'OutputVoltage_V',
      'OutputCurrent_A',
      'ActiveBranch',
    ];

    const rows = result.samples.map((s) => [
      s.time.toFixed(6),
      s.phaseAngleDeg.toFixed(2),
      s.vSourcePhaseA.toFixed(2),
      s.iSourcePhaseA.toFixed(3),
      s.vOut.toFixed(2),
      s.iOut.toFixed(3),
      `"${s.activeBranchDescription || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${params.topologyId}_simulation_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Click on chart to set alpha
  const handleChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isControlled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const relX = (clickX - padL) / plotW;
    const newAlpha = Math.round(Math.max(0, Math.min(180, relX * 180)));
    onChangeAlpha(newAlpha);
  };

  // Conduction state sequence for 6-pulse or 2-pulse bridge
  const getFiringSequenceInfo = () => {
    if (params.topologyId === '3ph_fw_fully_controlled' || params.topologyId === '3ph_fw_diode_bridge') {
      return [
        { label: 'T1 - T6', interval: '30° - 90°', active: currentPhaseAngleDeg % 360 >= 30 && currentPhaseAngleDeg % 360 < 90 },
        { label: 'T1 - T2', interval: '90° - 150°', active: currentPhaseAngleDeg % 360 >= 90 && currentPhaseAngleDeg % 360 < 150 },
        { label: 'T3 - T2', interval: '150° - 210°', active: currentPhaseAngleDeg % 360 >= 150 && currentPhaseAngleDeg % 360 < 210 },
        { label: 'T3 - T4', interval: '210° - 270°', active: currentPhaseAngleDeg % 360 >= 210 && currentPhaseAngleDeg % 360 < 270 },
        { label: 'T5 - T4', interval: '270° - 330°', active: currentPhaseAngleDeg % 360 >= 270 && currentPhaseAngleDeg % 360 < 330 },
        { label: 'T5 - T6', interval: '330° - 30°', active: currentPhaseAngleDeg % 360 >= 330 || currentPhaseAngleDeg % 360 < 30 },
      ];
    } else {
      return [
        { label: 'Pos Half: T1 - T2', interval: 'α to π', active: currentPhaseAngleDeg % 360 >= params.alpha && currentPhaseAngleDeg % 360 < 180 },
        { label: 'Neg Half: T3 - T4', interval: 'π+α to 2π', active: currentPhaseAngleDeg % 360 >= 180 + params.alpha && currentPhaseAngleDeg % 360 < 360 },
      ];
    }
  };

  const sequencePairs = getFiringSequenceInfo();

  return (
    <div
      className={`rounded-xl border shadow-lg transition-colors overflow-hidden ${
        isLight
          ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
          : 'bg-slate-900/90 border-slate-800 text-slate-200 backdrop-blur'
      }`}
    >
      {/* Header with Title & CSV Export */}
      <div
        className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 transition-colors ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-950/60 border-slate-800 text-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider">
            Transfer Characteristics & Analytical Verification
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              isLight
                ? 'bg-sky-50 border-sky-300 text-sky-800 hover:bg-sky-100 shadow-xs'
                : 'bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25'
            }`}
            title="Download complete numerical simulation time-series data as .CSV for MATLAB, Python, or Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Waveforms (.CSV)</span>
          </button>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side (7 cols): Interactive Characteristic Curve Vdc vs Alpha */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-amber-500" />
              <span>DC Output Voltage vs Firing Angle: V_dc(α)</span>
            </span>
            {isControlled && (
              <span className="text-[13px] text-slate-400 font-mono">
                Click chart to set α (Current: <strong className="text-amber-500">{params.alpha}°</strong>)
              </span>
            )}
          </div>

          {/* SVG Transfer Curve Chart */}
          <div
            className={`rounded-xl border p-2 relative flex items-center justify-center select-none ${
              isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className={`w-full h-auto ${isControlled ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={handleChartClick}
            >
              {/* Zero Reference Voltage Line (if minVdc < 0) */}
              {minVdc < 0 && (
                <line
                  x1={padL}
                  y1={zeroY}
                  x2={padL + plotW}
                  y2={zeroY}
                  stroke={isLight ? '#94a3b8' : '#475569'}
                  strokeDasharray="3 3"
                  strokeWidth="1.2"
                />
              )}

              {/* Grid Lines */}
              {[0, 45, 90, 135, 180].map((deg) => (
                <g key={`x-grid-${deg}`}>
                  <line
                    x1={getX(deg)}
                    y1={padT}
                    x2={getX(deg)}
                    y2={padT + plotH}
                    stroke={isLight ? '#e2e8f0' : '#1e293b'}
                    strokeWidth="1"
                  />
                  <text
                    x={getX(deg)}
                    y={chartH - 8}
                    fill={isLight ? '#64748b' : '#94a3b8'}
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                  >
                    {deg}°
                  </text>
                </g>
              ))}

              {/* Quadrant Legend Watermark */}
              {minVdc < 0 && (
                <>
                  <text
                    x={padL + 10}
                    y={padT + 16}
                    fill={isLight ? '#059669' : '#10b981'}
                    fontSize="9"
                    fontWeight="bold"
                    opacity="0.7"
                  >
                    Quadrant I: Rectification (Vdc &gt; 0)
                  </text>
                  <text
                    x={padL + plotW - 10}
                    y={padT + plotH - 8}
                    fill={isLight ? '#dc2626' : '#f87171'}
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="end"
                    opacity="0.7"
                  >
                    Quadrant IV: Inversion (Vdc &lt; 0)
                  </text>
                </>
              )}

              {/* Theoretical Characteristic Curve */}
              <path
                d={pathData}
                fill="none"
                stroke={isLight ? '#0284c7' : '#38bdf8'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Firing Angle Vertical Reference Line */}
              {isControlled && (
                <line
                  x1={opX}
                  y1={padT}
                  x2={opX}
                  y2={padT + plotH}
                  stroke="#f59e0b"
                  strokeDasharray="2 2"
                  strokeWidth="1.5"
                />
              )}

              {/* Live Operating Point Marker */}
              <circle
                cx={opX}
                cy={opY}
                r="7"
                fill="#f59e0b"
                fillOpacity="0.3"
                className="animate-ping"
              />
              <circle
                cx={opX}
                cy={opY}
                r="5"
                fill="#f59e0b"
                stroke={isLight ? '#ffffff' : '#0f172a'}
                strokeWidth="2"
              />

              {/* Live Operating Point Value Callout */}
              <g transform={`translate(${Math.min(padL + plotW - 65, Math.max(padL + 5, opX - 35))}, ${Math.max(padT + 16, Math.min(padT + plotH - 22, opY - 14))})`}>
                <rect
                  x="0"
                  y="0"
                  width="70"
                  height="18"
                  rx="4"
                  fill={isLight ? '#0f172a' : '#020617'}
                  stroke="#f59e0b"
                  strokeWidth="1"
                />
                <text
                  x="35"
                  y="12"
                  fill="#fbbf24"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                >
                  {result.vAvg.toFixed(1)}V @ {params.alpha}°
                </text>
              </g>

              {/* Y Axis Graduations */}
              <text x={padL - 6} y={padT + 4} fill={isLight ? '#64748b' : '#94a3b8'} fontSize="8" textAnchor="end" fontFamily="JetBrains Mono, monospace">
                {maxVdc.toFixed(0)}V
              </text>
              {minVdc < 0 && (
                <text x={padL - 6} y={zeroY + 3} fill={isLight ? '#64748b' : '#94a3b8'} fontSize="8" textAnchor="end" fontFamily="JetBrains Mono, monospace">
                  0V
                </text>
              )}
              <text x={padL - 6} y={padT + plotH} fill={isLight ? '#64748b' : '#94a3b8'} fontSize="8" textAnchor="end" fontFamily="JetBrains Mono, monospace">
                {minVdc.toFixed(0)}V
              </text>
            </svg>
          </div>

          {/* Bottom Commutation Timeline */}
          <div className="mt-3">
            <span className="text-[13px] font-semibold text-slate-500 block mb-1">
              Conduction & Firing Interval Sequence (Synchronized):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 text-[12px] font-mono">
              {sequencePairs.map((pair, idx) => (
                <div
                  key={idx}
                  className={`p-1.5 rounded-lg border text-center transition-all ${
                    pair.active
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-500 font-bold scale-[1.02] shadow-xs'
                      : isLight
                      ? 'bg-slate-100 border-slate-200 text-slate-500'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="truncate font-semibold">{pair.label}</div>
                  <div className="text-[11px] opacity-75">{pair.interval}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side (5 cols): Formula vs Numerical Benchmark & Step-by-Step */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
              <Calculator className="w-3.5 h-3.5 text-sky-500" />
              <span>Textbook Analytical Formula vs Numerical Integration</span>
            </div>

            {/* Formula Card */}
            <div
              className={`p-3.5 rounded-xl border space-y-2 text-xs ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="text-[13px] text-slate-500 uppercase tracking-wider font-semibold">
                Analytical Transfer Formula:
              </div>
              <div className="text-sky-600 dark:text-sky-400 bg-sky-500/10 px-3 py-2.5 rounded-lg border border-sky-500/20 flex justify-center overflow-x-auto">
                <MathFormula tex={`V_{\\text{dc}} = ${cfg.theoreticalFormulaVdc}`} />
              </div>

              {/* Substituted Numbers */}
              <div className="text-[13px] text-slate-500 space-y-1 font-mono pt-1">
                <div>Vm = √2 · {params.vRms}V = {Vm.toFixed(2)} V</div>
                {isControlled && <div>cos(α) = cos({params.alpha}°) = {Math.cos((params.alpha * Math.PI) / 180).toFixed(4)}</div>}
              </div>
            </div>
          </div>

          {/* Verification Results Comparison Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'}`}>
              <span className="text-slate-500 block text-[13px]">Theoretical Vdc</span>
              <span className="font-mono font-bold text-base text-sky-500">
                {currentTheoryVdc.toFixed(2)} V
              </span>
            </div>
            <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'}`}>
              <span className="text-slate-500 block text-[13px]">Simulated Vdc</span>
              <span className="font-mono font-bold text-base text-emerald-500">
                {result.vAvg.toFixed(2)} V
              </span>
            </div>
          </div>

          {/* Accuracy & Deviation Evaluation */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
              diffPercent < 3
                ? isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                : isLight
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <div>
                <span className="font-bold">Deviation: {diffPercent.toFixed(2)}%</span>
                <p className="text-[13px] opacity-80 leading-snug">
                  {diffPercent < 3
                    ? 'Numerical ODE integration matches theoretical textbook formula.'
                    : 'Finite ripple, commutation extinction, or load back-EMF introduces deviation.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
