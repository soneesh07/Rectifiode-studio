import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { ConverterConfig, ConverterTopologyId } from '../types/converter';

interface TopologySelectProps {
  value: ConverterTopologyId;
  onChange: (id: ConverterTopologyId) => void;
  configs: ConverterConfig[];
}

/** Short, scannable tags shown on every option: how it is controlled and how many pulses it makes. */
const tagsFor = (c: ConverterConfig) => {
  const type = c.hasThyristors && c.hasDiodes ? 'Semi' : c.hasThyristors ? 'SCR' : 'Diode';
  return { type, pulses: `${c.pulseCountPerCycle}-pulse` };
};

const typeStyle: Record<string, string> = {
  Diode: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  SCR: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  Semi: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
};

/**
 * Styled replacement for the native <select>: grouped by phase count, tagged by device type / pulse number,
 * with a check on the selected row. Fully keyboard operable (↑ ↓ Home End Enter Esc, type-ahead) and ARIA-labelled.
 */
export const TopologySelect: React.FC<TopologySelectProps> = ({ value, onChange, configs }) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', t: 0 });
  const listId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxH: number } | null>(null);

  // The list is portalled to <body> (the card it belongs to clips overflow), so it is positioned from the button's rect.
  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const flip = below < 260 && above > below;
    const maxH = Math.max(180, Math.min(352, flip ? above : below));
    setPos({ left: r.left, width: r.width, maxH, top: flip ? r.top - 6 - maxH : r.bottom + 6 });
  }, []);
  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, place]);

  const groups = useMemo(() => {
    const cats: string[] = [];
    configs.forEach((c) => { if (!cats.includes(c.category)) cats.push(c.category); });
    return cats.map((cat) => ({ cat, items: configs.filter((c) => c.category === cat) }));
  }, [configs]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const selected = configs.find((c) => c.id === value) ?? flat[0];

  const openList = useCallback(() => {
    setActive(Math.max(0, flat.findIndex((c) => c.id === value)));
    setOpen(true);
  }, [flat, value]);

  const choose = useCallback((id: ConverterTopologyId) => {
    setOpen(false);
    if (id !== value) onChange(id);
    btnRef.current?.focus();
  }, [onChange, value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current && !rootRef.current.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted row in view
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(flat.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(flat[active].id); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'Tab') { setOpen(false); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      const ta = typeahead.current;
      ta.text = (now - ta.t > 700 ? '' : ta.text) + e.key.toLowerCase();
      ta.t = now;
      const hit = flat.findIndex((c) => c.name.toLowerCase().replace(/^(single|three)-phase /, '').startsWith(ta.text) || c.name.toLowerCase().startsWith(ta.text));
      if (hit >= 0) setActive(hit);
    }
  };

  let runningIdx = -1;

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : openList())}
        className={`group w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-200 bg-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
          open
            ? 'border-amber-500/70 shadow-[0_0_0_3px_rgba(245,158,11,0.12)]'
            : 'border-slate-700 hover:border-slate-500'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-100">{selected.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[12px] font-mono text-slate-400">
            <span>{selected.category}</span>
            <span className="text-slate-600">·</span>
            <span>{tagsFor(selected).pulses}</span>
            <span className="text-slate-600">·</span>
            <span>{selected.controlled ? 'Controlled' : 'Uncontrolled'}</span>
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 group-hover:text-slate-200 transition-transform duration-200 ${open ? 'rotate-180 text-amber-400' : ''}`} />
      </button>

      {open && pos && createPortal(
        <div
          ref={listRef}
          onMouseDown={(e) => e.preventDefault()}
          style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxH }}
          id={listId}
          role="listbox"
          aria-label="Topology Selection"
          className="topology-pop z-[200] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/98 backdrop-blur shadow-2xl shadow-black/60 py-1.5"
        >
          {groups.map((g) => (
            <div key={g.cat} role="group" aria-label={g.cat}>
              <div className="sticky top-0 z-10 flex items-center gap-2 px-3 pt-2 pb-1.5 bg-slate-950 text-[12px] font-bold uppercase tracking-[0.14em] text-amber-400/90">
                <span>{g.cat}</span>
                <span className="h-px flex-1 bg-slate-800" />
              </div>
              {g.items.map((c) => {
                runningIdx += 1;
                const idx = runningIdx;
                const isSel = c.id === value;
                const isAct = idx === active;
                const tg = tagsFor(c);
                return (
                  <div
                    key={c.id}
                    role="option"
                    aria-selected={isSel}
                    data-idx={idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => choose(c.id)}
                    className={`mx-1.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                      isAct ? 'bg-slate-800/90' : ''
                    } ${isSel ? 'text-amber-200' : 'text-slate-200'}`}
                  >
                    <span className={`w-1 self-stretch rounded-full ${isSel ? 'bg-amber-400' : 'bg-transparent'}`} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                    <span className={`shrink-0 rounded border px-1.5 py-px text-[11px] font-mono font-semibold ${typeStyle[tg.type]}`}>{tg.type}</span>
                    <span className="shrink-0 w-[3.6rem] text-right text-[12px] font-mono text-slate-500">{tg.pulses}</span>
                    <Check className={`w-4 h-4 shrink-0 ${isSel ? 'text-amber-400' : 'text-transparent'}`} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
