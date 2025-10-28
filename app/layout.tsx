import './globals.css'

export const metadata = {
  title: 'Image Search MVP',
  description: 'Upload an image and find similar products',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

