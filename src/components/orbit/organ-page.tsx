/**
 * /organ/:organId (Member 3, Menna). Replaces her Next.js app/organ/layout.tsx + app/organ/[id]/page.tsx:
 * the body-system tabs on top, then the organ panel. Unknown ids show a short "not found" message.
 */
import { useParams } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/button'
import { getOrgan } from '@/lib/orbit/organs'
import { OrganPanel } from './organ-panel'
import { OrganTabs } from './organ-tabs'

export function OrganPage() {
  const { organId = '' } = useParams()
  const organ = getOrgan(organId)

  if (!organ) {
    return (
      <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold">Body system not found</h1>
        <p className="text-sm text-muted-foreground">There is no organ panel called “{organId}”.</p>
        <ButtonLink to="/" variant="outline">
          Back to Twin View
        </ButtonLink>
      </section>
    )
  }

  return (
    <>
      <OrganTabs />
      {/* key: a fresh panel per organ, so nothing carries over when switching tabs */}
      <OrganPanel key={organ.id} id={organ.id} />
    </>
  )
}
