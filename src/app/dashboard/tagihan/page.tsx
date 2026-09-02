import dynamic from "next/dynamic"

const TagihanPageClient = dynamic(
  () => import("@/components/dashboard/tagihan-page-client"),
  { ssr: false }
)

export default function Page() {
  return <TagihanPageClient />
}
