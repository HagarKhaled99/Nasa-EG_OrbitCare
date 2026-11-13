import type { Metadata } from 'next'
import { MissionRoutine } from '@/components/orbit/mission-routine'

export const metadata: Metadata = { title: 'Mission & Routine' }

export default function Page() {
  return <MissionRoutine />
}
