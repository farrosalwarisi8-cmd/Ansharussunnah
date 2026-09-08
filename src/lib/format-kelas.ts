import type { JenisKelamin } from "@prisma/client"

export function labelJenisKelasKelas(jenisKelamin: JenisKelamin | null | undefined): string | null {
  if (jenisKelamin === "PEREMPUAN") return "Akhwat"
  if (jenisKelamin === "LAKI_LAKI") return "Ikhwan"
  return null
}

export function formatNamaKelas(
  jenjangNama: string | null | undefined,
  nama: string,
  jenisKelamin?: JenisKelamin | null
): string {
  const base = jenjangNama ? `${jenjangNama} - ${nama}` : nama
  const suffix = labelJenisKelasKelas(jenisKelamin)
  return suffix ? `${base} (${suffix})` : base
}