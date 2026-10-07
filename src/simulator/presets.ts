import { ConverterTopologyId, LoadType, SemiControlledConfig } from '../types/converter';

export interface ExperimentPreset {
  id: string;
  title: string;
  description: string;
  topologyId: ConverterTopologyId;
  vRms: number;
  frequency: number;
  alpha: number;
  loadType: LoadType;
  R: number;
  L: number;
  E: number;
  hasFreewheelingDiode?: boolean;
  semiConfig?: SemiControlledConfig;
}

export const EXPERIMENT_PRESETS: ExperimentPreset[] = [
  {
    id: 'battery_charger_re',
    title: 'Pure RE Load: Battery Charger (Zero Inductance)',
    description: 'Conduction occurs only during intervals where instantaneous supply voltage exceeds battery voltage E = 60V.',
    topologyId: '1ph_fw_diode_bridge',
    vRms: 120,
    frequency: 60,
    alpha: 0,
    loadType: 'RE',
    R: 8,
    L: 0,
    E: 60,
  },
  {
    id: '1ph_fwd_demo',
    title: 'Freewheeling Diode (D_FW) Negative Clamping',
    description: 'External freewheeling diode suppresses negative voltage in 1-phase full controlled bridge, transferring inductive current safely.',
    topologyId: '1ph_fw_fully_controlled',
    vRms: 230,
    frequency: 50,
    alpha: 60,
    loadType: 'RL',
    R: 12,
    L: 0.06,
    E: 0,
    hasFreewheelingDiode: true,
  },
  {
    id: '1ph_fw_rl_ccm',
    title: '1-Phase Full Bridge: Continuous Conduction (CCM)',
    description: 'Highly inductive load (L = 60mH) maintaining continuous load current across zero-crossings.',
    topologyId: '1ph_fw_fully_controlled',
    vRms: 230,
    frequency: 50,
    alpha: 45,
    loadType: 'RL',
    R: 12,
    L: 0.06,
    E: 0,
  },
  {
    id: '1ph_semi_freewheel',
    title: '1-Phase Semi-Controlled (Symmetric): Freewheeling Action',
    description: 'Demonstrates how bridge diodes clamp Vo to 0V during inductive discharge, preventing negative voltage.',
    topologyId: '1ph_fw_semi_controlled',
    vRms: 230,
    frequency: 50,
    alpha: 60,
    loadType: 'RL',
    R: 15,
    L: 0.05,
    E: 0,
    semiConfig: 'symmetric',
  },
  {
    id: '1ph_semi_asymmetric',
    title: '1-Phase Semi-Controlled (Asymmetric): Diode-Only Freewheeling',
    description: 'Both SCRs sit in one leg, both diodes in the other. Freewheeling flows through D1 + D2 only, so each SCR turns off at the zero crossing and conducts just π − α.',
    topologyId: '1ph_fw_semi_controlled',
    vRms: 230,
    frequency: 50,
    alpha: 60,
    loadType: 'RL',
    R: 15,
    L: 0.05,
    E: 0,
    semiConfig: 'asymmetric',
  },
  {
    id: '1ph_hw_dcm',
    title: '1-Phase Half-Wave: Discontinuous Mode (DCM)',
    description: 'SCR conduction angle γ extends past 180° due to inductance, then extinguishes when current hits 0.',
    topologyId: '1ph_hw_thyristor',
    vRms: 230,
    frequency: 50,
    alpha: 30,
    loadType: 'RL',
    R: 20,
    L: 0.03,
    E: 0,
  },
  {
    id: 'battery_charger_rle',
    title: 'Battery Charger (RLE Load with Back-EMF)',
    description: 'DC voltage source E = 48V representing battery storage. Conduction starts only when source exceeds E.',
    topologyId: '1ph_fw_diode_bridge',
    vRms: 120,
    frequency: 60,
    alpha: 0,
    loadType: 'RLE',
    R: 5,
    L: 0.02,
    E: 48,
  },
  {
    id: '3ph_6pulse_bridge',
    title: '3-Phase 6-Pulse Industrial Diode Bridge',
    description: 'Standard 6-pulse rectifier generating low-ripple DC (pulse frequency = 300Hz at 50Hz supply).',
    topologyId: '3ph_fw_diode_bridge',
    vRms: 230,
    frequency: 50,
    alpha: 0,
    loadType: 'RL',
    R: 25,
    L: 0.04,
    E: 0,
  },
  {
    id: '3ph_fully_controlled_60',
    title: '3-Phase Fully Controlled Bridge (α = 60°)',
    description: 'Controlled Graetz bridge showing discontinuous boundary when firing delay reaches 60 degrees.',
    topologyId: '3ph_fw_fully_controlled',
    vRms: 230,
    frequency: 50,
    alpha: 60,
    loadType: 'RL',
    R: 20,
    L: 0.05,
    E: 0,
  },
  {
    id: '3ph_hw_star',
    title: '3-Phase Half-Wave (3-Pulse Star Rectifier)',
    description: 'Natural phase crossover at 30°, 150°, 270°. Each diode conducts for 120° of the electrical cycle.',
    topologyId: '3ph_hw_diode',
    vRms: 230,
    frequency: 50,
    alpha: 0,
    loadType: 'R',
    R: 15,
    L: 0,
    E: 0,
  },
];
