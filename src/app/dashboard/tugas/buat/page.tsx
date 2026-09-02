import dynamic from "next/dynamic"

const TugasBuatPageClient = dynamic(
  () => import("@/components/dashboard/tugas-buat-page-client"),
  { ssr: false }
)

export default function Page() {
  return <TugasBuatPageClient />
}
