import { PageHeader } from "@/components/page-header"
import { PropsWithChildren } from "react"

export function TextToSpeechLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader title="Text to speech" />
      {children}
    </div>
  )
}
