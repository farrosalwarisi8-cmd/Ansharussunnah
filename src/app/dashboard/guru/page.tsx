import dynamic from "next/dynamic"

const GuruPageClient = dynamic(
  () => import("@/components/dashboard/guru-page-client"),
  { ssr: false }
)

export default function Page() {
  return <GuruPageClient />
}
