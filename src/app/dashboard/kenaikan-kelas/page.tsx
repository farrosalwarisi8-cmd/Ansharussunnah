import dynamic from "next/dynamic"

const KenaikanKelasPageClient = dynamic(
  () => import("@/components/dashboard/kenaikan-kelas-page-client"),
  { ssr: false }
)

export default function Page() {
  return <KenaikanKelasPageClient />
}
