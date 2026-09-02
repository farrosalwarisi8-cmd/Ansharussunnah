import dynamic from "next/dynamic"

const RaporPageClient = dynamic(
  () => import("@/components/dashboard/rapor-page-client"),
  { ssr: false }
)

export default function Page() {
  return <RaporPageClient />
}
