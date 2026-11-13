import type { OrganId } from './organs'

export interface SourceLink {
  title: string
  url: string
  /** One plain-English line, paraphrased from the linked page. */
  summary: string
}

export interface OrganSources {
  hazard: SourceLink
  risks: SourceLink[]
  note?: string
}

const NASA = 'https://www.nasa.gov'

const HAZARD = {
  gravity: {
    title: 'NASA HRP hazard: Gravity fields',
    url: `${NASA}/hrp/hazard-gravity-fields/`,
    summary: 'Muscles, bones, inner ear and organs all have to adjust to new gravity levels, and again on return to Earth.',
  },
  isolation: {
    title: 'NASA HRP hazard: Isolation and confinement',
    url: `${NASA}/hrp/hazard-isolation-and-confinement/`,
    summary: 'Groups far from Earth, confined in a small space for a long time, show behavioral responses.',
  },
  closed: {
    title: 'NASA HRP hazard: Hostile/closed environments',
    url: `${NASA}/hrp/hazard-hostile-closed-environments/`,
    summary: 'A safe cabin needs the right temperature, pressure, light and noise, plus watching microbes and immune responses.',
  },
  radiation: {
    title: 'NASA HRP hazard: Space radiation',
    url: `${NASA}/hrp/hazard-space-radiation/`,
    summary: 'Invisible to the eye, and considered one of the most hazardous parts of spaceflight.',
  },
} satisfies Record<string, SourceLink>

/** Shown on every organ page: distance changes who you contact, never how serious it is. */
export const DISTANCE_HAZARD: SourceLink = {
  title: 'NASA HRP hazard: Distance from Earth',
  url: `${NASA}/hrp/hazard-distance-from-earth/`,
  summary: 'Instructions, supplies and medical care get harder to get from Earth the deeper crews travel.',
}

export const ORGAN_SOURCES: Record<OrganId, OrganSources> = {
  brain: {
    hazard: HAZARD.isolation,
    risks: [
      {
        title: 'Risk of behavioral changes and psychiatric disorders',
        url: `${NASA}/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/`,
        summary: 'Isolation, radiation, distance from Earth and other stressors may affect crew mental health.',
      },
      {
        title: 'Risk of inadequate sleep and irregular schedules',
        url: `${NASA}/reference/risk-from-inadequate-sleep-and-irregular-schedules/`,
        summary: 'Chronic sleep loss, constant work demands and an unsettled body clock all add up.',
      },
      {
        title: 'Risk of inadequate teamwork',
        url: `${NASA}/reference/risk-of-inadequate-teamwork/`,
        summary: 'Crews in long isolation need to work well together and recover quickly after setbacks. This is why Crew Pulse asks teammates.',
      },
    ],
  },
  eyes: {
    hazard: HAZARD.gravity,
    risks: [
      {
        title: 'Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)',
        url: `${NASA}/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/`,
        summary: 'The structure of the eyes and brain can change with spaceflight.',
      },
    ],
  },
  heart: {
    hazard: HAZARD.gravity,
    risks: [
      {
        title: 'Risk of cardiovascular adaptations',
        url: `${NASA}/reference/risk-of-cardiovascular-adaptations/`,
        summary: 'Weightlessness changes blood circulation and how the heart and vessels work, which may raise the risk of cardiovascular events.',
      },
    ],
  },
  blood: {
    hazard: HAZARD.closed,
    risks: [
      {
        title: 'Risk of altered immune system responses',
        url: `${NASA}/reference/risk-of-altered-immune-system-responses/`,
        summary: 'Spaceflight stress can wake up dormant viruses and cause symptoms such as rashes.',
      },
      {
        title: 'Risk of host-microorganism interactions',
        url: `${NASA}/reference/risk-of-host-microorganism-interactions/`,
        summary: 'Skin and gut microbes can change in space, which may make crew members more likely to get sick.',
      },
      {
        title: 'Risk of inadequate food and nutrition',
        url: `${NASA}/reference/risk-of-inadequate-food-and-nutrition/`,
        summary: 'A balanced diet is essential for crew health and performance.',
      },
    ],
  },
  muscles: {
    hazard: HAZARD.gravity,
    risks: [
      {
        title: 'Risk of reduced cardiorespiratory and musculoskeletal fitness',
        url: `${NASA}/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/`,
        summary: 'Every astronaut exercises to counter losses in muscle strength, bone density and heart and vessel performance.',
      },
    ],
  },
  bones: {
    hazard: HAZARD.gravity,
    risks: [
      {
        title: 'Risk of spaceflight-induced bone changes',
        url: `${NASA}/reference/risk-of-spaceflight-induced-bone-changes/`,
        summary: 'Without gravity, bones break down and become more brittle. Diet, exercise and medication research aim to preserve them.',
      },
      {
        title: 'Risk of reduced cardiorespiratory and musculoskeletal fitness',
        url: `${NASA}/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/`,
        summary: 'Exercise is the main countermeasure NASA studies for bone and muscle loss.',
      },
    ],
    note: 'Bone density is not measured by the watch. Your twin estimates it from mission days, gravity and your exercise logs, so treat it as an illustration.',
  },
  radiation: {
    hazard: HAZARD.radiation,
    risks: [
      {
        title: 'Risk of radiation-induced cancers',
        url: `${NASA}/reference/risk-of-radiation-induced-cancers/`,
        summary: 'Crews exposed to space radiation may be more likely to develop cancer.',
      },
      {
        title: 'CSA: Monitoring radiation for astronaut health (26 Feb 2026)',
        url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
        summary: 'Radiation is measured by a separate instrument. The CANS neutron spectrometer is one example. Neutrons make up about 30% of radiation on the ISS.',
      },
    ],
    note: 'Dose comes from a separate dosimeter, not from the watch. In this demo it is simulated.',
  },
}
