export type ConverterTopologyId =
  // Single Phase
  | '1ph_hw_diode'
  | '1ph_fw_diode_bridge'
  | '1ph_hw_thyristor'
  | '1ph_fw_fully_controlled'
  | '1ph_fw_semi_controlled'
  // Three Phase
  | '3ph_hw_diode'
  | '3ph_hw_thyristor'
  | '3ph_fw_diode_bridge'
  | '3ph_fw_semi_controlled'
  | '3ph_fw_fully_controlled';

// Load chain: any non-empty combination of R, L and E, always written in R-L-E order.
// A chain without R (L, E, LE) keeps only the small parasitic resistance set by the R slider.
export type LoadType = 'R' | 'RE' | 'RL' | 'RLE' | 'L' | 'E' | 'LE';

export const composeLoad = (r: boolean, l: boolean, e: boolean): LoadType =>
  ((r ? 'R' : '') + (l ? 'L' : '') + (e ? 'E' : '') || 'R') as LoadType;

// Half-controlled (semi-converter) single-phase bridge arrangements:
//  - symmetric : one SCR + one diode in EACH leg (SCRs share a common cathode).
//                Freewheeling current circulates through an SCR and the diode of the SAME leg.
//  - asymmetric: BOTH SCRs in one leg, BOTH diodes in the other leg.
//                Freewheeling current circulates through the two diodes only.
export type SemiControlledConfig = 'symmetric' | 'asymmetric';

export interface ConverterConfig {
  id: ConverterTopologyId;
  name: string;
  category: 'Single Phase' | 'Three Phase';
  controlled: boolean;
  switchesCount: number;
  switchLabels: string[];
  pulseCountPerCycle: number;
  description: string;
  defaultAlpha: number;
  hasDiodes: boolean;
  hasThyristors: boolean;
  // Formulas are written in a LaTeX subset and typeset by <MathFormula /> (see components/MathFormula.tsx)
  theoreticalFormulaVdc: string;
  theoreticalFormulaVrms: string;
}

export interface SimulationParams {
  topologyId: ConverterTopologyId;
  vRms: number; // Volts RMS
  frequency: number; // Hz
  alpha: number; // degrees (0 to 180)
  loadType: LoadType;
  R: number; // Ohms
  L: number; // Henry
  E: number; // Volts DC
  cyclesToDisplay: number; // 1, 2, or 3
  hasFreewheelingDiode?: boolean; // Optional FWD
  semiConfig?: SemiControlledConfig; // Only used by '1ph_fw_semi_controlled' (default: 'symmetric')
}

export interface DeviceInstantState {
  conducting: boolean;
  current: number; // Amps
  anodeToCathodeVoltage: number; // Volts
}

export interface HarmonicComponent {
  order: number;
  frequencyHz: number;
  magnitude: number;
  percentage: number;
}

export interface SimulationSample {
  time: number; // seconds from t=0
  phaseAngleRad: number; // omega * t in radians
  phaseAngleDeg: number; // omega * t in degrees (0 to 360*cycles)
  
  // Input voltages
  vSourcePhaseA: number; // v_s or v_an
  vSourcePhaseB?: number; // v_bn (3-phase)
  vSourcePhaseC?: number; // v_cn (3-phase)
  vSourceLineAB?: number;
  vSourceLineBC?: number;
  vSourceLineCA?: number;

  // Source currents
  iSourcePhaseA: number; // is or is_a
  iSourcePhaseB?: number; // is_b (3-phase)
  iSourcePhaseC?: number; // is_c (3-phase)

  // Output
  vOut: number; // instantaneous output voltage
  iOut: number; // instantaneous load current

  // Freewheeling diode state
  isFwdConducting?: boolean;
  iFwd?: number;

  // Gates
  gatePulses: Record<string, boolean>; // e.g. T1: true, T2: false

  // Switch currents and states
  deviceStates: Record<string, DeviceInstantState>;

  // Conduction state label
  activeBranchDescription: string;
}

export interface SimulationResult {
  params: SimulationParams;
  period: number; // seconds T = 1/f
  samples: SimulationSample[];
  
  // Steady state computed metrics (calculated over exactly 1 fundamental period)
  vAvg: number;
  vRms: number;
  iAvg: number;
  iRms: number;
  pActive: number;
  sApparent: number;
  powerFactor: number;
  rippleFactorV: number;
  formFactorV: number;
  rippleFactorI: number;
  peakCurrent: number;
  conductionMode: 'Continuous (CCM)' | 'Discontinuous (DCM)';
  extinctionAngleDeg?: number;
  conductionAngleDeg?: number;
  theoreticalVdc?: number;
  theoreticalVrms?: number;

  // Power Quality & Harmonics
  iSourceRms: number;
  iSourceFundamentalRms: number;
  thdCurrent: number; // THD_i %
  thdVoltage: number; // THD_v %
  displacementPowerFactor: number; // DPF = cos(phi_1)
  distortionFactor: number; // DF = I_1,rms / I_rms
  harmonicsVo: HarmonicComponent[];
  harmonicsIs: HarmonicComponent[];
}
