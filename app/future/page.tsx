import type { Metadata } from 'next'
import { FutureSlider } from '@/components/orbit/future-slider'

export const metadata: Metadata = { title: 'Future Slider' }

export default function Page() {
  return <FutureSlider />
}
