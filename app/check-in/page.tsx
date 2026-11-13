import type { Metadata } from 'next'
import { CheckInPage } from '@/components/orbit/check-in-page'

export const metadata: Metadata = { title: 'Daily Check-in' }

export default function Page() {
  return <CheckInPage />
}
