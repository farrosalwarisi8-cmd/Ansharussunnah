import dynamic from "next/dynamic"

const UjianBuatPageClient = dynamic(
  () => import("@/components/dashboard/ujian-buat-page-client"),
  { ssr: false }
)

export default function Page() {
  return <UjianBuatPageClient />
}
