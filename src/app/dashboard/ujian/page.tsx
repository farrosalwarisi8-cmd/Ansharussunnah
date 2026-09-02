import dynamic from "next/dynamic"

const UjianPageClient = dynamic(
  () => import("@/components/dashboard/ujian-page-client"),
  { ssr: false }
)

export default function Page() {
  return <UjianPageClient />
}
