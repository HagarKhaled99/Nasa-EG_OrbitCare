import type { IndicatorId } from './indicators'
import type { Status } from './health'

export type OrganId = 'brain' | 'eyes' | 'heart' | 'blood' | 'muscles' | 'bones' | 'radiation'

export interface OrganDef {
  id: OrganId
  name: string
  shortName: string
  description: string
  hazard: string
  indicators: IndicatorId[]
  position: { x: number; y: number }
  actions: Record<Status, string[]>
  medicalKit?: string
}

export const ORGANS: OrganDef[] = [
  {
    id: 'brain',
    name: 'Brain & mind',
    shortName: 'Brain',
    description:
      'Controls focus, memory, mood and decision making. On a long mission it is your most important tool and the hardest one to check on your own.',
    hazard: 'Isolation & confinement',
    indicators: ['sleep', 'mood', 'crewPulse'],
    position: { x: 50, y: 6.5 },
    actions: {
      normal: [
        'Keep your fixed sleep window and wind-down routine.',
        'Schedule one personal call or message home this week.',
      ],
      watch: [
        'Follow the sleep plan: lights dimmed 60 min before your sleep window, no screens in the bag.',
        'Use the blue-enriched light panel for 30 min after waking to reset your body clock.',
        'Book a 15-minute private talk with a crewmate or the ground psychologist.',
      ],
      act: [
        'Tell the crew medical officer today. You do not need to handle this alone.',
        'Pause safety-critical tasks (EVA, docking) until you have been cleared.',
        'Start the behavioral health protocol in the onboard medical guide, section 7.',
      ],
    },
    medicalKit: 'Sleep aid (melatonin 3 mg) – only after medical officer approval',
  },
  {
    id: 'eyes',
    name: 'Eyes',
    shortName: 'Eyes',
    description:
      'Your eyes guide every task on board. Fluid that moves toward the head in low gravity can press on the back of the eye and blur near vision.',
    hazard: 'Altered gravity (SANS)',
    indicators: ['vision'],
    position: { x: 50, y: 11.8 },
    actions: {
      normal: ['Repeat the near-vision check every 3 days.'],
      watch: [
        'Repeat the vision check tomorrow morning in the same light.',
        'Use the lower-body negative pressure device for 30 min to pull fluid away from the head.',
      ],
      act: [
        'Stop the vision check and tell the crew medical officer now.',
        'Schedule an onboard ultrasound or OCT eye scan.',
      ],
    },
    medicalKit: 'Adjustable-focus glasses (+0.5 to +3.0)',
  },
  {
    id: 'heart',
    name: 'Heart & circulation',
    shortName: 'Heart',
    description:
      'Pumps blood and oxygen around your body. Without gravity, fluid shifts toward your head and your heart adapts — sometimes too much.',
    hazard: 'Altered gravity (fluid shift)',
    indicators: ['heartRate', 'spo2', 'systolic', 'diastolic'],
    position: { x: 54.5, y: 25 },
    actions: {
      normal: [
        'Keep drinking at least 2 L of water across the day.',
        'Complete your scheduled aerobic session on the cycle ergometer.',
      ],
      watch: [
        'Drink an extra 500 mL of water with electrolytes in the next 2 hours.',
        'Do 30 min of moderate aerobic exercise (cycle at 60% effort).',
        'Re-measure resting heart rate tonight and tomorrow morning.',
        'If it stays high for 2 more days, report the persistent change.',
      ],
      act: [
        'Stop exercise and rest in a seated, strapped position.',
        'Repeat the measurement in 10 min. If still out of range, follow the cardiac protocol.',
        'Attach the 3-lead ECG from the medical kit and record 5 minutes.',
      ],
    },
    medicalKit: 'Oral rehydration salts, 3-lead ECG',
  },
  {
    id: 'blood',
    name: 'Blood & immune system',
    shortName: 'Immune',
    description:
      'Fights infection and carries energy to your cells. Radiation and a closed cabin weaken the immune system and make infections spread more easily.',
    hazard: 'Radiation & closed environment',
    indicators: ['glucose', 'temperature'],
    position: { x: 43, y: 34 },
    actions: {
      normal: ['Eat your full meal plan, including fresh-grown greens when available.'],
      watch: [
        'Check that you ate all three meals and drank enough water.',
        'Re-check temperature in 4 hours.',
        'Wash hands and wipe shared surfaces with disinfectant wipes.',
      ],
      act: [
        'Start the fever protocol: rest, fluids, paracetamol 500 mg from the medical kit.',
        'Wear a mask and use your own sleep station to protect the crew.',
        'Record temperature every 4 hours and attach it to the report packet.',
      ],
    },
    medicalKit: 'Paracetamol 500 mg, glucose gel, disinfectant wipes',
  },
  {
    id: 'muscles',
    name: 'Muscles',
    shortName: 'Muscles',
    description:
      'Hold you up, move you and protect your joints. In low gravity your postural muscles are barely used and start to shrink within weeks.',
    hazard: 'Altered gravity',
    indicators: ['exercise', 'grip', 'muscleMass'],
    position: { x: 34.5, y: 28 },
    actions: {
      normal: ['Keep your resistance training schedule: 3 sessions a week minimum.'],
      watch: [
        'Add one extra resistance session this week (squats, deadlifts, heel raises).',
        'Increase load on the resistance device by 5%.',
        'Repeat the grip test in 3 days.',
      ],
      act: [
        'Tell the crew medical officer and adjust the training plan together.',
        'Daily resistance training until values return to your normal.',
      ],
    },
  },
  {
    id: 'bones',
    name: 'Bones',
    shortName: 'Bones',
    description:
      'Your skeleton keeps you upright and stores calcium. Without weight on it, weight-bearing bones like hips and spine lose mineral every month.',
    hazard: 'Altered gravity',
    indicators: ['boneDensity', 'exercise'],
    position: { x: 41, y: 56 },
    actions: {
      normal: ['Keep daily resistance exercise and take your vitamin D supplement.'],
      watch: [
        'Complete 150 min of exercise daily, with at least 60 min of resistance work.',
        'Take calcium (1000 mg) and vitamin D (800 IU) with breakfast.',
        'Use the Future Slider to see how your plan changes the projection.',
      ],
      act: [
        'Talk to the crew medical officer about a bone protection medication.',
        'Avoid high-impact tasks until cleared.',
      ],
    },
    medicalKit: 'Calcium + vitamin D tablets',
  },
  {
    id: 'radiation',
    name: 'Whole body · Radiation',
    shortName: 'Radiation',
    description:
      'Every cell in your body is exposed to space radiation. The dose adds up over the mission, so the goal is to keep the total as low as possible.',
    hazard: 'Space radiation',
    indicators: ['radiationDose'],
    position: { x: 59, y: 48 },
    actions: {
      normal: ['Wear your personal dosimeter at all times.'],
      watch: [
        'Sleep in the shielded crew quarters.',
        'Limit time in low-shielding modules and EVAs where possible.',
      ],
      act: [
        'Move to the storm shelter during any solar particle event alert.',
        'Ask ground to review future EVA plans against your remaining dose budget.',
      ],
    },
  },
]

export function getOrgan(id: string) {
  return ORGANS.find((organ) => organ.id === id)
}
