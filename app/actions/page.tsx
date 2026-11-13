import type { Metadata } from 'next'
import { ActionCenter } from '@/components/orbit/action-center'

export const metadata: Metadata = { title: 'Action Center' }

export default function Page() {
  return <ActionCenter />
}
