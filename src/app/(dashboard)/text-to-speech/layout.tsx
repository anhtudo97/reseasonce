import { TextToSpeechLayout } from "@/features/text-to-speech/views/text-to-speech-layout"
import { PropsWithChildren } from "react"

export default function Layout({ children }: PropsWithChildren) {
  return <TextToSpeechLayout>{children}</TextToSpeechLayout>
}
