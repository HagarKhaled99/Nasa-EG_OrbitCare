import type { Metadata } from 'next'
import { SignUp } from '@/components/orbit/sign-up'

export const metadata: Metadata = { title: 'Create your crew profile' }

export default function Page() {
  return <SignUp />
}
