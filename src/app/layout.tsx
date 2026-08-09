import { Toaster } from "@/components/ui/sonner"
import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import { ClerkProvider } from "@clerk/nextjs"
import "./globals.css"
import { TRPCReactProvider } from "@/trpc/client"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"]
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
})

export const metadata: Metadata = {
  title: {
    default: "Resonance",
    template: "%s | Resonance"
  },
  description: "AI-powered text-to-speech and voice cloning platform"
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <TRPCReactProvider>
      <ClerkProvider>
        <html lang="en">
          <body className={`${inter.variable} ${geistMono.variable} antialiased ${inter.className}`}>
            {children}
            <Toaster />
          </body>
        </html>
      </ClerkProvider>
    </TRPCReactProvider>
  )
}
