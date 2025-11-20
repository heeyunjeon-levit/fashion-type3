import './globals.css'
import { LanguageProvider } from './contexts/LanguageContext'

export const metadata = {
  title: 'Fashion Search MVP',
  description: 'Upload an image and find similar products',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}

