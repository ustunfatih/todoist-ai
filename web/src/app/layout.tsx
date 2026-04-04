import type { Metadata } from 'next'
import { Sidebar } from '@/components/layout/sidebar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Life OS — Todoist AI',
  description: 'AI-powered productivity dashboard for your Todoist life',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('life-os-theme')||'dark';document.documentElement.setAttribute('data-theme',t);})()` }} />
      </head>
      <body className="bg-[--color-bg-base] text-[--color-text-primary] antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="ml-60 flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
