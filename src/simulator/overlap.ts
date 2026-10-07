import type { ConverterTopologyId } from '../types/converter';

/**
 * First-order commutation-overlap estimate for a source inductance Ls (per phase),
 * assuming a constant (ripple-free) load current Io. Analytical only: the waveform
 * engine itself still assumes an ideal source (Ls = 0).
 *
 *   cos(α) − cos(α + μ) = k · ω·Ls·Io / Vm      (Vm = peak PHASE voltage)
 *   ΔVdc = c · ω·Ls·Io / π
 */
interface OverlapRule {
  k: number; // coefficient on ω·Ls·Io/Vm
  c: number; // coefficient on ω·Ls·Io/π
  note: string;
}

const SQRT3 = Math.sqrt(3);

const RULES: Partial<Record<ConverterTopologyId, OverlapRule>> = {
  '1ph_fw_diode_bridge': { k: 2, c: 2, note: 'Two commutations per cycle; the current reverses (−Io to +Io) through Ls.' },
  '1ph_fw_fully_controlled': { k: 2, c: 2, note: 'Two commutations per cycle; the current reverses (−Io to +Io) through Ls.' },
  '1ph_fw_semi_controlled': {
    k: 1,
    c: 1,
    note: 'Only the thyristor turn-on at α produces a voltage notch. The diode transfer at π delays the source current but does not reduce Vdc.',
  },
  '3ph_hw_diode': { k: 2 / SQRT3, c: 1.5, note: 'Three commutations per cycle between adjacent phases.' },
  '3ph_hw_thyristor': { k: 2 / SQRT3, c: 1.5, note: 'Three commutations per cycle between adjacent phases.' },
  '3ph_fw_diode_bridge': { k: 2 / SQRT3, c: 3, note: 'Six commutations per cycle (three in each half of the bridge).' },
  '3ph_fw_semi_controlled': { k: 2 / SQRT3, c: 3, note: 'Thyristor group and diode group each commutate three times per cycle. Valid for continuous conduction.' },
  '3ph_fw_fully_controlled': { k: 2 / SQRT3, c: 3, note: 'Six commutations per cycle (three in each half of the bridge).' },
};

export interface OverlapResult {
  applicable: boolean;
  note: string;
  muDeg: number; // overlap angle, degrees
  dropV: number; // average output voltage drop, volts
  failed: boolean; // true if overlap would exceed the available angle (commutation failure)
}

export function computeOverlap(args: {
  topologyId: ConverterTopologyId;
  vRms: number; // phase RMS
  frequency: number; // Hz
  alphaDeg: number; // effective firing angle (0 for diode types)
  LsHenry: number;
  Io: number; // average load current, A
}): OverlapResult {
  const rule = RULES[args.topologyId];
  if (!rule) {
    return {
      applicable: false,
      note: 'No source-to-load commutation takes place in a single-phase half-wave circuit, so there is no overlap angle. Ls only slows the rise and fall of the current.',
      muDeg: 0,
      dropV: 0,
      failed: false,
    };
  }
  const w = 2 * Math.PI * args.frequency;
  const Vm = Math.SQRT2 * args.vRms;
  const x = w * args.LsHenry * Math.abs(args.Io); // ω·Ls·Io
  const alpha = (args.alphaDeg * Math.PI) / 180;
  const arg = Math.cos(alpha) - (rule.k * x) / Vm;
  const failed = arg < -1;
  const muRad = failed ? Math.PI - alpha : Math.max(0, Math.acos(Math.min(1, arg)) - alpha);
  return {
    applicable: true,
    note: rule.note,
    muDeg: (muRad * 180) / Math.PI,
    dropV: (rule.c * x) / Math.PI,
    failed,
  };
}
