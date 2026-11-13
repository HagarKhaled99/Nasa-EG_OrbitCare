import type { Metadata } from 'next'
import { CrewPulse } from '@/components/orbit/crew-pulse'

export const metadata: Metadata = { title: 'Crew Pulse' }

export default function Page() {
  return <CrewPulse />
}
