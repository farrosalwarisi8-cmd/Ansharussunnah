import dynamic from "next/dynamic"

const MateriPageClient = dynamic(
  () => import("@/components/dashboard/materi-page-client"),
  { ssr: false }
)

export default function Page() {
  return <MateriPageClient />
}
