export type MeasuredIndicatorId =
  | 'heartRate'
  | 'systolic'
  | 'diastolic'
  | 'glucose'
  | 'temperature'
  | 'sleep'
  | 'mood'
  | 'exercise'
  | 'grip'
  | 'vision'

export type ComputedIndicatorId = 'boneDensity' | 'muscleMass' | 'radiationDose' | 'crewPulse'

export type IndicatorId = MeasuredIndicatorId | ComputedIndicatorId

export interface IndicatorMeta {
  id: IndicatorId
  label: string
  unit: string
  decimals: number
  bad: 'both' | 'low' | 'high'
  watchPct: number
  actPct: number
  hardMin?: number
  hardMax?: number
  step: number
  how: string
  why: string
  hazard: string
  source: string
}

export const INDICATORS: Record<IndicatorId, IndicatorMeta> = {
  heartRate: {
    id: 'heartRate',
    label: 'Resting heart rate',
    unit: 'bpm',
    decimals: 0,
    bad: 'both',
    watchPct: 0.1,
    actPct: 0.2,
    hardMin: 40,
    hardMax: 120,
    step: 1,
    how: 'Sit still for 2 minutes. Clip the pulse oximeter to your index finger and wait until the number stops changing (about 30 seconds).',
    why: 'Without gravity, fluid shifts toward your head and the heart works differently. A resting rate that slowly climbs above your normal can signal dehydration, stress, poor sleep or the start of an illness.',
    hazard: 'Altered gravity',
    source: 'American Heart Association resting ranges',
  },
  systolic: {
    id: 'systolic',
    label: 'Blood pressure (systolic)',
    unit: 'mmHg',
    decimals: 0,
    bad: 'both',
    watchPct: 0.1,
    actPct: 0.2,
    hardMin: 90,
    hardMax: 160,
    step: 1,
    how: 'Rest your arm at heart level. Wrap the cuff 2 cm above the elbow, press start and stay silent until it beeps. Record the top number.',
    why: 'Fluid shift and reduced fitness change how your blood vessels regulate pressure. Large swings raise the risk of fainting after landing and of cardiovascular problems.',
    hazard: 'Altered gravity',
    source: 'American Heart Association',
  },
  diastolic: {
    id: 'diastolic',
    label: 'Blood pressure (diastolic)',
    unit: 'mmHg',
    decimals: 0,
    bad: 'both',
    watchPct: 0.1,
    actPct: 0.2,
    hardMin: 50,
    hardMax: 100,
    step: 1,
    how: 'Read from the same cuff measurement as systolic. Record the bottom number.',
    why: 'Diastolic pressure shows how relaxed your arteries are between beats. Together with systolic it gives your flight surgeon the full picture.',
    hazard: 'Altered gravity',
    source: 'American Heart Association',
  },
  glucose: {
    id: 'glucose',
    label: 'Blood sugar',
    unit: 'mg/dL',
    decimals: 0,
    bad: 'both',
    watchPct: 0.1,
    actPct: 0.2,
    hardMin: 70,
    hardMax: 180,
    step: 1,
    how: 'Clean a fingertip with an alcohol pad, prick the side of the finger with the lancet, and touch the test strip to the drop. Measure before breakfast.',
    why: 'Spaceflight can reduce how well your body responds to insulin. Low or high sugar affects focus, mood and immune defence on long missions.',
    hazard: 'Hostile closed environment',
    source: 'WHO fasting glucose guidance',
  },
  temperature: {
    id: 'temperature',
    label: 'Body temperature',
    unit: '°C',
    decimals: 1,
    bad: 'both',
    watchPct: 0.015,
    actPct: 0.03,
    hardMin: 35.5,
    hardMax: 38,
    step: 0.1,
    how: 'Place the thermometer under your tongue, close your mouth and breathe through your nose until it beeps.',
    why: 'Your immune system weakens in space and microbes spread easily in a closed cabin. A fever is one of the earliest signs of infection.',
    hazard: 'Radiation & closed environment',
    source: 'WHO clinical fever threshold',
  },
  sleep: {
    id: 'sleep',
    label: 'Sleep',
    unit: 'h',
    decimals: 1,
    bad: 'low',
    watchPct: 0.1,
    actPct: 0.25,
    hardMin: 4,
    step: 0.5,
    how: 'Use your wrist actigraphy band or estimate from when you fell asleep to when you woke. Do not count time awake in the bag.',
    why: 'There are 16 sunrises a day in orbit and none on the way to Mars. Losing sleep affects mood, reaction time and decision making long before you notice it.',
    hazard: 'Isolation & confinement',
    source: 'NASA HRP sleep loss risk',
  },
  mood: {
    id: 'mood',
    label: 'Mood (self-report)',
    unit: '/ 5',
    decimals: 0,
    bad: 'low',
    watchPct: 0.2,
    actPct: 0.45,
    hardMin: 1,
    step: 1,
    how: 'Tap the face that best matches how you feel right now. There is no wrong answer and only you and the crew medical officer can see it.',
    why: 'Months in a small cabin far from home can slowly lower mood. Tracking it daily makes small changes visible before they become big ones.',
    hazard: 'Isolation & confinement',
    source: 'NASA HRP behavioral health risk',
  },
  exercise: {
    id: 'exercise',
    label: 'Exercise',
    unit: 'min',
    decimals: 0,
    bad: 'low',
    watchPct: 0.1,
    actPct: 0.2,
    hardMin: 30,
    step: 5,
    how: 'Add up today’s minutes on the treadmill, cycle ergometer and resistance device. The devices log this automatically if you sign in.',
    why: 'Exercise is the main defence against bone and muscle loss in low gravity. Missing sessions shows up months later as weaker bones.',
    hazard: 'Altered gravity',
    source: 'NASA ISS exercise countermeasures',
  },
  grip: {
    id: 'grip',
    label: 'Grip strength self-test',
    unit: 'kg',
    decimals: 0,
    bad: 'low',
    watchPct: 0.1,
    actPct: 0.2,
    step: 1,
    how: 'Hold the dynamometer with your elbow bent at 90°. Squeeze as hard as you can for 3 seconds. Use the best of three tries with your dominant hand.',
    why: 'Grip strength is a quick, simple sign of overall muscle strength. A steady drop tells you that training needs to change.',
    hazard: 'Altered gravity',
    source: 'NASA HRP muscle risk',
  },
  vision: {
    id: 'vision',
    label: 'Near-vision check',
    unit: 'lines',
    decimals: 0,
    bad: 'low',
    watchPct: 0.1,
    actPct: 0.2,
    step: 1,
    how: 'Hold the vision card 40 cm from your eyes in good light. Cover one eye and count how many lines you can read clearly, then switch eyes. Record the lower number.',
    why: 'Fluid shift can press on the back of the eye (SANS). Blurry near vision is often the first sign and needs to be followed up.',
    hazard: 'Altered gravity',
    source: 'NASA HRP SANS risk',
  },
  boneDensity: {
    id: 'boneDensity',
    label: 'Estimated bone density',
    unit: '%',
    decimals: 1,
    bad: 'low',
    watchPct: 0.05,
    actPct: 0.1,
    step: 0.1,
    how: 'Calculated by your twin from mission days, gravity and your exercise minutes. Compared with your pre-flight scan (100%).',
    why: 'Weight-bearing bones lose roughly 1–1.5% per month in microgravity without countermeasures, raising fracture risk on landing.',
    hazard: 'Altered gravity',
    source: 'NASA HRP bone loss findings',
  },
  muscleMass: {
    id: 'muscleMass',
    label: 'Estimated muscle mass',
    unit: '%',
    decimals: 1,
    bad: 'low',
    watchPct: 0.08,
    actPct: 0.15,
    step: 0.1,
    how: 'Calculated by your twin from mission days, gravity and exercise. Compared with your pre-flight baseline (100%).',
    why: 'Muscles that hold you up on Earth are barely used in space and can shrink quickly. You need them to walk on Mars.',
    hazard: 'Altered gravity',
    source: 'NASA HRP muscle risk',
  },
  radiationDose: {
    id: 'radiationDose',
    label: 'Cumulative radiation dose',
    unit: 'mSv',
    decimals: 0,
    bad: 'high',
    watchPct: 0.7,
    actPct: 0.9,
    step: 1,
    how: 'Read automatically from your personal dosimeter and the cabin radiation monitor.',
    why: 'Space radiation damages cells and increases long-term cancer risk. NASA limits career exposure to 600 mSv.',
    hazard: 'Space radiation',
    source: 'NASA-STD-3001 career limit (600 mSv)',
  },
  crewPulse: {
    id: 'crewPulse',
    label: 'Crew Pulse flags',
    unit: 'crewmates',
    decimals: 0,
    bad: 'high',
    watchPct: 0,
    actPct: 0,
    step: 1,
    how: 'Each day, every crewmate privately answers one question about a teammate: “Do they seem like themselves today?”',
    why: 'People in isolation are poor at noticing their own mood decline. Your crew sees you every day and can notice changes you miss.',
    hazard: 'Isolation & confinement',
    source: 'NASA HRP behavioral health risk',
  },
}

export const RADIATION_CAREER_LIMIT = 600
