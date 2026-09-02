import dynamic from "next/dynamic"

const KeuanganPageClient = dynamic(
  () => import("@/components/dashboard/keuangan-page-client"),
  { ssr: false }
)

export default function Page() {
  return <KeuanganPageClient />
}
