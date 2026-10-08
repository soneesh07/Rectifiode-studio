import {
  ConverterConfig,
  ConverterTopologyId,
  DeviceInstantState,
  SimulationParams,
  SimulationResult,
  SimulationSample,
} from '../types/converter';

export const CONVERTER_CONFIGS: Record<ConverterTopologyId, ConverterConfig> = {
  '1ph_hw_diode': {
    id: '1ph_hw_diode',
    name: 'Single-Phase Half-Wave Diode Rectifier',
    category: 'Single Phase',
    controlled: false,
    switchesCount: 1,
    switchLabels: ['D1'],
    pulseCountPerCycle: 1,
    description: 'Simplest rectifier topology using 1 diode. Conducts on positive half-cycle.',
    defaultAlpha: 0,
    hasDiodes: true,
    hasThyristors: false,
    theoreticalFormulaVdc: '\\frac{V_m}{\\pi} \\approx 0.318\\,V_m',
    theoreticalFormulaVrms: '\\frac{V_m}{2} = 0.5\\,V_m',
  },
  '1ph_fw_diode_bridge': {
    id: '1ph_fw_diode_bridge',
    name: 'Single-Phase Full-Wave Diode Bridge',
    category: 'Single Phase',
    controlled: false,
    switchesCount: 4,
    switchLabels: ['D1', 'D2', 'D3', 'D4'],
    pulseCountPerCycle: 2,
    description: '4-diode Graetz bridge providing 2-pulse DC output from single-phase AC.',
    defaultAlpha: 0,
    hasDiodes: true,
    hasThyristors: false,
    theoreticalFormulaVdc: '\\frac{2V_m}{\\pi} \\approx 0.637\\,V_m',
    theoreticalFormulaVrms: '\\frac{V_m}{\\sqrt{2}} \\approx 0.707\\,V_m',
  },
  '1ph_hw_thyristor': {
    id: '1ph_hw_thyristor',
    name: 'Single-Phase Half-Wave Thyristor Rectifier',
    category: 'Single Phase',
    controlled: true,
    switchesCount: 1,
    switchLabels: ['T1'],
    pulseCountPerCycle: 1,
    description: 'Phase-controlled half-wave rectifier using 1 SCR with adjustable firing angle α.',
    defaultAlpha: 45,
    hasDiodes: false,
    hasThyristors: true,
    theoreticalFormulaVdc: '\\frac{V_m}{2\\pi}(1 + \\cos\\alpha)',
    theoreticalFormulaVrms: '\\frac{V_m}{2}\\sqrt{\\frac{\\pi - \\alpha + \\frac{\\sin 2\\alpha}{2}}{\\pi}}',
  },
  '1ph_fw_fully_controlled': {
    id: '1ph_fw_fully_controlled',
    name: 'Single-Phase Fully Controlled Bridge',
    category: 'Single Phase',
    controlled: true,
    switchesCount: 4,
    switchLabels: ['T1', 'T2', 'T3', 'T4'],
    pulseCountPerCycle: 2,
    description: '4-thyristor full converter capable of 2-quadrant operation (rectification & inversion).',
    defaultAlpha: 45,
    hasDiodes: false,
    hasThyristors: true,
    theoreticalFormulaVdc: '\\frac{2V_m}{\\pi}\\cos\\alpha',
    theoreticalFormulaVrms: '\\frac{V_m}{\\sqrt{2}}',
  },
  '1ph_fw_semi_controlled': {
    id: '1ph_fw_semi_controlled',
    name: 'Single-Phase Semi-Controlled Bridge',
    category: 'Single Phase',
    controlled: true,
    switchesCount: 4,
    switchLabels: ['T1', 'T2', 'D1', 'D2'],
    pulseCountPerCycle: 2,
    description: 'Half-controlled bridge with 2 SCRs and 2 Diodes (symmetric or asymmetric arrangement). Inherent freewheeling prevents negative output voltage.',
    defaultAlpha: 60,
    hasDiodes: true,
    hasThyristors: true,
    theoreticalFormulaVdc: '\\frac{V_m}{\\pi}(1 + \\cos\\alpha)',
    theoreticalFormulaVrms: 'V_m\\sqrt{\\frac{\\pi - \\alpha + \\frac{\\sin 2\\alpha}{2}}{2\\pi}}',
  },
  '3ph_hw_diode': {
    id: '3ph_hw_diode',
    name: 'Three-Phase Half-Wave Diode Rectifier',
    category: 'Three Phase',
    controlled: false,
    switchesCount: 3,
    switchLabels: ['D1', 'D2', 'D3'],
    pulseCountPerCycle: 3,
    description: '3-pulse star-connected rectifier. Highest phase voltage conducts naturally.',
    defaultAlpha: 0,
    hasDiodes: true,
    hasThyristors: false,
    theoreticalFormulaVdc: '\\frac{3\\sqrt{3}}{2\\pi}V_m \\approx 0.827\\,V_m',
    theoreticalFormulaVrms: 'V_m\\sqrt{\\frac{1}{2} + \\frac{3\\sqrt{3}}{8\\pi}} \\approx 0.841\\,V_m',
  },
  '3ph_hw_thyristor': {
    id: '3ph_hw_thyristor',
    name: 'Three-Phase Half-Wave Thyristor Rectifier',
    category: 'Three Phase',
    controlled: true,
    switchesCount: 3,
    switchLabels: ['T1', 'T2', 'T3'],
    pulseCountPerCycle: 3,
    description: 'Phase-controlled 3-pulse rectifier with thyristors fired relative to phase crossover at 30° + α.',
    defaultAlpha: 30,
    hasDiodes: false,
    hasThyristors: true,
    theoreticalFormulaVdc: '\\frac{3\\sqrt{3}}{2\\pi}V_m\\cos\\alpha',
    theoreticalFormulaVrms: 'V_m\\sqrt{\\frac{1}{2} + \\frac{3\\sqrt{3}}{8\\pi}\\cos 2\\alpha}',
  },
  '3ph_fw_diode_bridge': {
    id: '3ph_fw_diode_bridge',
    name: 'Three-Phase Diode Bridge (6-Pulse)',
    category: 'Three Phase',
    controlled: false,
    switchesCount: 6,
    switchLabels: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'],
    pulseCountPerCycle: 6,
    description: 'Standard industrial 6-pulse Graetz diode bridge with low DC ripple and high efficiency.',
    defaultAlpha: 0,
    hasDiodes: true,
    hasThyristors: false,
    theoreticalFormulaVdc: '\\frac{3}{\\pi}V_{m,\\text{line}} \\approx 1.35\\,V_{\\text{line,rms}}',
    theoreticalFormulaVrms: 'V_{m,\\text{line}}\\sqrt{\\frac{1}{2} + \\frac{3\\sqrt{3}}{4\\pi}} \\approx 1.352\\,V_{\\text{line,rms}}',
  },
  '3ph_fw_semi_controlled': {
    id: '3ph_fw_semi_controlled',
    name: 'Three-Phase Semi-Controlled Bridge',
    category: 'Three Phase',
    controlled: true,
    switchesCount: 6,
    switchLabels: ['T1', 'T3', 'T5', 'D2', 'D4', 'D6'],
    pulseCountPerCycle: 6,
    description: '3 SCRs on top, 3 Diodes on bottom. Clamps to zero when alpha exceeds 60°, avoiding inversion.',
    defaultAlpha: 45,
    hasDiodes: true,
    hasThyristors: true,
    theoreticalFormulaVdc: '\\frac{3V_{m,\\text{line}}}{2\\pi}(1 + \\cos\\alpha)',
    theoreticalFormulaVrms: 'V_{m,\\text{line}}\\sqrt{\\frac{1}{2} + \\frac{3\\sqrt{3}}{8\\pi}(1 + \\cos 2\\alpha)}',
  },
  '3ph_fw_fully_controlled': {
    id: '3ph_fw_fully_controlled',
    name: 'Three-Phase Fully Controlled Bridge (6-Pulse)',
    category: 'Three Phase',
    controlled: true,
    switchesCount: 6,
    switchLabels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
    pulseCountPerCycle: 6,
    description: 'Full 6-pulse thyristor converter (Graetz bridge). Full 2-quadrant control for DC drives.',
    defaultAlpha: 30,
    hasDiodes: false,
    hasThyristors: true,
    theoreticalFormulaVdc: '\\frac{3V_{m,\\text{line}}}{\\pi}\\cos\\alpha',
    theoreticalFormulaVrms: 'V_{m,\\text{line}}\\sqrt{\\frac{1}{2} + \\frac{3\\sqrt{3}}{4\\pi}\\cos 2\\alpha}',
  },
};

/** Formula string (LaTeX subset) for Vrms; the 3-phase semi-converter changes form at alpha = 60 deg. */
export function getVrmsFormula(topologyId: ConverterTopologyId, alphaDeg: number): string {
  if (topologyId === '3ph_fw_semi_controlled' && alphaDeg > 60) {
    return 'V_{m,\\text{line}}\\sqrt{\\frac{3}{4\\pi}\\left(\\pi - \\alpha + \\frac{\\sin 2\\alpha}{2}\\right)}';
  }
  return CONVERTER_CONFIGS[topologyId].theoreticalFormulaVrms;
}

export function runSimulation(params: SimulationParams): SimulationResult {
  const {
    topologyId,
    vRms: vRmsInput,
    frequency,
    alpha,
    loadType,
    R: userR,
    L: userL,
    E: userE,
    cyclesToDisplay = 2,
    hasFreewheelingDiode = false,
    semiConfig = 'symmetric',
  } = params;

  const R = Math.max(0.1, userR);
  const L = loadType.includes('L') ? Math.max(0, userL) : 0;
  const E = loadType.includes('E') ? userE : 0;

  const f = Math.max(1, frequency);
  const T = 1 / f;
  const omega = 2 * Math.PI * f;
  const Vm = Math.SQRT2 * vRmsInput;
  const VmLine = Math.sqrt(3) * Vm;

  const alphaRad = (alpha * Math.PI) / 180;

  // Ideal closed-form average output voltage (continuous-conduction formula)
  let theoreticalVdc: number | undefined;
  switch (topologyId) {
    case '1ph_hw_diode':
      theoreticalVdc = Vm / Math.PI;
      break;
    case '1ph_fw_diode_bridge':
      theoreticalVdc = (2 * Vm) / Math.PI;
      break;
    case '1ph_hw_thyristor':
      theoreticalVdc = (Vm / (2 * Math.PI)) * (1 + Math.cos(alphaRad));
      break;
    case '1ph_fw_fully_controlled':
      theoreticalVdc = (2 * Vm / Math.PI) * Math.cos(alphaRad);
      break;
    case '1ph_fw_semi_controlled':
      theoreticalVdc = (Vm / Math.PI) * (1 + Math.cos(alphaRad));
      break;
    case '3ph_hw_diode':
      theoreticalVdc = (3 * Math.sqrt(3) * Vm) / (2 * Math.PI);
      break;
    case '3ph_hw_thyristor':
      theoreticalVdc = ((3 * Math.sqrt(3) * Vm) / (2 * Math.PI)) * Math.cos(alphaRad);
      break;
    case '3ph_fw_diode_bridge':
      theoreticalVdc = (3 * VmLine) / Math.PI;
      break;
    case '3ph_fw_semi_controlled':
      theoreticalVdc = ((3 * VmLine) / (2 * Math.PI)) * (1 + Math.cos(alphaRad));
      break;
    case '3ph_fw_fully_controlled':
      theoreticalVdc = ((3 * VmLine) / Math.PI) * Math.cos(alphaRad);
      break;
  }

  // Ideal closed-form RMS output voltage (same expressions as the formulas shown in the UI)
  const sq = (x: number) => Math.sqrt(Math.max(0, x));
  const halfWaveTerm = Math.PI - alphaRad + Math.sin(2 * alphaRad) / 2;
  let theoreticalVrms: number | undefined;
  switch (topologyId) {
    case '1ph_hw_diode':
      theoreticalVrms = Vm / 2;
      break;
    case '1ph_fw_diode_bridge':
    case '1ph_fw_fully_controlled':
      theoreticalVrms = Vm / Math.SQRT2;
      break;
    case '1ph_hw_thyristor':
      theoreticalVrms = (Vm / 2) * sq(halfWaveTerm / Math.PI);
      break;
    case '1ph_fw_semi_controlled':
      theoreticalVrms = Vm * sq(halfWaveTerm / (2 * Math.PI));
      break;
    case '3ph_hw_diode':
      theoreticalVrms = Vm * sq(1 / 2 + (3 * Math.sqrt(3)) / (8 * Math.PI));
      break;
    case '3ph_hw_thyristor':
      theoreticalVrms = Vm * sq(1 / 2 + ((3 * Math.sqrt(3)) / (8 * Math.PI)) * Math.cos(2 * alphaRad));
      break;
    case '3ph_fw_diode_bridge':
      theoreticalVrms = VmLine * sq(1 / 2 + (3 * Math.sqrt(3)) / (4 * Math.PI));
      break;
    case '3ph_fw_semi_controlled':
      // Two regimes: no freewheeling zero-interval for alpha <= 60 deg, freewheeling beyond that.
      theoreticalVrms =
        alpha <= 60
          ? VmLine * sq(1 / 2 + ((3 * Math.sqrt(3)) / (8 * Math.PI)) * (1 + Math.cos(2 * alphaRad)))
          : VmLine * sq((3 / (4 * Math.PI)) * halfWaveTerm);
      break;
    case '3ph_fw_fully_controlled':
      theoreticalVrms = VmLine * sq(1 / 2 + ((3 * Math.sqrt(3)) / (4 * Math.PI)) * Math.cos(2 * alphaRad));
      break;
  }

  const pulseWidthRad = (15 * Math.PI) / 180; // 15 degree trigger pulse

  // Time-stepping setup:
  // Using 2400 steps per cycle for high fidelity
  const stepsPerCycle = 2400;
  const dt = T / stepsPerCycle;

  // Warm-up: run whole cycles until the load current at the start of a cycle stops changing
  // (periodic steady state), instead of a fixed, too-short number of cycles.
  const MIN_WARMUP_CYCLES = 3;
  const MAX_WARMUP_CYCLES = 240;
  let totalSteps = Number.POSITIVE_INFINITY; // fixed once steady state is detected
  let displayStartStep = Number.POSITIVE_INFINITY;
  let lastBoundaryCurrent = -1;

  // State variables. Seed the current near its expected average so L/R transients are short.
  // Exception: a single-phase half-wave circuit with a reversed EMF (E < 0) can latch into a continuous-current
  // state it could never reach from rest (the SCR/diode simply never gets to turn off). Start those from rest.
  const startFromRest = (topologyId === '1ph_hw_thyristor' || topologyId === '1ph_hw_diode') && E < 0;
  const iSeedEstimate =
    L > 0 && theoreticalVdc !== undefined && !startFromRest ? Math.max(0, (theoreticalVdc - E) / R) : 0;
  const convergenceTol = 1e-6 * Math.max(1, iSeedEstimate);
  let iLoad = iSeedEstimate;
  let activeState = 'NONE'; // string state tag

  // Helper gate pulse checker
  const isGateFired = (currentThetaRad: number, triggerAngleRad: number) => {
    // Check if current theta modulo 2*PI is within trigger window
    let modTheta = currentThetaRad % (2 * Math.PI);
    if (modTheta < 0) modTheta += 2 * Math.PI;

    let target = triggerAngleRad % (2 * Math.PI);
    if (target < 0) target += 2 * Math.PI;

    let diff = modTheta - target;
    if (diff < 0) diff += 2 * Math.PI;
    return diff >= 0 && diff <= pulseWidthRad;
  };

  // "Held" gate drive for the firing LOGIC (the displayed gate pulses above stay 15 deg wide).
  // A thyristor only latches once it is forward biased. With a back-EMF E > 0 that happens at
  // delta = asin(E/Vm), which can be later than alpha + 15 deg. A real gate driver keeps the gate on
  // (wide pulse / pulse train) until the device turns on, so firing is allowed anywhere inside the
  // window [trigger, trigger + span]; the span never reaches the next device's own window.
  const isGateHeld = (currentThetaRad: number, triggerAngleRad: number, spanRad: number) => {
    let modTheta = currentThetaRad % (2 * Math.PI);
    if (modTheta < 0) modTheta += 2 * Math.PI;
    let target = triggerAngleRad % (2 * Math.PI);
    if (target < 0) target += 2 * Math.PI;
    let diff = modTheta - target;
    if (diff < 0) diff += 2 * Math.PI;
    return diff <= Math.max(pulseWidthRad, spanRad);
  };
  // Single-phase: from alpha to the end of that half-cycle. Three-phase: up to the next device.
  const holdSpan1ph = Math.PI - alphaRad;
  const holdSpan3phSingle = (2 * Math.PI) / 3;
  const holdSpan3phPair = Math.PI / 3;

  const recordedSamples: SimulationSample[] = [];

  for (let step = 0; step < totalSteps; step++) {
    // Steady-state detection at each cycle boundary (theta = 0)
    if (step > 0 && step % stepsPerCycle === 0 && displayStartStep === Number.POSITIVE_INFINITY) {
      const cyc = step / stepsPerCycle;
      const settled = cyc >= MIN_WARMUP_CYCLES && Math.abs(iLoad - lastBoundaryCurrent) <= convergenceTol;
      if (settled || cyc >= MAX_WARMUP_CYCLES) {
        displayStartStep = step;
        totalSteps = step + cyclesToDisplay * stepsPerCycle;
      }
      lastBoundaryCurrent = iLoad;
    }
    const t = step * dt;
    // All switching decisions and source voltages are evaluated at the middle of the step
    // (midpoint rule): removes the first-order bias of holding start-of-step values and makes
    // the firing angle round to the nearest step instead of always firing late.
    const theta = omega * (t + 0.5 * dt);
    const isRecorded = step >= displayStartStep;

    // Instantaneous supply voltages
    const vsA = Vm * Math.sin(theta);
    const vsB = Vm * Math.sin(theta - (2 * Math.PI) / 3);
    const vsC = Vm * Math.sin(theta - (4 * Math.PI) / 3);

    const vLineAB = vsA - vsB;
    const vLineBC = vsB - vsC;
    const vLineCA = vsC - vsA;
    // Phase B/C quantities only exist for three-phase topologies. Single-phase samples leave
    // them undefined so the oscilloscope renders a single trace instead of a 3-phase set.
    const isThreePhaseTopology = topologyId.startsWith('3ph_');

    // Gate Pulses for this instant
    const gatePulses: Record<string, boolean> = {};
    const deviceStates: Record<string, DeviceInstantState> = {};
    let activeBranchDesc = 'OFF';
    let vAppliedToLoad = 0;

    // Switch evaluation per topology:
    switch (topologyId) {
      // -------------------------------------------------------------
      // 1. Single-Phase Half-Wave Diode
      // -------------------------------------------------------------
      case '1ph_hw_diode': {
        const canConduct = vsA > E;
        const isConducting = iLoad > 1e-4 || canConduct;

        if (isConducting) {
          vAppliedToLoad = vsA;
          activeBranchDesc = 'D1 Conducting (+ Half-Cycle)';
          deviceStates['D1'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
        } else {
          vAppliedToLoad = E;
          activeBranchDesc = 'D1 OFF (Reverse Biased)';
          deviceStates['D1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA - E };
        }
        break;
      }

      // -------------------------------------------------------------
      // 2. Single-Phase Full-Wave Diode Bridge
      // -------------------------------------------------------------
      case '1ph_fw_diode_bridge': {
        const isPos = vsA >= 0;
        const magVs = Math.abs(vsA);
        const canConduct = magVs > E;
        const isConducting = iLoad > 1e-4 || canConduct;

        if (isConducting) {
          if (isPos) {
            vAppliedToLoad = vsA;
            activeBranchDesc = 'D1, D2 Conducting (+ Half-Cycle)';
            deviceStates['D1'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['D2'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['D3'] = { conducting: false, current: 0, anodeToCathodeVoltage: -vsA };
            deviceStates['D4'] = { conducting: false, current: 0, anodeToCathodeVoltage: -vsA };
          } else {
            vAppliedToLoad = -vsA;
            activeBranchDesc = 'D3, D4 Conducting (- Half-Cycle)';
            deviceStates['D1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA };
            deviceStates['D2'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA };
            deviceStates['D3'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['D4'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
          }
        } else {
          vAppliedToLoad = E;
          activeBranchDesc = 'All Diodes OFF (Load Discontinuous)';
          deviceStates['D1'] = { conducting: false, current: 0, anodeToCathodeVoltage: isPos ? vsA - E : 0 };
          deviceStates['D2'] = { conducting: false, current: 0, anodeToCathodeVoltage: 0 };
          deviceStates['D3'] = { conducting: false, current: 0, anodeToCathodeVoltage: !isPos ? -vsA - E : 0 };
          deviceStates['D4'] = { conducting: false, current: 0, anodeToCathodeVoltage: 0 };
        }
        break;
      }

      // -------------------------------------------------------------
      // 3. Single-Phase Half-Wave Thyristor
      // -------------------------------------------------------------
      case '1ph_hw_thyristor': {
        const g1 = isGateFired(theta, alphaRad);
        gatePulses['T1'] = g1;

        if (isGateHeld(theta, alphaRad, holdSpan1ph) && vsA > E) {
          activeState = 'T1';
        }

        if (activeState === 'T1') {
          vAppliedToLoad = vsA;
          activeBranchDesc = 'T1 Conducting (Gated)';
          deviceStates['T1'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
        } else {
          vAppliedToLoad = E;
          activeBranchDesc = 'T1 Blocking (Awaiting Gate)';
          deviceStates['T1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA - E };
        }
        break;
      }

      // -------------------------------------------------------------
      // 4. Single-Phase Fully Controlled Bridge
      // -------------------------------------------------------------
      case '1ph_fw_fully_controlled': {
        const g12 = isGateFired(theta, alphaRad);
        const g34 = isGateFired(theta, Math.PI + alphaRad);
        gatePulses['T1'] = g12;
        gatePulses['T2'] = g12;
        gatePulses['T3'] = g34;
        gatePulses['T4'] = g34;

        if (isGateHeld(theta, alphaRad, holdSpan1ph) && (vsA > E || iLoad > 1e-4)) {
          activeState = 'PAIR_A'; // T1 & T2
        } else if (isGateHeld(theta, Math.PI + alphaRad, holdSpan1ph) && (-vsA > E || iLoad > 1e-4)) {
          activeState = 'PAIR_B'; // T3 & T4
        }

        if (activeState === 'PAIR_A') {
          vAppliedToLoad = vsA;
          activeBranchDesc = 'T1, T2 Conducting (+ Cycle)';
          deviceStates['T1'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
          deviceStates['T2'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
          deviceStates['T3'] = { conducting: false, current: 0, anodeToCathodeVoltage: -vsA };
          deviceStates['T4'] = { conducting: false, current: 0, anodeToCathodeVoltage: -vsA };

        } else if (activeState === 'PAIR_B') {
          vAppliedToLoad = -vsA;
          activeBranchDesc = 'T3, T4 Conducting (- Cycle)';
          deviceStates['T1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA };
          deviceStates['T2'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA };
          deviceStates['T3'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
          deviceStates['T4'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };

        } else {
          vAppliedToLoad = E;
          activeBranchDesc = 'All SCRs Blocking (DCM Mode)';
          deviceStates['T1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA - E };
          deviceStates['T2'] = { conducting: false, current: 0, anodeToCathodeVoltage: 0 };
          deviceStates['T3'] = { conducting: false, current: 0, anodeToCathodeVoltage: -vsA - E };
          deviceStates['T4'] = { conducting: false, current: 0, anodeToCathodeVoltage: 0 };
        }
        break;
      }

      // -------------------------------------------------------------
      // 5. Single-Phase Semi-Controlled Bridge
      // -------------------------------------------------------------
      case '1ph_fw_semi_controlled': {
        const g1 = isGateFired(theta, alphaRad);
        const g2 = isGateFired(theta, Math.PI + alphaRad);
        gatePulses['T1'] = g1;
        gatePulses['T2'] = g2;

        const cycleAngle = theta % (2 * Math.PI);
        const inPositiveHalf = cycleAngle < Math.PI;

        // -----------------------------------------------------------------
        // ASYMMETRIC arrangement
        //   Leg A (source terminal A): T1 on top, T2 at the bottom
        //   Leg B (source terminal B): D1 on top, D2 at the bottom
        //   +half : T1 -> load -> D2        -half : D1 -> load -> T2
        //   Freewheeling: D1 + D2 (both diodes, leg B). The SCRs are NOT in the
        //   freewheeling loop, so each SCR turns off naturally at the zero crossing.
        // -----------------------------------------------------------------
        if (semiConfig === 'asymmetric') {
          // An SCR needs a forward-biased anode: T1 can only fire while vs > 0, T2 while vs < 0.
          if (isGateHeld(theta, alphaRad, holdSpan1ph) && vsA > 0 && (vsA > E || iLoad > 1e-4)) {
            activeState = 'T1_D2';
          } else if (isGateHeld(theta, Math.PI + alphaRad, holdSpan1ph) && vsA < 0 && (-vsA > E || iLoad > 1e-4)) {
            activeState = 'T2_D1';
          }

          if (activeState === 'T1_D2' || activeState === 'T2_D1') {
            const posPair = activeState === 'T1_D2';
            const sourceHalfMatches = posPair ? inPositiveHalf : !inPositiveHalf;
            if (sourceHalfMatches) {
              // Source is feeding the load through the fired SCR and the diagonal diode
              vAppliedToLoad = posPair ? vsA : -vsA;
              activeBranchDesc = posPair ? 'T1, D2 Conducting (+ Half-Cycle)' : 'T2, D1 Conducting (- Half-Cycle)';
              // Only the conducting diagonal carries the load current; the other pair is off (0 A).
              deviceStates['T1'] = { conducting: posPair, current: posPair ? iLoad : 0, anodeToCathodeVoltage: posPair ? 0 : vsA };
              deviceStates['T2'] = { conducting: !posPair, current: !posPair ? iLoad : 0, anodeToCathodeVoltage: posPair ? -vsA : 0 };
              deviceStates['D1'] = { conducting: !posPair, current: !posPair ? iLoad : 0, anodeToCathodeVoltage: posPair ? -vsA : 0 };
              deviceStates['D2'] = { conducting: posPair, current: posPair ? iLoad : 0, anodeToCathodeVoltage: posPair ? 0 : vsA };
            } else {
              // Source reversed: SCR commutates off, load current freewheels through D1 + D2
              vAppliedToLoad = 0;
              activeBranchDesc = 'Freewheeling via D1, D2 (Vo = 0V, Is = 0A)';
              deviceStates['T1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA };
              deviceStates['T2'] = { conducting: false, current: 0, anodeToCathodeVoltage: -vsA };
              deviceStates['D1'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
              deviceStates['D2'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            }
          } else {
            vAppliedToLoad = E;
            activeBranchDesc = 'Blocking (DCM Mode)';
            deviceStates['T1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA - E };
            deviceStates['T2'] = { conducting: false, current: 0, anodeToCathodeVoltage: -vsA - E };
            // Each diode is in series with a blocking SCR, which holds the forward voltage: diodes only show reverse voltage.
            deviceStates['D1'] = { conducting: false, current: 0, anodeToCathodeVoltage: Math.min(0, -vsA) };
            deviceStates['D2'] = { conducting: false, current: 0, anodeToCathodeVoltage: Math.min(0, vsA) };
          }
          break;
        }

        // -----------------------------------------------------------------
        // SYMMETRIC arrangement (one SCR + one diode in each leg)
        //   Leg A: T1 (top), D1 (bottom)      Leg B: T2 (top), D2 (bottom)
        //   +half : T1 -> load -> D2          -half : T2 -> load -> D1
        //   Freewheeling: T1 + D1 (after +half) or T2 + D2 (after -half),
        //   i.e. an SCR and the diode of the SAME leg; the SCR keeps conducting.
        // -----------------------------------------------------------------
        if (isGateHeld(theta, alphaRad, holdSpan1ph) && (vsA > E || iLoad > 1e-4)) {
          activeState = 'T1_D2';
        } else if (isGateHeld(theta, Math.PI + alphaRad, holdSpan1ph) && (-vsA > E || iLoad > 1e-4)) {
          activeState = 'T2_D1';
        }

        // Freewheeling check:
        // In semi-controlled, when vs crosses zero, diodes provide freewheeling loop:
        // Output voltage cannot go negative!
        if (activeState === 'T1_D2') {
          if (!inPositiveHalf && iLoad > 1e-4) {
            // Freewheeling mode: T1 and D1 (same leg)
            vAppliedToLoad = 0;
            activeBranchDesc = 'Freewheeling via T1, D1 (Vo = 0V, Is = 0A)';
            deviceStates['T1'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['D1'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['T2'] = { conducting: false, current: 0, anodeToCathodeVoltage: -vsA };
            deviceStates['D2'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA };
          } else {
            vAppliedToLoad = vsA;
            activeBranchDesc = 'T1, D2 Conducting';
            deviceStates['T1'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['D2'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['T2'] = { conducting: false, current: 0, anodeToCathodeVoltage: -vsA };
            deviceStates['D1'] = { conducting: false, current: 0, anodeToCathodeVoltage: -vsA };
          }
        } else if (activeState === 'T2_D1') {
          if (inPositiveHalf && iLoad > 1e-4) {
            // Freewheeling mode: T2 and D2 (same leg)
            vAppliedToLoad = 0;
            activeBranchDesc = 'Freewheeling via T2, D2 (Vo = 0V, Is = 0A)';
            deviceStates['T2'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['D2'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['T1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA };
            deviceStates['D1'] = { conducting: false, current: 0, anodeToCathodeVoltage: -vsA };
          } else {
            vAppliedToLoad = -vsA;
            activeBranchDesc = 'T2, D1 Conducting';
            deviceStates['T2'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['D1'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['T1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA };
            deviceStates['D2'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA };
          }
        } else {
          vAppliedToLoad = E;
          activeBranchDesc = 'Blocking (DCM Mode)';
          deviceStates['T1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA - E };
          deviceStates['T2'] = { conducting: false, current: 0, anodeToCathodeVoltage: -vsA - E };
          // Each diode is in series with a blocking SCR, which holds the forward voltage: diodes only show reverse voltage.
          deviceStates['D1'] = { conducting: false, current: 0, anodeToCathodeVoltage: Math.min(0, -vsA) };
          deviceStates['D2'] = { conducting: false, current: 0, anodeToCathodeVoltage: Math.min(0, vsA) };
        }
        break;
      }

      // -------------------------------------------------------------
      // 6. Three-Phase Half-Wave Diode
      // -------------------------------------------------------------
      case '3ph_hw_diode': {
        const maxV = Math.max(vsA, vsB, vsC);
        const isConducting = iLoad > 1e-4 || maxV > E;

        if (isConducting) {
          vAppliedToLoad = maxV;
          if (maxV === vsA) {
            activeBranchDesc = 'D1 Conducting (Phase A Max)';
            deviceStates['D1'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['D2'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsB - vsA };
            deviceStates['D3'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsC - vsA };
          } else if (maxV === vsB) {
            activeBranchDesc = 'D2 Conducting (Phase B Max)';
            deviceStates['D1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA - vsB };
            deviceStates['D2'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates['D3'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsC - vsB };
          } else {
            activeBranchDesc = 'D3 Conducting (Phase C Max)';
            deviceStates['D1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA - vsC };
            deviceStates['D2'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsB - vsC };
            deviceStates['D3'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
          }
        } else {
          vAppliedToLoad = E;
          activeBranchDesc = 'All Diodes OFF (Load Discontinuous)';
          deviceStates['D1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA - E };
          deviceStates['D2'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsB - E };
          deviceStates['D3'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsC - E };
        }
        break;
      }

      // -------------------------------------------------------------
      // 7. Three-Phase Half-Wave Thyristor
      // -------------------------------------------------------------
      case '3ph_hw_thyristor': {
        // Natural crossover references: Phase A starts at 30 deg (PI/6)
        const trigA = Math.PI / 6 + alphaRad;
        const trigB = (5 * Math.PI) / 6 + alphaRad;
        const trigC = (9 * Math.PI) / 6 + alphaRad;

        const g1 = isGateFired(theta, trigA);
        const g2 = isGateFired(theta, trigB);
        const g3 = isGateFired(theta, trigC);
        gatePulses['T1'] = g1;
        gatePulses['T2'] = g2;
        gatePulses['T3'] = g3;

        if (g1 && (vsA > E || iLoad > 1e-4)) activeState = 'T1';
        else if (g2 && (vsB > E || iLoad > 1e-4)) activeState = 'T2';
        else if (g3 && (vsC > E || iLoad > 1e-4)) activeState = 'T3';
        else if (iLoad <= 1e-4) {
          // Idle (DCM): the held gate fires whichever device becomes forward biased inside its own window
          if (isGateHeld(theta, trigA, holdSpan3phSingle) && vsA > E) activeState = 'T1';
          else if (isGateHeld(theta, trigB, holdSpan3phSingle) && vsB > E) activeState = 'T2';
          else if (isGateHeld(theta, trigC, holdSpan3phSingle) && vsC > E) activeState = 'T3';
        }

        if (activeState === 'T1') {
          vAppliedToLoad = vsA;
          activeBranchDesc = 'T1 Conducting (Phase A)';
          deviceStates['T1'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
          deviceStates['T2'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsB - vsA };
          deviceStates['T3'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsC - vsA };
        } else if (activeState === 'T2') {
          vAppliedToLoad = vsB;
          activeBranchDesc = 'T2 Conducting (Phase B)';
          deviceStates['T1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA - vsB };
          deviceStates['T2'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
          deviceStates['T3'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsC - vsB };
        } else if (activeState === 'T3') {
          vAppliedToLoad = vsC;
          activeBranchDesc = 'T3 Conducting (Phase C)';
          deviceStates['T1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA - vsC };
          deviceStates['T2'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsB - vsC };
          deviceStates['T3'] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
        } else {
          vAppliedToLoad = E;
          activeBranchDesc = 'All SCRs Blocking';
          deviceStates['T1'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsA - E };
          deviceStates['T2'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsB - E };
          deviceStates['T3'] = { conducting: false, current: 0, anodeToCathodeVoltage: vsC - E };
        }
        break;
      }

      // -------------------------------------------------------------
      // 8. Three-Phase Diode Bridge (6-Pulse)
      // -------------------------------------------------------------
      case '3ph_fw_diode_bridge': {
        const topMax = Math.max(vsA, vsB, vsC);
        const botMin = Math.min(vsA, vsB, vsC);
        const lineV = topMax - botMin;
        const isConducting = iLoad > 1e-4 || lineV > E;

        // Initialize all 6 to false
        for (const lbl of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']) {
          deviceStates[lbl] = { conducting: false, current: 0, anodeToCathodeVoltage: 0 };
        }

        if (isConducting) {
          vAppliedToLoad = lineV;
          // Top group: D1(A), D3(B), D5(C)
          let topName = 'D1';
          if (topMax === vsA) topName = 'D1';
          else if (topMax === vsB) topName = 'D3';
          else topName = 'D5';

          // Bottom group: D4(A), D6(B), D2(C)
          let botName = 'D4';
          if (botMin === vsA) botName = 'D4';
          else if (botMin === vsB) botName = 'D6';
          else botName = 'D2';

          deviceStates[topName] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
          deviceStates[botName] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
          activeBranchDesc = `${topName} & ${botName} Conducting (Line: ${lineV.toFixed(0)}V)`;
        } else {
          vAppliedToLoad = E;
          activeBranchDesc = 'All Diodes OFF (Load Discontinuous)';
        }
        break;
      }

      // -------------------------------------------------------------
      // 9. Three-Phase Semi-Controlled Bridge
      // -------------------------------------------------------------
      case '3ph_fw_semi_controlled': {
        // Top: T1(A), T3(B), T5(C)
        // Bottom: D4(A), D6(B), D2(C)
        const trigA = Math.PI / 6 + alphaRad;
        const trigB = (5 * Math.PI) / 6 + alphaRad;
        const trigC = (9 * Math.PI) / 6 + alphaRad;

        const g1 = isGateFired(theta, trigA);
        const g3 = isGateFired(theta, trigB);
        const g5 = isGateFired(theta, trigC);
        gatePulses['T1'] = g1;
        gatePulses['T3'] = g3;
        gatePulses['T5'] = g5;

        // Determine which bottom diode is forward biased (most negative phase)
        const botMin = Math.min(vsA, vsB, vsC);
        let botDiode = 'D4';
        let botPhase = vsA;
        if (botMin === vsA) {
          botDiode = 'D4';
          botPhase = vsA;
        } else if (botMin === vsB) {
          botDiode = 'D6';
          botPhase = vsB;
        } else {
          botDiode = 'D2';
          botPhase = vsC;
        }

        if (g1) activeState = 'T1';
        else if (g3) activeState = 'T3';
        else if (g5) activeState = 'T5';
        else if (iLoad <= 1e-4) {
          if (isGateHeld(theta, trigA, holdSpan3phSingle) && vsA - botMin > E) activeState = 'T1';
          else if (isGateHeld(theta, trigB, holdSpan3phSingle) && vsB - botMin > E) activeState = 'T3';
          else if (isGateHeld(theta, trigC, holdSpan3phSingle) && vsC - botMin > E) activeState = 'T5';
        }

        for (const lbl of ['T1', 'T3', 'T5', 'D2', 'D4', 'D6']) {
          deviceStates[lbl] = { conducting: false, current: 0, anodeToCathodeVoltage: 0 };
        }

        let topPhase = 0;
        let topScr = 'T1';
        if (activeState === 'T1') {
          topPhase = vsA;
          topScr = 'T1';
        } else if (activeState === 'T3') {
          topPhase = vsB;
          topScr = 'T3';
        } else if (activeState === 'T5') {
          topPhase = vsC;
          topScr = 'T5';
        }

        if (activeState !== 'NONE' && (topPhase - botPhase > E || iLoad > 1e-4)) {
          let lineDiff = topPhase - botPhase;
          // In semi-controlled, freewheeling clamps Vo to 0 when lineDiff < 0
          if (lineDiff < 0) {
            vAppliedToLoad = 0;
            activeBranchDesc = `Freewheeling Action (Vo clamped to 0V)`;
            // Freewheeling occurs through diode of same phase or bridge diodes
            deviceStates[topScr] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates[botDiode] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
          } else {
            vAppliedToLoad = lineDiff;
            activeBranchDesc = `${topScr} & ${botDiode} Conducting`;
            deviceStates[topScr] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
            deviceStates[botDiode] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
          }

        } else {
          vAppliedToLoad = E;
          activeBranchDesc = 'All Devices Blocking (DCM)';
        }
        break;
      }

      // -------------------------------------------------------------
      // 10. Three-Phase Fully Controlled Bridge (6-Pulse)
      // -------------------------------------------------------------
      case '3ph_fw_fully_controlled': {
        // Standard 6-pulse firing sequence (every 60 degrees):
        // P1: T1 & T6 at 30° + α (Vab)
        // P2: T1 & T2 at 90° + α (Vac)
        // P3: T3 & T2 at 150° + α (Vbc)
        // P4: T3 & T4 at 210° + α (Vba)
        // P5: T5 & T4 at 270° + α (Vca)
        // P6: T5 & T6 at 330° + α (Vcb)
        const p1 = Math.PI / 6 + alphaRad;
        const p2 = Math.PI / 2 + alphaRad;
        const p3 = (5 * Math.PI) / 6 + alphaRad;
        const p4 = (7 * Math.PI) / 6 + alphaRad;
        const p5 = (9 * Math.PI) / 6 + alphaRad;
        const p6 = (11 * Math.PI) / 6 + alphaRad;

        const g1 = isGateFired(theta, p1) || isGateFired(theta, p2);
        const g2 = isGateFired(theta, p2) || isGateFired(theta, p3);
        const g3 = isGateFired(theta, p3) || isGateFired(theta, p4);
        const g4 = isGateFired(theta, p4) || isGateFired(theta, p5);
        const g5 = isGateFired(theta, p5) || isGateFired(theta, p6);
        const g6 = isGateFired(theta, p6) || isGateFired(theta, p1);

        gatePulses['T1'] = g1;
        gatePulses['T2'] = g2;
        gatePulses['T3'] = g3;
        gatePulses['T4'] = g4;
        gatePulses['T5'] = g5;
        gatePulses['T6'] = g6;

        if (isGateFired(theta, p1)) activeState = 'T1_T6';
        else if (isGateFired(theta, p2)) activeState = 'T1_T2';
        else if (isGateFired(theta, p3)) activeState = 'T3_T2';
        else if (isGateFired(theta, p4)) activeState = 'T3_T4';
        else if (isGateFired(theta, p5)) activeState = 'T5_T4';
        else if (isGateFired(theta, p6)) activeState = 'T5_T6';
        else if (iLoad <= 1e-4) {
          if (isGateHeld(theta, p1, holdSpan3phPair) && vLineAB > E) activeState = 'T1_T6';
          else if (isGateHeld(theta, p2, holdSpan3phPair) && -vLineCA > E) activeState = 'T1_T2';
          else if (isGateHeld(theta, p3, holdSpan3phPair) && vLineBC > E) activeState = 'T3_T2';
          else if (isGateHeld(theta, p4, holdSpan3phPair) && -vLineAB > E) activeState = 'T3_T4';
          else if (isGateHeld(theta, p5, holdSpan3phPair) && vLineCA > E) activeState = 'T5_T4';
          else if (isGateHeld(theta, p6, holdSpan3phPair) && -vLineBC > E) activeState = 'T5_T6';
        }

        for (const lbl of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']) {
          deviceStates[lbl] = { conducting: false, current: 0, anodeToCathodeVoltage: 0 };
        }

        let currentLineV = 0;
        let sA = 'T1';
        let sB = 'T6';

        if (activeState === 'T1_T6') {
          currentLineV = vLineAB;
          sA = 'T1';
          sB = 'T6';
        } else if (activeState === 'T1_T2') {
          currentLineV = -vLineCA; // Vac = Va - Vc
          sA = 'T1';
          sB = 'T2';
        } else if (activeState === 'T3_T2') {
          currentLineV = vLineBC;
          sA = 'T3';
          sB = 'T2';
        } else if (activeState === 'T3_T4') {
          currentLineV = -vLineAB; // Vba = Vb - Va
          sA = 'T3';
          sB = 'T4';
        } else if (activeState === 'T5_T4') {
          currentLineV = vLineCA;
          sA = 'T5';
          sB = 'T4';
        } else if (activeState === 'T5_T6') {
          currentLineV = -vLineBC; // Vcb = Vc - Vb
          sA = 'T5';
          sB = 'T6';
        }

        if (activeState !== 'NONE') {
          vAppliedToLoad = currentLineV;
          activeBranchDesc = `${sA} & ${sB} Conducting (${currentLineV.toFixed(0)}V)`;
          deviceStates[sA] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };
          deviceStates[sB] = { conducting: true, current: iLoad, anodeToCathodeVoltage: 0 };

        } else {
          vAppliedToLoad = E;
          activeBranchDesc = 'All SCRs Blocking (DCM)';
        }
        break;
      }
    }

    // Optional Freewheeling Diode (D_FW) action across load.
    // D_FW takes over whenever the converter would push a negative voltage across the load,
    // or when no converter device is conducting while the load still carries current.
    // While it conducts, every converter device is off (SCRs unlatch and must be re-fired).
    let isFwdConducting = false;
    let iFwd = 0;
    if (hasFreewheelingDiode) {
      const anyDeviceOn = Object.values(deviceStates).some((d) => d.conducting);
      if (iLoad > 1e-4 && (vAppliedToLoad < 0 || !anyDeviceOn)) {
        vAppliedToLoad = 0;
        isFwdConducting = true;
        activeState = 'NONE';
        activeBranchDesc = 'Freewheeling via D_FW (Vo = 0V, Is = 0A)';
        for (const key of Object.keys(deviceStates)) {
          deviceStates[key] = { ...deviceStates[key], conducting: false, current: 0 };
        }
      }
    }

    // Load differential equation:  L * di/dt + R * i + E = vAppliedToLoad
    // Ideal devices are unidirectional: when the current would reach zero, every conducting
    // device turns off and the load is left with only its own EMF (v_o = E).
    let conductionEnded = false;
    if (L <= 1e-6) {
      // Pure R or RE load: current follows the voltage instantly
      const rawI = (vAppliedToLoad - E) / R;
      conductionEnded = rawI <= 0;
      iLoad = conductionEnded ? 0 : rawI;
    } else {
      // RL or RLE numerical integration (Heun's predictor-corrector)
      const di_dt1 = (vAppliedToLoad - R * iLoad - E) / L;
      const iPredict = Math.max(0, iLoad + di_dt1 * dt);
      const di_dt2 = (vAppliedToLoad - R * iPredict - E) / L;
      const nextI = iLoad + 0.5 * (di_dt1 + di_dt2) * dt;
      conductionEnded = nextI <= 0;
      iLoad = conductionEnded ? 0 : nextI;
    }

    if (conductionEnded) {
      vAppliedToLoad = E;
      activeState = 'NONE'; // thyristors unlatch (a still-present gate pulse can re-fire them if forward biased)
      isFwdConducting = false;
      iFwd = 0;
      activeBranchDesc = 'All devices OFF (i = 0, Vo = E)';
      for (const key of Object.keys(deviceStates)) {
        deviceStates[key].conducting = false;
        deviceStates[key].current = 0;
      }
    }

    // Report D_FW as a device so the schematic can glow it, and update its current
    if (hasFreewheelingDiode) {
      deviceStates['D_FW'] = {
        conducting: isFwdConducting,
        current: isFwdConducting ? iLoad : 0,
        anodeToCathodeVoltage: 0,
      };
      if (isFwdConducting) iFwd = iLoad;
    }

    // Update current in conducting device states
    for (const key of Object.keys(deviceStates)) {
      if (key !== 'D_FW' && deviceStates[key].conducting) {
        deviceStates[key].current = iLoad;
      }
    }

    // Compute Source Currents (iSourcePhaseA, iSourcePhaseB, iSourcePhaseC)
    let iSourceA = 0;
    let iSourceB = 0;
    let iSourceC = 0;

    if (!isFwdConducting && iLoad > 1e-4) {
      switch (topologyId) {
        case '1ph_hw_diode':
        case '1ph_hw_thyristor':
          iSourceA = iLoad;
          break;

        case '1ph_fw_diode_bridge':
          if (deviceStates['D1']?.conducting || deviceStates['D2']?.conducting) iSourceA = iLoad;
          else if (deviceStates['D3']?.conducting || deviceStates['D4']?.conducting) iSourceA = -iLoad;
          break;

        case '1ph_fw_fully_controlled':
          if (activeState === 'PAIR_A') iSourceA = iLoad;
          else if (activeState === 'PAIR_B') iSourceA = -iLoad;
          break;

        case '1ph_fw_semi_controlled':
          if (activeState === 'T1_D2' && vAppliedToLoad > 0) iSourceA = iLoad;
          else if (activeState === 'T2_D1' && vAppliedToLoad > 0) iSourceA = -iLoad;
          break;

        case '3ph_hw_diode':
        case '3ph_hw_thyristor':
          iSourceA = (deviceStates['D1']?.conducting || deviceStates['T1']?.conducting) ? iLoad : 0;
          iSourceB = (deviceStates['D2']?.conducting || deviceStates['T2']?.conducting) ? iLoad : 0;
          iSourceC = (deviceStates['D3']?.conducting || deviceStates['T3']?.conducting) ? iLoad : 0;
          break;

        case '3ph_fw_diode_bridge':
          iSourceA = (deviceStates['D1']?.conducting ? iLoad : 0) - (deviceStates['D4']?.conducting ? iLoad : 0);
          iSourceB = (deviceStates['D3']?.conducting ? iLoad : 0) - (deviceStates['D6']?.conducting ? iLoad : 0);
          iSourceC = (deviceStates['D5']?.conducting ? iLoad : 0) - (deviceStates['D2']?.conducting ? iLoad : 0);
          break;

        case '3ph_fw_semi_controlled':
          iSourceA = (deviceStates['T1']?.conducting ? iLoad : 0) - (deviceStates['D4']?.conducting ? iLoad : 0);
          iSourceB = (deviceStates['T3']?.conducting ? iLoad : 0) - (deviceStates['D6']?.conducting ? iLoad : 0);
          iSourceC = (deviceStates['T5']?.conducting ? iLoad : 0) - (deviceStates['D2']?.conducting ? iLoad : 0);
          break;

        case '3ph_fw_fully_controlled':
          iSourceA = (deviceStates['T1']?.conducting ? iLoad : 0) - (deviceStates['T4']?.conducting ? iLoad : 0);
          iSourceB = (deviceStates['T3']?.conducting ? iLoad : 0) - (deviceStates['T6']?.conducting ? iLoad : 0);
          iSourceC = (deviceStates['T5']?.conducting ? iLoad : 0) - (deviceStates['T2']?.conducting ? iLoad : 0);
          break;
      }
    }

    // Record sample if in display window
    if (isRecorded) {
      const displayTime = t - displayStartStep * dt;
      const displayThetaDeg = ((omega * displayTime * 180) / Math.PI);

      recordedSamples.push({
        time: displayTime,
        phaseAngleRad: omega * displayTime,
        phaseAngleDeg: displayThetaDeg,
        vSourcePhaseA: vsA,
        vSourcePhaseB: isThreePhaseTopology ? vsB : undefined,
        vSourcePhaseC: isThreePhaseTopology ? vsC : undefined,
        vSourceLineAB: isThreePhaseTopology ? vLineAB : undefined,
        vSourceLineBC: isThreePhaseTopology ? vLineBC : undefined,
        vSourceLineCA: isThreePhaseTopology ? vLineCA : undefined,
        iSourcePhaseA: iSourceA,
        iSourcePhaseB: isThreePhaseTopology ? iSourceB : undefined,
        iSourcePhaseC: isThreePhaseTopology ? iSourceC : undefined,
        vOut: vAppliedToLoad,
        iOut: iLoad,
        isFwdConducting,
        iFwd,
        gatePulses,
        deviceStates,
        activeBranchDescription: activeBranchDesc,
      });
    }
  }

  // Calculate steady state statistics over exactly 1 period
  const samplesPerPeriod = stepsPerCycle;
  const analysisSamples = recordedSamples.slice(0, samplesPerPeriod);

  let sumV = 0;
  let sumV2 = 0;
  let sumI = 0;
  let sumI2 = 0;
  let sumIs2 = 0;
  let sumP = 0;
  let peakI = 0;
  let zeroCurrentCount = 0;

  for (const s of analysisSamples) {
    sumV += s.vOut;
    sumV2 += s.vOut * s.vOut;
    sumI += s.iOut;
    sumI2 += s.iOut * s.iOut;
    sumIs2 += s.iSourcePhaseA * s.iSourcePhaseA;
    sumP += s.vOut * s.iOut;
    if (s.iOut > peakI) peakI = s.iOut;
    if (s.iOut <= 1e-3) zeroCurrentCount++;
  }

  const n = analysisSamples.length;
  const vAvg = sumV / n;
  const vRms = Math.sqrt(sumV2 / n);
  const iAvg = sumI / n;
  const iRms = Math.sqrt(sumI2 / n);
  const iSourceRms = Math.sqrt(sumIs2 / n);
  const pActive = sumP / n;
  // Input-side (AC) apparent power and power factor.
  // Ideal lossless converter: P_in = P_out = mean(vo * io).  S_in = (#phases) * Vs,rms * Is,rms.
  const phaseCount = topologyId.startsWith('3ph') ? 3 : 1;
  const sApparent = phaseCount * vRmsInput * iSourceRms;
  // Signed: negative PF means power flows back to the grid (line-commutated inversion).
  const powerFactor = sApparent > 1e-6 ? Math.min(1, Math.max(-1, pActive / sApparent)) : 0;

  const formFactorV = Math.abs(vAvg) > 1e-3 ? vRms / Math.abs(vAvg) : 1;
  const rippleFactorV = formFactorV >= 1 ? Math.sqrt(Math.max(0, formFactorV * formFactorV - 1)) : 0;
  const formFactorI = Math.abs(iAvg) > 1e-3 ? iRms / Math.abs(iAvg) : 1;
  const rippleFactorI = formFactorI >= 1 ? Math.sqrt(Math.max(0, formFactorI * formFactorI - 1)) : 0;

  // Conduction mode: if current hits 0 for more than 2% of the period, it is DCM
  const isDCM = zeroCurrentCount > n * 0.02;
  const conductionMode = isDCM ? 'Discontinuous (DCM)' : 'Continuous (CCM)';

  // Fourier series & Harmonics (Orders 1 to 25)
  const harmonicsVo = [];
  const harmonicsIs = [];

  let isFundamentalRms = 0;
  let dpf = 1;

  for (let order = 1; order <= 25; order++) {
    const freqHz = order * f;
    let sumCosV = 0;
    let sumSinV = 0;
    let sumCosIs = 0;
    let sumSinIs = 0;

    for (let m = 0; m < n; m++) {
      const angle = (2 * Math.PI * order * (m + 0.5)) / n; // samples sit at mid-step
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      sumCosV += analysisSamples[m].vOut * cosA;
      sumSinV += analysisSamples[m].vOut * sinA;

      sumCosIs += analysisSamples[m].iSourcePhaseA * cosA;
      sumSinIs += analysisSamples[m].iSourcePhaseA * sinA;
    }

    const aV = (2 * sumCosV) / n;
    const bV = (2 * sumSinV) / n;
    const magVRms = Math.sqrt(aV * aV + bV * bV) / Math.SQRT2;
    const pctV = Math.abs(vAvg) > 1e-3 ? (magVRms / Math.abs(vAvg)) * 100 : 0;

    harmonicsVo.push({
      order,
      frequencyHz: freqHz,
      magnitude: magVRms,
      percentage: pctV,
    });

    const aIs = (2 * sumCosIs) / n;
    const bIs = (2 * sumSinIs) / n;
    const magIsRms = Math.sqrt(aIs * aIs + bIs * bIs) / Math.SQRT2;

    if (order === 1) {
      isFundamentalRms = magIsRms;
      // Phase angle of fundamental relative to vs(t) = Vm*sin(wt)
      const fundPhaseRad = Math.atan2(aIs, bIs);
      dpf = isFundamentalRms > 1e-6 ? Math.cos(fundPhaseRad) : 1; // signed: < 0 when power returns to the grid
    }

    const pctIs = isFundamentalRms > 1e-3 ? (magIsRms / isFundamentalRms) * 100 : 0;

    harmonicsIs.push({
      order,
      frequencyHz: freqHz,
      magnitude: magIsRms,
      percentage: pctIs,
    });
  }

  // THD calculations
  const thdCurrent =
    isFundamentalRms > 1e-3
      ? (Math.sqrt(Math.max(0, iSourceRms * iSourceRms - isFundamentalRms * isFundamentalRms)) / isFundamentalRms) * 100
      : 0;

  const thdVoltage =
    Math.abs(vAvg) > 1e-3
      ? (Math.sqrt(Math.max(0, vRms * vRms - vAvg * vAvg)) / Math.abs(vAvg)) * 100
      : 0;

  const distortionFactor =
    iSourceRms > 1e-4 ? Math.min(1, isFundamentalRms / iSourceRms) : 1;

  // theoreticalVdc is computed before the time loop (used to seed the steady-state search)

  return {
    params,
    period: T,
    samples: recordedSamples,
    vAvg,
    vRms,
    iAvg,
    iRms,
    pActive,
    sApparent,
    powerFactor,
    rippleFactorV,
    formFactorV,
    rippleFactorI,
    peakCurrent: peakI,
    conductionMode,
    theoreticalVdc,
    theoreticalVrms,
    iSourceRms,
    iSourceFundamentalRms: isFundamentalRms,
    thdCurrent,
    thdVoltage,
    displacementPowerFactor: dpf,
    distortionFactor,
    harmonicsVo,
    harmonicsIs,
  };
}
