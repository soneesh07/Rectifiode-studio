/**
 * Accuracy regression suite for the ideal-device simulation engine.
 * Run:  npm test      (uses tsx)
 * Every expected value is a closed-form textbook result for IDEAL devices.
 */
import { runSimulation } from '../src/simulator/engine';
import type { SimulationParams, ConverterTopologyId } from '../src/types/converter';

const VRMS = 230;
const Vm = VRMS * Math.SQRT2;
const VmL = Vm * Math.sqrt(3);
const rad = (d: number) => (d * Math.PI) / 180;
const BIG_L = 500; // "ideal smoothing inductor": current ripple-free

const mk = (
  topologyId: ConverterTopologyId, alpha: number, loadType: SimulationParams['loadType'],
  R: number, L: number, E = 0
): SimulationParams =>
  ({ topologyId, alpha, loadType, R, L, E, vRms: VRMS, frequency: 50, cyclesToDisplay: 2, hasFreewheelingDiode: false } as SimulationParams);

let pass = 0, fail = 0;
const failures: string[] = [];
function near(name: string, got: number, want: number, relTol: number, absTol = 0) {
  const err = Math.abs(got - want);
  const ok = err <= Math.max(absTol, Math.abs(want) * relTol) && Number.isFinite(got);
  if (ok) pass++; else { fail++; failures.push(`${name}: got ${got.toFixed(5)}, want ${want.toFixed(5)}`); }
}
const ABS_V = 0.002 * Vm; // 0.2 % of peak: covers the 0.15 deg firing resolution

// ---------- ideal Vdc, large L (continuous conduction) ----------
const vdcIdeal: Record<string, (a: number) => number> = {
  '1ph_hw_thyristor': a => (Vm / (2 * Math.PI)) * (1 + Math.cos(a)),   // R-load form, checked separately
  '1ph_fw_fully_controlled': a => ((2 * Vm) / Math.PI) * Math.cos(a),
  '1ph_fw_semi_controlled': a => (Vm / Math.PI) * (1 + Math.cos(a)),
  '3ph_hw_thyristor': a => ((3 * Math.sqrt(3) * Vm) / (2 * Math.PI)) * Math.cos(a),
  '3ph_fw_semi_controlled': a => ((3 * VmL) / (2 * Math.PI)) * (1 + Math.cos(a)),
  '3ph_fw_fully_controlled': a => ((3 * VmL) / Math.PI) * Math.cos(a),
};
for (const [id, f] of Object.entries(vdcIdeal)) {
  if (id === '1ph_hw_thyristor') continue;
  const isSemi = id.includes('semi');
  const alphas = isSemi ? [0, 30, 60, 90, 120, 150] : [0, 15, 30, 60, 85];
  for (const a of alphas) near(`Vdc ${id} a=${a} bigL`, runSimulation(mk(id as any, a, 'RL', 10, BIG_L)).vAvg, f(rad(a)), 0, ABS_V);
}
near('Vdc 1ph_hw_diode', runSimulation(mk('1ph_hw_diode', 0, 'R', 10, 0)).vAvg, Vm / Math.PI, 1e-4);
near('Vdc 1ph_fw_diode', runSimulation(mk('1ph_fw_diode_bridge', 0, 'R', 10, 0)).vAvg, (2 * Vm) / Math.PI, 1e-4);
near('Vdc 3ph_hw_diode', runSimulation(mk('3ph_hw_diode', 0, 'R', 10, 0)).vAvg, (3 * Math.sqrt(3) * Vm) / (2 * Math.PI), 1e-4);
near('Vdc 3ph_fw_diode', runSimulation(mk('3ph_fw_diode_bridge', 0, 'R', 10, 0)).vAvg, (3 * VmL) / Math.PI, 1e-4);

// ---------- resistive load: Vdc and Vrms, including extreme firing angles ----------
for (const a of [0, 30, 60, 90, 120, 150, 170, 178]) {
  const ar = rad(a);
  const rmsHW = (Vm / 2) * Math.sqrt((Math.PI - ar + Math.sin(2 * ar) / 2) / Math.PI);
  const rmsFW = Vm * Math.sqrt((Math.PI - ar + Math.sin(2 * ar) / 2) / (2 * Math.PI));
  let r = runSimulation(mk('1ph_hw_thyristor', a, 'R', 10, 0));
  near(`Vdc HWthy R a=${a}`, r.vAvg, (Vm / (2 * Math.PI)) * (1 + Math.cos(ar)), 0, ABS_V / 5);
  near(`Vrms HWthy R a=${a}`, r.vRms, rmsHW, 0, ABS_V);
  r = runSimulation(mk('1ph_fw_fully_controlled', a, 'R', 10, 0));
  near(`Vdc FWthy R a=${a}`, r.vAvg, (Vm / Math.PI) * (1 + Math.cos(ar)), 0, ABS_V / 2);
  near(`Vrms FWthy R a=${a}`, r.vRms, rmsFW, 0, ABS_V);
}
near('Vrms 1ph_hw_diode R', runSimulation(mk('1ph_hw_diode', 0, 'R', 10, 0)).vRms, Vm / 2, 1e-4);

// ---------- AC-side power quality, ideal (ripple-free) current ----------
for (const a of [0, 30, 60, 85]) {
  const c = Math.cos(rad(a));
  let r = runSimulation(mk('1ph_fw_fully_controlled', a, 'RL', 10, BIG_L));
  near(`1ph FC DPF a=${a}`, r.displacementPowerFactor, c, 2e-3, 2e-3);
  near(`1ph FC PF a=${a}`, r.powerFactor, (2 * Math.SQRT2 / Math.PI) * c, 3e-3, 2e-3);
  near(`1ph FC THDi a=${a}`, r.thdCurrent / 100, 0.4834, 3e-3);
  r = runSimulation(mk('3ph_fw_fully_controlled', a, 'RL', 10, BIG_L));
  near(`3ph FC DPF a=${a}`, r.displacementPowerFactor, c, 2e-3, 2e-3);
  near(`3ph FC PF a=${a}`, r.powerFactor, (3 / Math.PI) * c, 3e-3, 2e-3);
  near(`3ph FC THDi a=${a}`, r.thdCurrent / 100, 0.3108, 3e-3);
}
near('1ph diode bridge PF', runSimulation(mk('1ph_fw_diode_bridge', 0, 'RL', 10, BIG_L)).powerFactor, 0.9003, 2e-3);
near('3ph diode bridge PF', runSimulation(mk('3ph_fw_diode_bridge', 0, 'RL', 10, BIG_L)).powerFactor, 0.955, 2e-3);
near('1ph HW diode R PF', runSimulation(mk('1ph_hw_diode', 0, 'R', 10, 0)).powerFactor, Math.SQRT1_2, 1e-3);
near('1ph FW diode R PF', runSimulation(mk('1ph_fw_diode_bridge', 0, 'R', 10, 0)).powerFactor, 1, 1e-3);

// ---------- line-commutated inversion (E reversed): power returns to the grid ----------
for (const a of [100, 120, 150]) {
  const vIdeal = ((2 * Vm) / Math.PI) * Math.cos(rad(a));
  // E must be more negative than the ideal Vdc, otherwise the (unidirectional) current cannot flow
  const r = runSimulation(mk('1ph_fw_fully_controlled', a, 'RLE', 5, BIG_L, vIdeal - 50));
  near(`Inversion Vdc a=${a}`, r.vAvg, vIdeal, 0, ABS_V);
  if (r.pActive < 0 && r.powerFactor < 0 && r.displacementPowerFactor < 0) pass++; else { fail++; failures.push(`Inversion sign a=${a}: P=${r.pActive} PF=${r.powerFactor} DPF=${r.displacementPowerFactor}`); }
}
const inv3 = runSimulation(mk('3ph_fw_fully_controlled', 120, 'RLE', 5, BIG_L, -300));
near('Inversion 3ph Vdc a=120', inv3.vAvg, ((3 * VmL) / Math.PI) * Math.cos(rad(120)), 0, ABS_V);

// ---------- energy balance on every topology: AC-side sum(vs*is) == DC-side mean(vo*io) ----------
const ids: ConverterTopologyId[] = ['1ph_hw_diode','1ph_fw_diode_bridge','1ph_hw_thyristor','1ph_fw_fully_controlled','1ph_fw_semi_controlled','3ph_hw_diode','3ph_hw_thyristor','3ph_fw_diode_bridge','3ph_fw_semi_controlled','3ph_fw_fully_controlled'];
const loads: [SimulationParams['loadType'], number, number, number][] = [['R', 10, 0, 0], ['RL', 10, 0.05, 0], ['RLE', 5, 0.02, 60]];
for (const id of ids) for (const [lt, R, L, E] of loads) for (const a of [0, 45, 90]) {
  const ctrl = id.includes('thy') || id.includes('controlled');
  if (!ctrl && a > 0) continue;
  const r = runSimulation(mk(id, a, lt, R, L, E));
  let pAc = 0;
  for (const s of r.samples) pAc += s.vSourcePhaseA * s.iSourcePhaseA + s.vSourcePhaseB * s.iSourcePhaseB + s.vSourcePhaseC * s.iSourcePhaseC;
  pAc /= r.samples.length;
  const single = id.startsWith('1ph');
  if (single) { pAc = 0; for (const s of r.samples) pAc += s.vSourcePhaseA * s.iSourcePhaseA; pAc /= r.samples.length; }
  near(`Energy balance ${id} ${lt} a=${a}`, pAc, r.pActive, 0.01, 0.5);
  if (![r.vAvg, r.vRms, r.iAvg, r.powerFactor, r.thdCurrent].every(Number.isFinite)) { fail++; failures.push(`NaN in ${id} ${lt} a=${a}`); } else pass++;
  if (Math.abs(r.powerFactor) > 1 + 1e-9) { fail++; failures.push(`|PF|>1 in ${id}`); } else pass++;
}

// ---------- half-controlled bridge: symmetric vs asymmetric arrangement ----------
// (a) Ideal devices => identical vo, io and source current in both arrangements.
// (b) Device conduction angles: symmetric = 180 deg for all four devices;
//     asymmetric = (180 - alpha) for each SCR and (180 + alpha) for each diode (continuous conduction).
// (c) Structural sanity: T1/T2 never conduct together; in the asymmetric bridge an SCR and the diode
//     in its own leg never conduct together except as the freewheeling pair, and freewheeling uses D1+D2.
{
  const withCfg = (p: SimulationParams, c: 'symmetric' | 'asymmetric'): SimulationParams => ({ ...p, semiConfig: c });
  for (const [lt, R, L, E] of loads) for (const a of [0, 30, 60, 90, 120, 150, 175]) {
    const base = mk('1ph_fw_semi_controlled', a, lt, R, L, E);
    const rs = runSimulation(withCfg(base, 'symmetric'));
    const ra = runSimulation(withCfg(base, 'asymmetric'));
    let maxDiff = 0;
    for (let i = 0; i < rs.samples.length; i++) {
      const x = rs.samples[i], y = ra.samples[i];
      maxDiff = Math.max(maxDiff, Math.abs(x.vOut - y.vOut), Math.abs(x.iOut - y.iOut), Math.abs(x.iSourcePhaseA - y.iSourcePhaseA));
    }
    near(`Semi sym==asym waveforms ${lt} a=${a}`, maxDiff, 0, 0, 1e-6);
    near(`Semi sym==asym Vdc ${lt} a=${a}`, ra.vAvg, rs.vAvg, 1e-9, 1e-9);
    near(`Semi sym==asym PF ${lt} a=${a}`, ra.powerFactor, rs.powerFactor, 1e-9, 1e-9);
  }

  for (const a of [0, 30, 60, 90, 120, 150]) {
    for (const cfg of ['symmetric', 'asymmetric'] as const) {
      const r = runSimulation(withCfg(mk('1ph_fw_semi_controlled', a, 'RL', 10, BIG_L), cfg));
      const smp = r.samples.slice(0, 2400);
      const deg = (k: string) => (smp.filter(s => s.deviceStates[k]?.conducting).length / smp.length) * 360;
      const wantT = cfg === 'symmetric' ? 180 : 180 - a;
      const wantD = cfg === 'symmetric' ? 180 : 180 + a;
      near(`Semi ${cfg} T1 conduction a=${a}`, deg('T1'), wantT, 0, 0.5);
      near(`Semi ${cfg} T2 conduction a=${a}`, deg('T2'), wantT, 0, 0.5);
      near(`Semi ${cfg} D1 conduction a=${a}`, deg('D1'), wantD, 0, 0.5);
      near(`Semi ${cfg} D2 conduction a=${a}`, deg('D2'), wantD, 0, 0.5);

      let bad = 0, fwViaDiodes = 0, fwSamples = 0;
      for (const s of smp) {
        const on = (k: string) => !!s.deviceStates[k]?.conducting;
        if (on('T1') && on('T2')) bad++;
        if (cfg === 'asymmetric' && ((on('T1') && on('D1')) || (on('T2') && on('D2')))) bad++;   // would short the source
        // symmetric: the same-leg pairs (T1,D1) / (T2,D2) may only conduct together while freewheeling (Vo = 0, Is = 0)
        if (cfg === 'symmetric' && ((on('T1') && on('D1')) || (on('T2') && on('D2'))) && (Math.abs(s.vOut) > 1e-9 || Math.abs(s.iSourcePhaseA) > 1e-9)) bad++;
        if (Math.abs(s.vOut) < 1e-9 && s.iOut > 1e-3) { fwSamples++; if (on('D1') && on('D2')) fwViaDiodes++; }
      }
      near(`Semi ${cfg} no illegal simultaneous conduction a=${a}`, bad, 0, 0, 0);
      if (cfg === 'asymmetric') near(`Semi asym freewheels through D1+D2 a=${a}`, fwViaDiodes, fwSamples, 0, 0);
    }
  }
  // thyristor gating: asymmetric SCRs never carry current while their anode is reverse biased
  const rr = runSimulation(withCfg(mk('1ph_fw_semi_controlled', 60, 'RL', 10, 0.05), 'asymmetric'));
  let revBias = 0;
  for (const s of rr.samples) {
    if (s.deviceStates['T1']?.conducting && s.vSourcePhaseA < -1e-9) revBias++;
    if (s.deviceStates['T2']?.conducting && s.vSourcePhaseA > 1e-9) revBias++;
  }
  near('Semi asym SCRs never conduct while reverse biased', revBias, 0, 0, 0);
}

// ---------- performance: worst realistic UI case ----------
const t0 = Date.now();
runSimulation(mk('3ph_fw_fully_controlled', 30, 'RLE', 1, 0.2, 100));
runSimulation(mk('1ph_fw_fully_controlled', 60, 'RL', 1, 0.2));
const ms = Date.now() - t0;
if (ms < 2500) pass++; else { fail++; failures.push(`slow: two worst-case runs took ${ms} ms`); }

console.log(`\n${pass} passed, ${fail} failed  (2 worst-case runs: ${ms} ms)`);
for (const f of failures) console.log('  FAIL', f);
process.exit(fail ? 1 : 0);
