import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/** Collapsible on phones/tablets (< lg); always expanded on desktop. */
export const CollapsibleSection: React.FC<{
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="lg:hidden w-full mb-2 flex items-center justify-between px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/90 text-sm font-semibold text-slate-200"
      >
        <span>{title}</span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`${open ? 'block' : 'hidden'} lg:block`}>{children}</div>
    </div>
  );
};
