import dynamic from "next/dynamic"

const VerifikasiPendaftaranPageClient = dynamic(
  () => import("@/components/dashboard/verifikasi-pendaftaran-page-client"),
  { ssr: false }
)

export default function Page() {
  return <VerifikasiPendaftaranPageClient />
}
