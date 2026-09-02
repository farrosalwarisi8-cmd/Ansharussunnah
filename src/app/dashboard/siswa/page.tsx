import dynamic from "next/dynamic"

const SiswaPageClient = dynamic(
  () => import("@/components/dashboard/siswa-page-client"),
  { ssr: false }
)

export default function Page() {
  return <SiswaPageClient />
}
