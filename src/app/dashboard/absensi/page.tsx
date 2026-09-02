import dynamic from "next/dynamic"

const AbsensiPageClient = dynamic(
  () => import("@/components/dashboard/absensi-page-client"),
  { ssr: false }
)

export default function Page() {
  return <AbsensiPageClient />
}
