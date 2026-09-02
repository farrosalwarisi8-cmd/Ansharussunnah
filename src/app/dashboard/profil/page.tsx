import dynamic from "next/dynamic"

const ProfilPageClient = dynamic(
  () => import("@/components/dashboard/profil-page-client"),
  { ssr: false }
)

export default function Page() {
  return <ProfilPageClient />
}
