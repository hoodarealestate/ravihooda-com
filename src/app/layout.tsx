import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Hooda Team — GTA Real Estate',
  description: 'Ravi & Rashmi Hooda — GTA Real Estate Brokers. 20+ years experience. Century 21 Red Star Realty Inc.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
