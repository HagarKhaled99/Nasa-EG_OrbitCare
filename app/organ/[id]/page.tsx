import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { OrganPanel } from '@/components/orbit/organ-panel'
import { ORGANS, getOrgan } from '@/lib/orbit/organs'

export function generateStaticParams() {
  return ORGANS.map((organ) => ({ id: organ.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return { title: getOrgan(id)?.name ?? 'Organ panel' }
}

export default async function OrganPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const organ = getOrgan(id)
  if (!organ) notFound()
  return <OrganPanel id={organ.id} />
}
