import dynamic from "next/dynamic"

const KelasPageClient = dynamic(
  () => import("@/components/dashboard/kelas-page-client"),
  { ssr: false }
)

export default function Page() {
  return <KelasPageClient />
}
