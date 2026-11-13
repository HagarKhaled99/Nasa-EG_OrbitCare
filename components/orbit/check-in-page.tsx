'use client'

import { CheckInForm } from './check-in-form'
import { useOrbit } from './orbit-provider'
import { PageHeader } from './page-header'

export function CheckInPage() {
  const { astronaut } = useOrbit()
  return (
    <>
      <PageHeader
        eyebrow="Daily Check-in · Synced from your watch"
        title="Your watch did the vitals"
        description="Readings arrived automatically from your watch and glucose patch, already compared with your pre-flight normal. Check them, do the two quick tests, and tell us how you feel."
      />
      <CheckInForm key={astronaut.id} />
    </>
  )
}
