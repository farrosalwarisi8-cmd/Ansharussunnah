// src/lib/email-provider.test.ts
//
// Menguji provider Resend mentah:
//   - konfigurasi dibaca dari env (RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO),
//   - konfigurasi hilang → gagal jelas tanpa lempar exception,
//   - hasil sukses diteruskan beserta id provider,
//   - error provider disanitasi — API key TIDAK bocor ke response/log,
//   - timeout 30 detik ditangani (proses tidak menggantung),
//   - TIDAK ada retry internal (satu kegagalan = satu panggilan provider).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const state = vi.hoisted(() => ({
  sendImpl: null as null | (() => Promise<unknown>),
  panggilan: [] as Record<string, unknown>[],
  apiKey: null as string | null,
}))

vi.mock("resend", () => ({
  Resend: class ResendMock {
    emails: { send: (payload: unknown) => Promise<unknown> }
    constructor(apiKey: string) {
      state.apiKey = apiKey
      this.emails = {
        send: (payload: unknown) => {
          state.panggilan.push(payload as Record<string, unknown>)
          if (state.sendImpl) return state.sendImpl()
          return Promise.resolve({ data: { id: "resend-id-1" }, error: null })
        },
      }
    }
  },
}))

const ENV_KEYS = ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO"] as const
const envAsli: Record<string, string | undefined> = {}

/** Muat ulang modul provider dengan env yang dikontrol (modul membaca env saat import). */
async function muatProvider(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const k of ENV_KEYS) {
    if (!(k in envAsli)) envAsli[k] = process.env[k]
    if (env[k] === undefined) delete process.env[k]
    else process.env[k] = env[k]
  }
  return await import("@/lib/email-provider")
}

const PARAM = { to: "wali@example.com", subject: "S", html: "<p>x</p>" }

beforeEach(() => {
  state.sendImpl = null
  state.panggilan = []
  state.apiKey = null
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.resetModules()
  for (const k of ENV_KEYS) {
    if (envAsli[k] === undefined) delete process.env[k]
    else process.env[k] = envAsli[k]
  }
})

describe("sendEmailViaProvider", () => {
  it("membaca API key, EMAIL_FROM, dan EMAIL_REPLY_TO dari environment variable", async () => {
    const mod = await muatProvider({
      RESEND_API_KEY: "re_test_key_1234567890",
      EMAIL_FROM: "Anshorussunnah LMS <noreply@sekolah.example>",
      EMAIL_REPLY_TO: "admin@sekolah.example",
    })

    const hasil = await mod.sendEmailViaProvider(PARAM)

    expect(state.apiKey).toBe("re_test_key_1234567890")
    expect(hasil).toEqual({ success: true, id: "resend-id-1" })
    const payload = state.panggilan[0]
    expect(payload).toMatchObject({
      from: "Anshorussunnah LMS <noreply@sekolah.example>",
      replyTo: "admin@sekolah.example",
      to: ["wali@example.com"],
      subject: "S",
      html: "<p>x</p>",
    })
  })

  it("RESEND_API_KEY belum di-set → gagal dengan pesan yang bisa ditindaklanjuti, tanpa melempar", async () => {
    const mod = await muatProvider({})

    const hasil = await mod.sendEmailViaProvider(PARAM)

    expect(hasil.success).toBe(false)
    if (!hasil.success) expect(hasil.error).toContain("RESEND_API_KEY")
    expect(state.panggilan).toHaveLength(0)
  })

  it("error provider yang memuat API key disanitasi sebelum dikembalikan", async () => {
    state.sendImpl = () =>
      Promise.resolve({
        data: null,
        error: {
          message: "API key re_test_key_1234567890 tidak valid",
          name: "validation_error",
          statusCode: 401,
        },
      })
    const mod = await muatProvider({ RESEND_API_KEY: "re_test_key_1234567890" })

    const hasil = await mod.sendEmailViaProvider(PARAM)

    expect(hasil.success).toBe(false)
    if (!hasil.success) {
      expect(hasil.error).not.toContain("re_test_key_1234567890")
      expect(hasil.error).toContain("[REDACTED]")
    }
    // Log juga tidak boleh memuat API key.
    const log = vi.mocked(console.error).mock.calls.flat().join(" ")
    expect(log).not.toContain("re_test_key_1234567890")
  })

  it("exception tak terduga → success:false dengan pesan aman (tanpa rahasia)", async () => {
    state.sendImpl = () =>
      Promise.reject(new Error("connection reset bearer re_lainnya_987654321"))
    const mod = await muatProvider({ RESEND_API_KEY: "re_test_key_1234567890" })

    const hasil = await mod.sendEmailViaProvider(PARAM)

    expect(hasil.success).toBe(false)
    if (!hasil.success) {
      expect(hasil.error).not.toContain("re_lainnya_987654321")
      expect(hasil.error.length).toBeGreaterThan(0)
    }
  })

  it("timeout 30 detik ditangani — provider yang hang tidak menggantungkan proses", async () => {
    vi.useFakeTimers()
    state.sendImpl = () => new Promise<never>(() => {})
    const mod = await muatProvider({ RESEND_API_KEY: "re_test_key_1234567890" })
    expect(mod.EMAIL_PROVIDER_TIMEOUT_MS).toBe(30_000)

    const janji = mod.sendEmailViaProvider(PARAM)
    await vi.advanceTimersByTimeAsync(31_000)
    const hasil = await janji

    expect(hasil.success).toBe(false)
    if (!hasil.success) expect(hasil.error).toContain("batas waktu")
  })

  it("tidak ada retry internal: satu kegagalan provider = satu panggilan", async () => {
    state.sendImpl = () => Promise.reject(new Error("gagal sekali"))
    const mod = await muatProvider({ RESEND_API_KEY: "re_test_key_1234567890" })

    const hasil = await mod.sendEmailViaProvider(PARAM)

    expect(hasil.success).toBe(false)
    expect(state.panggilan).toHaveLength(1)
  })

  it("sanitasiErrorProvider menghapus API key, bearer, dan nilai sensitif", async () => {
    const mod = await muatProvider({ RESEND_API_KEY: "re_test_key_1234567890" })

    const hasil = mod.sanitasiErrorProvider(
      "gagal: api_key=re_abcdef1234567890 bearer abc.def.ghi password=hunter2 token=xyz",
    )

    expect(hasil).not.toContain("re_abcdef1234567890")
    expect(hasil).not.toContain("abc.def.ghi")
    expect(hasil).not.toContain("hunter2")
    expect(hasil).not.toContain("xyz")
    expect(hasil).toContain("[REDACTED]")
  })
})
