import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// "/api/tel" is Sentry's tunnelRoute (see next.config.ts). It must stay public: error reports are sent
// by unauthenticated visitors too, and auth.protect() here would silently drop every client-side error.
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/api/tel(.*)"])

const isOrgSelectionRoute = createRouteMatcher(["/org-selection(.*)"])

export default clerkMiddleware(async (auth, req) => {
  const { userId, orgId } = await auth()

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // Protect non-public routes
  if (!userId) {
    await auth.protect()
  }

  // Allow org selection page
  if (isOrgSelectionRoute(req)) {
    return NextResponse.next()
  }

  // For all protected routes, ensure org is selected
  if (userId && !orgId) {
    const orgSelection = new URL("/org-selection", req.url)
    return NextResponse.redirect(orgSelection)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)"
  ]
}
