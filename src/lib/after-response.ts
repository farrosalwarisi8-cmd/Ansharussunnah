// src/lib/after-response.ts

import { after } from "next/server"

/**
 * Jalankan tugas SETELAH response request selesai dikirim, tanpa memperlambat
 * dan tanpa manslaughter request.
 *
 * Kenapa tidak cukup `void someAsync()`: di Vercel (serverless), instance
 * lambda boleh langsung "dibekukan"/dimatikan begitu response terkirim.
 * Promise yang masih berjalan tanpa ditunggu akan dibuang — email, analytics,
 * atau logging bisa hilang tanpa error. `after()` dari Next.js membuat runtime
 * menahan instance tetap hidup sampai task selesai, jadi email tetap terkirim
 * walau response sudah sampai ke pengguna.
 *
 * `after()` melempar error bila dipanggil di luar request scope (mis. unit
 * test atau script CLI), karena itu dibungkus try/catch dan jatuh ke
 * `void task()` — perilakunya sama dengan pola lama di konteks tersebut.
 */
export function runAfterResponse(task: () => Promise<unknown>): void {
  try {
    after(task)
  } catch {
    void task()
  }
}
