import React from 'react';
import { LoadType, SemiControlledConfig, composeLoad } from '../types/converter';

interface LoadFwdSelectorProps {
  loadType: LoadType;
  onLoadTypeChange: (t: LoadType) => void;
  hasFreewheelingDiode: boolean;
  onToggleFwd: (on: boolean) => void;
  isFwdConducting?: boolean;
  iFwd?: number;
  R?: number;
  L?: number; // henry
  E?: number;
  /** Only passed for the semi-controlled bridge: shows the symmetric / asymmetric picker under the bypass path. */
  semiConfig?: SemiControlledConfig;
  /** false = picker stays visible but dimmed and locked (every topology except the semi-controlled bridge). */
  semiEnabled?: boolean;
  onSemiConfigChange?: (c: SemiControlledConfig) => void;
  alpha?: number;
}

/* ---- Mini schematic glyphs (stroke = currentColor) ------------------------ */
const ResistorGlyph = () => (
  <svg viewBox="0 0 60 20" className="w-14 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 10 H14 L17 3 L23 17 L29 3 L35 17 L41 3 L44 10 H58" />
  </svg>
);
const InductorGlyph = () => (
  <svg viewBox="0 0 60 20" className="w-14 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M2 14 H10 C10 2 20 2 20 14 C20 2 30 2 30 14 C30 2 40 2 40 14 C40 2 50 2 50 14 H58" />
  </svg>
);
const BatteryGlyph = () => (
  <svg viewBox="0 0 60 20" className="w-14 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M2 10 H24 M24 3 V17 M32 6 V14 M32 10 H58" />
    <path d="M44 4 V8 M42 6 H46" strokeWidth="1.2" />
  </svg>
);
const DiodeGlyph = () => (
  <svg viewBox="0 0 60 20" className="w-14 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 10 H22 M38 10 H58 M22 3 V17 L38 10 Z M38 3 V17" />
  </svg>
);

interface ModuleProps {
  active: boolean;
  locked?: boolean;
  symbol: string;
  name: string;
  hint: string;
  glyph: React.ReactNode;
  onClick?: () => void;
}

/** A "plug-in" load module: solid when installed in the series chain, dashed ghost when removed. */
const Module: React.FC<ModuleProps> = ({ active, locked, symbol, name, hint, glyph, onClick }) => (
  <button
    type="button"
    role="switch"
    aria-checked={active}
    aria-disabled={locked}
    disabled={locked}
    onClick={onClick}
    className={`group relative w-full flex flex-col items-start gap-1 pl-3 pr-2 py-1.5 rounded-lg border text-left overflow-hidden transition-[background-color,border-color,color,box-shadow] duration-300 ease-out ${
      active
        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_-4px_var(--color-emerald-500)]'
        : 'bg-black border-slate-800 text-slate-600 shadow-none hover:border-slate-700 hover:text-slate-400'
    } ${locked ? 'cursor-default' : 'cursor-pointer'}`}
  >
    <span
      className={`absolute left-0 top-0 bottom-0 w-1 origin-center bg-emerald-400 transition-opacity duration-300 ease-out ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    />
    <span className="flex flex-col leading-tight min-w-0">
      <span className="font-mono text-sm font-bold">{symbol}</span>
      <span className="text-[12px] opacity-80 truncate" title={name === 'Battery' ? 'Battery / EMF' : name}>{name}</span>
    </span>
    <span className={`self-center shrink-0 transition-opacity duration-300 ease-out ${active ? 'opacity-100' : 'opacity-30'}`}>
      {glyph}
    </span>
  </button>
);

export const LoadFwdSelector: React.FC<LoadFwdSelectorProps> = ({
  loadType,
  onLoadTypeChange,
  hasFreewheelingDiode,
  onToggleFwd,
  isFwdConducting = false,
  iFwd = 0,
  R,
  L,
  E,
  semiConfig = 'symmetric',
  semiEnabled = false,
  onSemiConfigChange,
  alpha = 0,
}) => {
  const hasR = loadType.includes('R');
  const hasL = loadType.includes('L');
  const hasE = loadType.includes('E');
  const count = Number(hasR) + Number(hasL) + Number(hasE);

  // Toggle one element; the last remaining element cannot be removed
  const setModules = (r: boolean, l: boolean, e: boolean) => {
    if (!r && !l && !e) return;
    onLoadTypeChange(composeLoad(r, l, e));
  };

  const label = loadType;
  const desc =
    loadType === 'R' ? 'Purely resistive'
    : loadType === 'RE' ? 'Battery charging'
    : loadType === 'RL' ? 'Inductive load'
    : loadType === 'L' ? 'Pure inductor (only parasitic Rp limits current)'
    : loadType === 'E' ? 'Pure battery / EMF (only Rp limits the pulses)'
    : loadType === 'LE' ? 'Inductor + battery (only Rp limits current)'
    : 'DC motor / machine';

  return (
    <div className="w-full shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(9.5rem,0.9fr)] gap-3 rounded-xl border border-slate-800 bg-slate-950/70 backdrop-blur p-2.5">
      {/* ---- Load chain builder ---- */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] font-mono uppercase tracking-wider text-slate-400 whitespace-nowrap">Load chain</span>
          <span className="font-mono text-xs font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
            {label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
        <Module
          active={hasR}
          locked={hasR && count === 1}
          symbol="R"
          name="Resistance"
          hint="+ Add resistor"
          glyph={<ResistorGlyph />}
          onClick={() => setModules(!hasR, hasL, hasE)}
        />
        <Module
          active={hasL}
          locked={hasL && count === 1}
          symbol="L"
          name="Inductor"
          hint="+ Add inductor"
          glyph={<InductorGlyph />}
          onClick={() => setModules(hasR, !hasL, hasE)}
        />
        <Module
          active={hasE}
          locked={hasE && count === 1}
          symbol="E"
          name="Battery"
          hint="+ Add battery"
          glyph={<BatteryGlyph />}
          onClick={() => setModules(hasR, hasL, !hasE)}
        />
        </div>
        <p title={desc} className="mt-1.5 text-[12px] leading-snug text-slate-500 h-[2.6em] overflow-hidden">{desc}</p>
      </div>

      {/* ---- Freewheeling diode "bypass" switch ---- */}
      <div className="pt-2.5 border-t border-slate-800 sm:pt-0 sm:border-t-0 lg:border-l lg:pl-3">
        <span className="block mb-1.5 text-[12px] font-mono uppercase tracking-wider text-slate-400">Bypass path</span>
        <button
          type="button"
          role="switch"
          aria-checked={hasFreewheelingDiode}
          onClick={() => onToggleFwd(!hasFreewheelingDiode)}
          className={`w-full rounded-lg border p-2 text-left transition-[background-color,border-color,color] duration-300 ease-out ${
            hasFreewheelingDiode
              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
              : 'bg-black border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-bold">D_FW</span>
            {/* slide-style pill */}
            <span
              className={`relative w-9 h-[18px] rounded-full border transition-colors duration-300 ease-out ${
                hasFreewheelingDiode ? 'bg-emerald-500/30 border-emerald-500/60' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <span
                className={`absolute top-[2px] left-[2px] w-3 h-3 rounded-full transition-[transform,background-color] duration-300 ease-out ${
                  hasFreewheelingDiode ? 'translate-x-[18px] bg-emerald-300' : 'translate-x-0 bg-slate-600'
                } ${isFwdConducting ? 'animate-pulse' : ''}`}
              />
            </span>
          </div>
          <div className={`mt-1 flex justify-center transition-opacity duration-300 ease-out ${hasFreewheelingDiode ? 'opacity-100' : 'opacity-30'}`}>
            <DiodeGlyph />
          </div>
          <div className="mt-0.5 text-[12px] leading-snug">
            {hasFreewheelingDiode
              ? isFwdConducting
                ? `Conducting · ${iFwd.toFixed(1)} A`
                : 'Armed · clamps Vo ≥ 0'
              : 'Open · tap to fit diode'}
          </div>
        </button>
      </div>

      {/* ---- Half-controlled bridge arrangement (boxed like the D_FW bypass; dimmed + locked unless semi-controlled) ---- */}
      {onSemiConfigChange && (
        <div className="pt-2.5 border-t border-slate-800 sm:pt-0 sm:border-t-0 lg:border-l lg:pl-3">
          <span className="block mb-1.5 text-[12px] font-mono uppercase tracking-wider text-slate-400">Bridge mode</span>
          <div
            aria-disabled={!semiEnabled}
            inert={!semiEnabled}
            title={semiEnabled ? undefined : 'Available for the half-controlled (semi-controlled) bridge only'}
            className={`rounded-lg border p-2 ${
              semiEnabled
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                : 'bg-black border-slate-800 text-slate-600 opacity-50 grayscale pointer-events-none select-none'
            }`}
          >
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
              {(['symmetric', 'asymmetric'] as SemiControlledConfig[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onSemiConfigChange(c)}
                  className={`py-1 text-[11px] font-semibold rounded border ${
                    semiConfig === c
                      ? 'bg-slate-800 text-amber-400 border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 border-transparent'
                  }`}
                >
                  {c === 'symmetric' ? 'Symm.' : 'Asymm.'}
                </button>
              ))}
            </div>
            {/* fixed height: the text swap never changes the strip's size */}
            <p className="mt-1.5 text-[12px] leading-snug h-[3.9em] overflow-hidden">
              {semiConfig === 'symmetric'
                ? 'SCR + diode in each leg; every device conducts 180°.'
                : `Both SCRs in one leg, both diodes in the other: SCR ${Math.max(0, 180 - alpha)}°, diode ${Math.min(360, 180 + alpha)}°.`}
            </p>
          </div>
        </div>
      )}

      {/* ---- Load summary ---- */}
      {R !== undefined && (
        <div className="pt-2.5 border-t border-slate-800 sm:pt-0 sm:border-t-0 lg:border-l lg:pl-3 lg:pr-1">
          <span className="block mb-1.5 text-[12px] font-mono uppercase tracking-wider text-slate-400 whitespace-nowrap">Load values</span>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs whitespace-nowrap">
            <dt className="text-slate-500">{hasR ? 'R' : 'Rp'}</dt>
            <dd className="text-right text-emerald-300">{R} Ω</dd>
            {/* Rows for modules that are not in the chain stay in the layout (invisible) so the panel keeps a constant height */}
            <dt className={`text-slate-500 ${hasL ? '' : 'invisible'}`}>L</dt>
            <dd className={`text-right text-emerald-300 ${hasL ? '' : 'invisible'}`}>{L !== undefined ? (L * 1000).toFixed(0) : 0} mH</dd>
            <dt className={`text-slate-500 ${hasE ? '' : 'invisible'}`}>E</dt>
            <dd className={`text-right text-emerald-300 ${hasE ? '' : 'invisible'}`}>{E ?? 0} V</dd>
            <dt className={`text-slate-500 ${hasL && R > 0 ? '' : 'invisible'}`}>τ = L/R</dt>
            <dd className={`text-right text-amber-300 ${hasL && R > 0 ? '' : 'invisible'}`}>{L !== undefined && R > 0 ? ((L / R) * 1000).toFixed(1) : '0.0'} ms</dd>
          </dl>
        </div>
      )}
    </div>
  );
};
