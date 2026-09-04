import { createTRPCRouter } from "../init"
import { generationsRouter } from "./generations"
import { voicesRouter } from "./voices"
import { billingRouter } from "./billing"

export const appRouter = createTRPCRouter({
  voices: voicesRouter,
  generations: generationsRouter,
  billing: billingRouter
})

// export type definition of API
export type AppRouter = typeof appRouter
