import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// Pages to refactor: [pagePath, clientComponentPath, componentName]
const pages = [
  ['src/app/dashboard/keuangan/page.tsx', 'src/components/dashboard/keuangan-page-client.tsx', 'KeuanganPageClient'],
  ['src/app/dashboard/siswa/page.tsx', 'src/components/dashboard/siswa-page-client.tsx', 'SiswaPageClient'],
  ['src/app/dashboard/absensi/page.tsx', 'src/components/dashboard/absensi-page-client.tsx', 'AbsensiPageClient'],
  ['src/app/dashboard/periode-ajaran/page.tsx', 'src/components/dashboard/periode-ajaran-page-client.tsx', 'PeriodeAjaranPageClient'],
  ['src/app/dashboard/ujian/buat/page.tsx', 'src/components/dashboard/ujian-buat-page-client.tsx', 'UjianBuatPageClient'],
  ['src/app/dashboard/tugas/page.tsx', 'src/components/dashboard/tugas-page-client.tsx', 'TugasPageClient'],
  ['src/app/dashboard/kelas/page.tsx', 'src/components/dashboard/kelas-page-client.tsx', 'KelasPageClient'],
  ['src/app/dashboard/verifikasi-pendaftaran/page.tsx', 'src/components/dashboard/verifikasi-pendaftaran-page-client.tsx', 'VerifikasiPendaftaranPageClient'],
  ['src/app/dashboard/guru/page.tsx', 'src/components/dashboard/guru-page-client.tsx', 'GuruPageClient'],
  ['src/app/dashboard/materi/page.tsx', 'src/components/dashboard/materi-page-client.tsx', 'MateriPageClient'],
  ['src/app/dashboard/rapor/page.tsx', 'src/components/dashboard/rapor-page-client.tsx', 'RaporPageClient'],
  ['src/app/dashboard/tugas/[id]/page.tsx', 'src/components/dashboard/tugas-id-page-client.tsx', 'TugasIdPageClient'],
  ['src/app/dashboard/ujian/[id]/rekap/page.tsx', 'src/components/dashboard/ujian-rekap-page-client.tsx', 'UjianRekapPageClient'],
  ['src/app/dashboard/kelas/[id]/pengajar/page.tsx', 'src/components/dashboard/kelas-pengajar-page-client.tsx', 'KelasPengajarPageClient'],
  ['src/app/dashboard/ujian/page.tsx', 'src/components/dashboard/ujian-page-client.tsx', 'UjianPageClient'],
  ['src/app/dashboard/kenaikan-kelas/page.tsx', 'src/components/dashboard/kenaikan-kelas-page-client.tsx', 'KenaikanKelasPageClient'],
  ['src/app/dashboard/tagihan/page.tsx', 'src/components/dashboard/tagihan-page-client.tsx', 'TagihanPageClient'],
  ['src/app/dashboard/ujian/[id]/kerjakan/page.tsx', 'src/components/dashboard/ujian-kerjakan-page-client.tsx', 'UjianKerjakanPageClient'],
  ['src/app/dashboard/profil/page.tsx', 'src/components/dashboard/profil-page-client.tsx', 'ProfilPageClient'],
  ['src/app/dashboard/kelola-akun-keuangan/page.tsx', 'src/components/dashboard/kelola-akun-keuangan-page-client.tsx', 'KelolaAkunKeuanganPageClient'],
]

const root = process.cwd()
let successCount = 0
let errorCount = 0

for (const [pagePath, clientPath, componentName] of pages) {
  try {
    const fullPath = join(root, pagePath)
    if (!existsSync(fullPath)) {
      console.log(`SKIP: ${pagePath} not found`)
      continue
    }

    const content = readFileSync(fullPath, 'utf8')
    
    // Check if already has "use client"
    if (!content.includes('"use client"')) {
      console.log(`SKIP: ${pagePath} already refactored (no "use client")`)
      continue
    }

    // Remove "use client" directive and prepare client content
    let clientContent = content.replace(/^"use client"\s*\n?/, '')
    
    // Add "use client" back at the top (it's needed for client component)
    clientContent = '"use client"\n\n' + clientContent

    // Write the client component
    writeFileSync(join(root, clientPath), clientContent, 'utf8')
    console.log(`CREATED: ${clientPath}`)

    // Create the thin Server Component page.tsx
    const importPath = clientPath.replace('src/components/', '@/components/').replace('.tsx', '')
    const serverContent = `import dynamic from "next/dynamic"

const ${componentName} = dynamic(
  () => import("${importPath}"),
  { ssr: false }
)

export default function Page() {
  return <${componentName} />
}
`
    writeFileSync(fullPath, serverContent, 'utf8')
    console.log(`UPDATED: ${pagePath} → Server Component`)
    
    successCount++
  } catch (err) {
    console.error(`ERROR: ${pagePath}: ${err.message}`)
    errorCount++
  }
}

console.log(`\nDone: ${successCount} pages refactored, ${errorCount} errors, ${pages.length - successCount - errorCount} skipped`)
