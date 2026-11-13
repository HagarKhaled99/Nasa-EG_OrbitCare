/**
 * Mock watch adapter (project plan §5: "Simulated wearable → sensorAdapter (mock polling, e.g. every 5 sec)
 * → normalize to a unified schema → local data store → rule engine → twin").
 *
 * SYNTHETIC_DEMO. The fictional ORBIT watch streams heart rate and SpO₂ samples. Each sample is centred on the
 * astronaut's value for today (from the crew database), so the demo cases stay intact (Omar ≈ 88 % SpO₂, Lena's
 * SpO₂ has no signal). Samples carry a quality flag, as real optical sensors do:
 *  - 'good'      → used by the twin
 *  - 'motion'    → wrist moving: the value is unreliable, shown but NOT used ("hold still, re-measuring")
 *  - 'no-signal' → nothing measured
 * Swap this file for a real device or dataset adapter without changing the pages.
 */

export const WATCH_POLL_MS = 5000
/** No good sample for this long → the live value is marked stale. */
export const WATCH_STALE_MS = 30_000

export type SampleQuality = 'good' | 'motion' | 'no-signal'

export interface WatchSample {
  at: number
  heartRate: number | null
  spo2: number | null
  heartRateQuality: SampleQuality
  spo2Quality: SampleQuality
}

/** Today's centre values. `null` = the sensor gives no signal for that measurement today. */
export interface WatchCentre {
  heartRate: number | null
  spo2: number | null
}

function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-9)
  return Math.max(-2, Math.min(2, Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())))
}

/** One normalized watch packet. */
export function nextWatchSample(centre: WatchCentre, now = Date.now(), rand: () => number = Math.random): WatchSample {
  const moving = rand() < 0.12 // about 1 in 8 packets is taken while the wrist moves
  let heartRate: number | null = null
  let heartRateQuality: SampleQuality = 'no-signal'
  if (centre.heartRate !== null) {
    heartRate = Math.round(centre.heartRate + gaussian(rand) * 1.2 + (moving ? 15 + rand() * 20 : 0))
    heartRateQuality = moving ? 'motion' : 'good'
  }
  let spo2: number | null = null
  let spo2Quality: SampleQuality = 'no-signal'
  if (centre.spo2 !== null) {
    spo2 = Math.min(100, Math.round(centre.spo2 + gaussian(rand) * 0.5 - (moving ? 3 + rand() * 4 : 0)))
    spo2Quality = moving ? 'motion' : 'good'
  }
  return { at: now, heartRate, spo2, heartRateQuality, spo2Quality }
}

/** Latest sample whose quality is good, per measurement (what the twin is allowed to use). */
export function latestGood(samples: WatchSample[]) {
  let heartRate: { value: number; at: number } | null = null
  let spo2: { value: number; at: number } | null = null
  for (let i = samples.length - 1; i >= 0 && (!heartRate || !spo2); i--) {
    const s = samples[i]
    if (!heartRate && s.heartRateQuality === 'good' && s.heartRate !== null) heartRate = { value: s.heartRate, at: s.at }
    if (!spo2 && s.spo2Quality === 'good' && s.spo2 !== null) spo2 = { value: s.spo2, at: s.at }
  }
  return { heartRate, spo2 }
}
