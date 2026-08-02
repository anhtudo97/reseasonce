import { HeroPattern } from "@/features/dashboard/components/hero-pattern"

export function DashboardView() {
  return (
    <div className="relative">
      <HeroPattern />
      <div className="relative space-y-8 p-4 lg:p-16"></div>
    </div>
  )
}
