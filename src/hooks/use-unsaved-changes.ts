// src/hooks/use-unsaved-changes.ts
//
// Peringatan "perubahan belum disimpan" untuk form yang sedang diedit.
// `dirty` true => pengguna diperingatkan sebelum menutup tab / meninggalkan
// halaman (beforeunload). Murni lapisan UX — tidak memengaruhi alur simpan.

"use client"

import * as React from "react"

export function useUnsavedChangesWarning(dirty: boolean, message?: string) {
  const text = React.useRef(
    message || "Perubahan belum disimpan. Tinggalkan halaman ini?"
  )

  React.useEffect(() => {
    if (!dirty) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Nilai returnValue wajib diset agar browser menampilkan dialog bawaan.
      e.returnValue = text.current
      return text.current
    }

    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])
}
