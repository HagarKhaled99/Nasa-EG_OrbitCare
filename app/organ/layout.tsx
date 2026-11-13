import { OrganTabs } from '@/components/orbit/organ-tabs'

export default function OrganLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrganTabs />
      {children}
    </>
  )
}
