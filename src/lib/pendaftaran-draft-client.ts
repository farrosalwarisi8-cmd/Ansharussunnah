// src/lib/pendaftaran-draft-client.ts
"use client"

// Lapisan 1 (lokal) dari draft pendaftaran hybrid.
//
// localStorage menyimpan perubahan SEGERA (dengan debounce di pemanggil) supaya
// data tetap ada saat refresh/tab ditutup. Isinya HANYA data teks form + step +
// metadata: file binary TIDAK PERNAH masuk ke sini (File tidak bisa
// diserialisasi; metadata nama/ukuran disimpan sebagai penanda, bukan isinya).
//
// Versi schema (DRAFT_SCHEMA_VERSION) dipisah agar perubahan bentuk form di
// masa depan bisa memigrasi/membuang draft lama tanpa merusak halaman.

const KEY = "pdaf-draft:v1"
export const DRAFT_SCHEMA_VERSION = 1

export type LocalDraft = {
  version: number
  draftId: string
  resumeToken: string | null
  lastStep: number
  formValues: Record<string, string>
  // Metadata file terpilih — HANYA nama+ukuran untuk menandai "sebelumnya ada
  // file di sini". File-nya sendiri tidak disimpan; saat restore, field ini
  // menampilkan status "Berkas perlu dipilih ulang".
  fileMeta: {
    kartuKeluarga?: { nama: string; ukuran: number } | null
    akteLahir?: { nama: string; ukuran: number } | null
    foto?: { nama: string; ukuran: number } | null
  }
  lastSavedAt: string
}

function baca(): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LocalDraft
    if (parsed?.version !== DRAFT_SCHEMA_VERSION) {
      // Versi lama tidak dikenal — buang, jangan coba menebak bentuknya.
      window.localStorage.removeItem(KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function simpan(draft: LocalDraft): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    // localStorage penuh / mode privat — draft lokal tidak tersedia; server
    // draft (lapisan 2) tetap menutupi kasus ini.
  }
}

export function bacaDraftLokal(): LocalDraft | null {
  if (typeof window === "undefined") return null
  return baca()
}

export function simpanDraftLokal(input: {
  draftId: string
  resumeToken: string | null
  lastStep: number
  formValues: Record<string, string>
  fileMeta: LocalDraft["fileMeta"]
}): LocalDraft {
  const draft: LocalDraft = {
    version: DRAFT_SCHEMA_VERSION,
    draftId: input.draftId,
    resumeToken: input.resumeToken,
    lastStep: input.lastStep,
    formValues: input.formValues,
    fileMeta: input.fileMeta,
    lastSavedAt: new Date().toISOString(),
  }
  simpan(draft)
  return draft
}

export function hapusDraftLokal(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // diabaikan
  }
}

/**
 * Bandingkan draft lokal vs server: mana yang lebih baru.
 * Mengembalikan "lokal" | "server" | null (tidak bisa dibandingkan).
 */
export function draftLebihBaru(
  lokal: LocalDraft,
  server: { updatedAt: string }
): "lokal" | "server" | null {
  const tLokal = Date.parse(lokal.lastSavedAt)
  const tServer = Date.parse(server.updatedAt)
  if (Number.isNaN(tLokal) || Number.isNaN(tServer)) return null
  return tLokal >= tServer ? "lokal" : "server"
}
