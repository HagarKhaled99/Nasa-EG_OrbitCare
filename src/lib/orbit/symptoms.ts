/**
 * Daily check-in symptoms (self-report). Plan §7: "urgent symptoms can require emergency action even when a
 * reading seems normal". Each symptom maps to the body system it concerns.
 *
 * DEMO criteria: which symptoms count as urgent must be reviewed by a flight surgeon before real use.
 * Keep the ids in sync with SYMPTOM_IDS in server/server.mjs.
 */
import type { Status } from './health'
import type { OrganId } from './organs'

export type SymptomId =
  | 'chest-pain'
  | 'breathless'
  | 'fainting'
  | 'confusion'
  | 'vision-loss'
  | 'headache'
  | 'dizzy'
  | 'nausea'
  | 'blurred-vision'
  | 'congestion'
  | 'feverish'
  | 'back-pain'
  | 'muscle-weakness'
  | 'poor-sleep'

export interface SymptomDef {
  id: SymptomId
  label: string
  organ: OrganId
  /** 'act' = urgent: tell the crew medical officer now. 'watch' = follow it today. */
  level: Extract<Status, 'watch' | 'act'>
  why: string
}

export const SYMPTOMS: SymptomDef[] = [
  { id: 'chest-pain', label: 'Chest pain or pressure', organ: 'heart', level: 'act', why: 'Can be a heart problem. Needs a check now.' },
  { id: 'breathless', label: 'Short of breath at rest', organ: 'heart', level: 'act', why: 'Heart, lungs or cabin air. Needs a check now.' },
  { id: 'fainting', label: 'Fainted, or nearly fainted', organ: 'brain', level: 'act', why: 'Blood pressure or heart rhythm. Needs a check now.' },
  { id: 'confusion', label: 'Confused or unusually drowsy', organ: 'brain', level: 'act', why: 'Can come from low oxygen or CO₂ build-up. Needs a check now.' },
  { id: 'vision-loss', label: 'Sudden vision loss or double vision', organ: 'eyes', level: 'act', why: 'Needs an eye exam now.' },
  { id: 'headache', label: 'Headache', organ: 'brain', level: 'watch', why: 'Common with fluid shift and CO₂. Follow it today.' },
  { id: 'dizzy', label: 'Dizzy or light-headed', organ: 'heart', level: 'watch', why: 'Fluid shift changes blood pressure control.' },
  { id: 'nausea', label: 'Nausea or space sickness', organ: 'brain', level: 'watch', why: 'The balance system adapting to low gravity.' },
  { id: 'blurred-vision', label: 'Blurry near vision', organ: 'eyes', level: 'watch', why: 'Can be an early sign of SANS (fluid pressing on the eye).' },
  { id: 'congestion', label: 'Stuffy head or blocked nose', organ: 'blood', level: 'watch', why: 'Fluid shift, or the start of an infection.' },
  { id: 'feverish', label: 'Chills or feeling feverish', organ: 'blood', level: 'watch', why: 'Possible infection. Measure your temperature.' },
  { id: 'back-pain', label: 'Back pain', organ: 'bones', level: 'watch', why: 'The spine lengthens without gravity.' },
  { id: 'muscle-weakness', label: 'Muscle cramps or weakness', organ: 'muscles', level: 'watch', why: 'Muscles lose strength in low gravity.' },
  { id: 'poor-sleep', label: 'Could not sleep', organ: 'brain', level: 'watch', why: 'Light, noise and stress disturb sleep on board.' },
]

export const SYMPTOM_IDS = SYMPTOMS.map((s) => s.id)

export function getSymptom(id: string) {
  return SYMPTOMS.find((s) => s.id === id)
}

export function isSymptomId(id: unknown): id is SymptomId {
  return typeof id === 'string' && SYMPTOM_IDS.includes(id as SymptomId)
}

/** Strongest symptom level per body system for a list of reported symptoms. */
export function symptomLevels(ids: SymptomId[]): Partial<Record<OrganId, { level: 'watch' | 'act'; labels: string[] }>> {
  const out: Partial<Record<OrganId, { level: 'watch' | 'act'; labels: string[] }>> = {}
  for (const id of ids) {
    const s = getSymptom(id)
    if (!s) continue
    const current = out[s.organ]
    out[s.organ] = {
      level: current?.level === 'act' || s.level === 'act' ? 'act' : 'watch',
      labels: [...(current?.labels ?? []), s.label],
    }
  }
  return out
}
