import dynamic from "next/dynamic"

const TugasPageClient = dynamic(
  () => import("@/components/dashboard/tugas-page-client"),
  { ssr: false }
)

export default function Page() {
  return <TugasPageClient />
}
