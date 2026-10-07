import React, { useState } from 'react';
import { ConverterTopologyId, SemiControlledConfig } from '../types/converter';
import { CONVERTER_CONFIGS } from '../simulator/engine';
import { BookOpen, ChevronDown, ChevronUp, Sparkles, HelpCircle } from 'lucide-react';

interface TheoryPanelProps {
  topologyId: ConverterTopologyId;
  semiConfig?: SemiControlledConfig;
  alpha?: number;
}

export const TheoryPanel: React.FC<TheoryPanelProps> = ({ topologyId, semiConfig = 'symmetric', alpha = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const cfg = CONVERTER_CONFIGS[topologyId];

  const getEducationalContent = () => {
    switch (topologyId) {
      case '1ph_hw_diode':
        return {
          title: 'Single-Phase Half-Wave Diode Rectifier',
          summary: 'Conducts during positive half-cycle when source voltage exceeds load EMF.',
          points: [
            'Conduction Angle: For purely resistive (R) load, conduction occurs for 180° (from 0 to π).',
            'Inductive Load (RL): Current continues flowing past 180° until stored inductive energy (½ L i²) fully discharges through the load, causing negative output voltage excursions.',
            'Discontinuous Mode (DCM): If the load current decays to zero before the next positive half-cycle begins, the diode turns off and the load voltage settles to the EMF value E (or 0V).',
            'Peak Inverse Voltage (PIV): The diode must withstand a maximum reverse voltage of Vm = √2 · Vs,rms.',
          ],
        };
      case '1ph_fw_diode_bridge':
        return {
          title: 'Single-Phase Full-Wave Diode Bridge (Graetz Bridge)',
          summary: 'Two diagonal diode pairs conduct alternately on positive and negative half-cycles.',
          points: [
            'Conduction Pairs: D1 & D2 conduct when Vs > 0; D3 & D4 conduct when Vs < 0.',
            'Ripple Frequency: 2 × supply frequency (100 Hz for 50 Hz, 120 Hz for 60 Hz).',
            'Continuous Conduction: With sufficient load inductance L, current never drops to zero, and the bridge naturally commutates at zero-crossings.',
            'PIV Rating: Each diode blocks a peak inverse voltage of Vm.',
          ],
        };
      case '1ph_hw_thyristor':
        return {
          title: 'Single-Phase Half-Wave Thyristor Rectifier',
          summary: 'Controlled conduction using gate pulses delayed by firing angle α.',
          points: [
            'Gate Triggering: SCR turns on only when a gate pulse is applied AND the anode-cathode voltage is forward biased (vs > E).',
            'Extinction Angle (β): With inductive load, conduction extends from α to β, where β > π. When i(β) = 0, the thyristor line-commutates off.',
            'Holding Current: Once fired, the SCR remains ON regardless of the gate signal as long as the current exceeds the holding threshold.',
          ],
        };
      case '1ph_fw_fully_controlled':
        return {
          title: 'Single-Phase Fully Controlled Converter',
          summary: 'Four thyristors providing full phase control over output voltage and two-quadrant capability.',
          points: [
            'Gate Firing: Pair T1-T2 is triggered at α; Pair T3-T4 is triggered at π + α.',
            'Negative Output Voltage: In Continuous Conduction Mode (CCM), output voltage can be negative during portions of the cycle when α > 0° due to inductive energy maintaining conduction.',
            'Two-Quadrant Operation: For α < 90°, average DC voltage Vdc > 0 (Rectifier mode). For α > 90° with a DC source aiding current, Vdc < 0 (Line-commutated Inverter mode).',
            'DCM vs CCM: For small inductance or large α, current falls to zero before the next firing pair triggers, entering Discontinuous Conduction Mode.',
          ],
        };
      case '1ph_fw_semi_controlled':
        if (semiConfig === 'asymmetric') {
          return {
            title: 'Single-Phase Half-Controlled Bridge: ASYMMETRIC Arrangement',
            summary: 'Both SCRs (T1, T2) share one leg and both diodes (D1, D2) share the other, so the bridge is asymmetric between its two legs.',
            points: [
              'Current Paths: Positive half-cycle T1 → load → D2. Negative half-cycle D1 → load → T2. T1 is fired at α and T2 at π + α.',
              'Diode-Only Freewheeling: When the source reverses, the SCR is commutated off naturally and the load current circulates through D1 and D2 (Vo = 0 V, source current = 0).',
              `Conduction Angles: Each SCR conducts π − α (${Math.max(0, 180 - alpha)}° at the current α) while each diode conducts π + α (${Math.min(360, 180 + alpha)}°). The SCRs see a lower RMS/average current than in the symmetric bridge, the diodes see more.`,
              'Same Terminal Behaviour: With ideal devices Vdc = (Vm/π)(1 + cos α), the input current, power factor and harmonics are identical to the symmetric arrangement; only the device stresses and freewheeling path differ.',
              'Gating: The two SCRs do not share a cathode, so the gate drive needs isolation (pulse transformers/opto-isolation) for each SCR.',
            ],
          };
        }
        return {
          title: 'Single-Phase Half-Controlled Bridge: SYMMETRIC Arrangement',
          summary: 'Each leg holds one SCR and one diode (T1/D1 and T2/D2), so the bridge is symmetric between its legs. The two SCRs share a common cathode.',
          points: [
            'Current Paths: Positive half-cycle T1 → load → D2. Negative half-cycle T2 → load → D1. T1 is fired at α and T2 at π + α.',
            'Same-Leg Freewheeling: When the source reverses, the load current circulates through the SCR and the diode of the same leg (T1 + D1, or T2 + D2), clamping Vo to 0 V with zero source current. The SCR keeps conducting through this interval.',
            'Conduction Angles: Every device conducts 180° regardless of α, so the device ratings are balanced.',
            'No Inverter Mode: The output voltage can never go negative, so Vdc = (Vm/π)(1 + cos α) stays positive for every α.',
            'Gating: With a common cathode the two SCR gate circuits can share a reference, which simplifies the gate drive compared to the asymmetric arrangement.',
          ],
        };
      case '3ph_hw_diode':
        return {
          title: 'Three-Phase Half-Wave Diode Rectifier (3-Pulse)',
          summary: 'Star-connected rectifier where the phase with the highest instantaneous voltage conducts.',
          points: [
            'Natural Commutation: Diodes naturally commutate at phase intersections (30°, 150°, 270°).',
            'Conduction Period: Each diode conducts for 120° (2π/3 radians) per electrical cycle.',
            'Output Ripple: 3-pulse ripple at 3 × supply frequency (150 Hz for 50 Hz system).',
          ],
        };
      case '3ph_hw_thyristor':
        return {
          title: 'Three-Phase Half-Wave Thyristor Rectifier',
          summary: '3-pulse converter with firing angle α referenced to the natural crossover points.',
          points: [
            'Firing Reference: Firing pulses are delayed by α from the natural commutation angles (30° + α for Phase A, 150° + α for Phase B, 270° + α for Phase C).',
            'Continuous Conduction Limit: Conduction becomes discontinuous for α > 30° with resistive loads.',
            'Output Formula: Vdc = (3√3 Vm / 2π) · cos α.',
          ],
        };
      case '3ph_fw_diode_bridge':
        return {
          title: 'Three-Phase Diode Bridge (6-Pulse Graetz Bridge)',
          summary: 'The standard industrial rectifier configuration across high-power supplies and VFDs.',
          points: [
            'Operation: At any instant, one top diode (most positive phase) and one bottom diode (most negative phase) conduct together.',
            '6-Pulse Operation: Commutation occurs every 60° (π/3 radians), creating a 6-pulse DC output with minimal ripple (ripple frequency = 6f = 300 Hz at 50 Hz).',
            'High DC Output: Average output voltage is Vdc = 1.35 · Vline,rms = 2.34 · Vphase,rms.',
          ],
        };
      case '3ph_fw_semi_controlled':
        return {
          title: 'Three-Phase Semi-Controlled Bridge',
          summary: 'Half-controlled 6-pulse bridge with 3 top thyristors and 3 bottom diodes.',
          points: [
            'Hybrid Operation: Top thyristors provide firing angle control; bottom diodes naturally commutate with line crossovers.',
            'Freewheeling Action: For α > 60°, an SCR and diode in the same phase leg provide freewheeling, clamping Vo ≥ 0V.',
            'Lower Cost & Simpler Control: Only 3 gate trigger circuits required compared to 6 for a full bridge.',
          ],
        };
      case '3ph_fw_fully_controlled':
        return {
          title: 'Three-Phase Fully Controlled Converter (6-Pulse Graetz SCR Bridge)',
          summary: 'High-power 2-quadrant converter used in DC motor drives and HVDC transmission.',
          points: [
            '6-Step Firing Sequence: Thyristor pairs are triggered every 60° in the sequence T1-T6 → T1-T2 → T3-T2 → T3-T4 → T5-T4 → T5-T6.',
            'Rectifier / Inverter Boundary: Operates in rectification for 0° ≤ α < 90°, and inversion for 90° < α < 180° (if coupled to an active DC source).',
            'Harmonics: AC line current consists of characteristic harmonics of order 6k ± 1 (5th, 7th, 11th, 13th, etc.).',
          ],
        };
      default:
        return {
          title: cfg.name,
          summary: cfg.description,
          points: [],
        };
    }
  };

  const edu = getEducationalContent();

  return (
    <div
      className="rounded-xl overflow-hidden shadow-lg transition-colors border bg-slate-900/90 border-slate-800 text-slate-200 backdrop-blur"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 border-b flex items-center justify-between transition-colors text-left cursor-pointer bg-slate-950/60 border-slate-800 hover:bg-slate-950/80 text-slate-200"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Educational Theory & Physics Notes
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="no-print">{isExpanded ? 'Collapse Notes' : 'Expand Notes'}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4 text-sm leading-relaxed text-slate-300">
          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/80">
            <h3 className="text-lg font-bold text-amber-300 mb-1.5">{edu.title}</h3>
            <p className="text-[15px] text-slate-400">{edu.summary}</p>
          </div>

          <div className="space-y-2">
            <h4 className="text-base font-bold uppercase tracking-wider text-slate-300">
              Key Engineering Principles
            </h4>
            <ul className="space-y-2 list-disc list-inside text-[15px] text-slate-300">
              {edu.points.map((pt, idx) => {
                const [heading, ...rest] = pt.split(':');
                return (
                  <li key={idx} className="pl-1 text-slate-300">
                    <strong className="text-base text-slate-50">{heading}:</strong>
                    <span>{rest.join(':')}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Differential Equations for R, RL, RLE */}
          <div className="pt-2 border-t border-slate-800 text-sm font-mono text-slate-400 space-y-1.5 bg-slate-950/40 p-3 rounded">
            <div className="text-base text-slate-200 font-bold mb-2">Load State Differential Equations:</div>
            <div>• Governing ODE: <span className="text-amber-300">L · (di/dt) + R · i + E = vo(t)</span></div>
            <div>• Diode / SCR Unidirectional Constraint: <span className="text-emerald-300">i(t) ≥ 0</span></div>
            <div>• Extinction in DCM: <span className="text-sky-300">When i(t) → 0, switches turn OFF, Vo settles to E</span></div>
          </div>
        </div>
      )}
    </div>
  );
};
