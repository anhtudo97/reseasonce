import { useMemo } from "react"
import { Avatar } from "@dicebear/core"
import { glass } from "@dicebear/collection"

export function useVoiceAvatar(seed: string) {
  return useMemo(() => {
    return new Avatar(glass, {
      seed,
      size: 128
    }).toDataUri()
  }, [seed])
}
