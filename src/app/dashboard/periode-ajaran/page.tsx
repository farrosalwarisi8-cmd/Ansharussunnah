import dynamic from "next/dynamic"

const PeriodeAjaranPageClient = dynamic(
  () => import("@/components/dashboard/periode-ajaran-page-client"),
  { ssr: false }
)

export default function Page() {
  return <PeriodeAjaranPageClient />
}
