import dynamic from "next/dynamic"

const TugasIdPageClient = dynamic(
  () => import("@/components/dashboard/tugas-id-page-client"),
  { ssr: false }
)

export default function Page() {
  return <TugasIdPageClient />
}
