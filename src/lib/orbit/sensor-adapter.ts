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
/** The twin uses the average of the good packets from the last minute, never one 5-second packet. */
export const WATCH_AVERAGE_MS = 60_000
/** Fewer good packets than this in that minute → no live value yet (the twin keeps today's stored reading). */
export const WATCH_MIN_PACKETS = 6

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

/**
 * What the twin is allowed to use: the AVERAGE of the good packets from the last minute (at least 6 packets).
 * One 5-second packet is too noisy to raise an emergency on its own: a heart rate of 73 ± 2 must not flip to
 * Act just because one packet read 75. A real change (or a demo injection) moves the whole average.
 */
export function liveAverage(samples: WatchSample[]) {
  const newest = samples[samples.length - 1]?.at ?? 0
  const recent = samples.filter((s) => newest - s.at <= WATCH_AVERAGE_MS)
  const avg = (pick: (s: WatchSample) => number | null, ok: (s: WatchSample) => boolean) => {
    const good = recent.filter(ok).map(pick).filter((v): v is number => v !== null)
    if (good.length < WATCH_MIN_PACKETS) return null
    const at = [...recent].reverse().find(ok)!.at
    return { value: Math.round(good.reduce((a, b) => a + b, 0) / good.length), at, packets: good.length }
  }
  return {
    heartRate: avg((s) => s.heartRate, (s) => s.heartRateQuality === 'good' && s.heartRate !== null),
    spo2: avg((s) => s.spo2, (s) => s.spo2Quality === 'good' && s.spo2 !== null),
  }
}

/** Latest sample whose quality is good, per measurement (shown as "last good … ago"). */
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
