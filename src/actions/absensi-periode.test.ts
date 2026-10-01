// src/actions/absensi-periode.test.ts
//
// Regresi untuk constraint absensi yang kini menyertakan periodeAjaranId.
// Tujuan: siswa boleh punya absensi pada TANGGAL + MAPEL yang sama di PERIODE
// berbeda — dua baris sah, bukan saling menimpa. Sebelum periode masuk ke
// unique key, baris periode lama bisa memblokir/menimpa penulisan periode baru.
//
// Prisma tiruan bersifat stateful: findFirst menghormati `where` sehingga
// scoping periode benar-benar diuji, bukan sekadar diasumsikan.

import { describe, it, expect, vi, beforeEach } from "vitest"

type Row = {
  id: string
  siswaId: string
  kelasId: string
  periodeAjaranId: string
  mataPelajaranId: string | null
  tanggal: Date
  status: string
  keterangan?: string
  diinputOlehId: string
}

const { store, mocks } = vi.hoisted(() => {
  const store: { rows: Row[] } = { rows: [] }
  return {
    store,
    mocks: {
      verifyGuruAksesKelas: vi.fn(),
      siswaFindFirst: vi.fn(),
      periodeFindUnique: vi.fn(),
      revalidate: vi.fn(),
    },
  }
})

vi.mock("@/lib/guru-auth", () => ({
  verifyGuruAksesKelas: mocks.verifyGuruAksesKelas,
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))

vi.mock("@/lib/prisma", () => ({
  default: {
    siswa: { findFirst: mocks.siswaFindFirst },
    periodeAjaran: { findUnique: mocks.periodeFindUnique },
    mataPelajaran: { findFirst: vi.fn().mockResolvedValue(null) },
    absensi: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            siswaId: string
            kelasId: string
            periodeAjaranId: string
            mataPelajaranId: string | null
            tanggal: Date
          }
        }) =>
          store.rows.find(
            (r) =>
              r.siswaId === where.siswaId &&
              r.kelasId === where.kelasId &&
              r.periodeAjaranId === where.periodeAjaranId &&
              r.mataPelajaranId === where.mataPelajaranId &&
              r.tanggal.getTime() === new Date(where.tanggal).getTime()
          ) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Omit<Row, "id"> }) => {
        const row: Row = { id: `abs-${store.rows.length + 1}`, ...data }
        store.rows.push(row)
        return row
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = store.rows.find((r) => r.id === where.id)
        if (row) Object.assign(row, data)
        return row
      }),
    },
  },
}))

import { inputAbsensiSingle } from "@/actions/absensi"

const basePayload = {
  siswaId: "siswa-1",
  kelasId: "kelas-1",
  mataPelajaranId: "mapel-1",
  tanggal: "2026-03-10",
  status: "HADIR" as const,
}

describe("inputAbsensiSingle — scoping per periode ajaran", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.rows = []
    mocks.verifyGuruAksesKelas.mockResolvedValue({
      user: { id: "guru-1" },
      roleInKelas: "PENGAJAR",
    })
    mocks.siswaFindFirst.mockResolvedValue({ id: "siswa-1", kelasId: "kelas-1" })
    mocks.periodeFindUnique.mockResolvedValue({ id: "periode-1" })
  })

  it("menyimpan absensi pada tanggal+mapel sama di dua periode berbeda sebagai dua baris", async () => {
    const r1 = await inputAbsensiSingle({
      ...basePayload,
      periodeAjaranId: "periode-1",
    })
    const r2 = await inputAbsensiSingle({
      ...basePayload,
      periodeAjaranId: "periode-2",
    })

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    // Dua baris berbeda, bukan satu baris yang ditimpa.
    expect(store.rows).toHaveLength(2)
    expect(store.rows.map((r) => r.periodeAjaranId).sort()).toEqual([
      "periode-1",
      "periode-2",
    ])
  })

  it("meng-update (bukan membuat baru) bila periode sama", async () => {
    await inputAbsensiSingle({ ...basePayload, periodeAjaranId: "periode-1" })
    const update = await inputAbsensiSingle({
      ...basePayload,
      periodeAjaranId: "periode-1",
      status: "ALPHA",
    })

    expect(update.success).toBe(true)
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0].status).toBe("ALPHA")
  })
})
