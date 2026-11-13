/** /check-in (Member 4, Shahd). */
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
        description="Heart rate, blood oxygen, sleep and exercise arrived automatically from your watch, already compared with your pre-flight normal. Add the readings only you can take, and tell us how you feel."
      />
      <CheckInForm key={astronaut.id} />
    </>
  )
}
