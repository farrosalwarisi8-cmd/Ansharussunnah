// src/lib/cache.test.ts
// Mengunci perilaku lapisan cache Redis (Upstash):
// - hit: dibalas dari cache, fetcher (DB) tidak dipanggil
// - miss: fetcher dijalankan lalu hasilnya disimpan dengan TTL
// - nilai null yang sah ikut di-cache
// - FAIL-OPEN: error Redis / env kosong → langsung pakai fetcher (DB)
// - invalidateCache menghapus semua key dengan prefix terkait

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cachedJson, invalidateCache } from "@/lib/cache"

const setMock = vi.fn()
const getMock = vi.fn()
const delMock = vi.fn()
const keysMock = vi.fn()

vi.mock("@upstash/redis", () => ({
  Redis: class {
    set = setMock
    get = getMock
    del = delMock
    keys = keysMock
  },
}))

beforeEach(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io")
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "secret")
  setMock.mockReset()
  getMock.mockReset()
  delMock.mockReset()
  keysMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("cachedJson", () => {
  it("kembalikan data dari cache saat hit (fetcher tidak dipanggil)", async () => {
    getMock.mockResolvedValue(JSON.stringify([{ id: "mapel-1" }]))
    const fetcher = vi.fn()
    const result = await cachedJson("ref:mapel", 60, fetcher)
    expect(result).toEqual([{ id: "mapel-1" }])
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("jalankan fetcher dan simpan hasil dengan TTL saat miss", async () => {
    getMock.mockResolvedValue(null)
    const result = await cachedJson("ref:mapel", 300, async () => [{ id: "b" }])
    expect(result).toEqual([{ id: "b" }])
    expect(setMock).toHaveBeenCalledWith("cache:ref:mapel", JSON.stringify([{ id: "b" }]), { ex: 300 })
  })

  it("cache nilai null yang sah (mis. belum ada periode aktif)", async () => {
    getMock.mockResolvedValue(JSON.stringify(null))
    const fetcher = vi.fn(async () => null)
    const result = await cachedJson("ref:periode:aktif", 60, fetcher)
    expect(result).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("fail-open saat Redis error di read", async () => {
    getMock.mockRejectedValue(new Error("redis down"))
    const result = await cachedJson("ref:mapel", 60, async () => [{ id: "c" }])
    expect(result).toEqual([{ id: "c" }])
  })

  it("fail-open & tidak menyentuh Redis saat env kosong", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "")
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "")
    vi.resetModules()
    const fresh = await import("@/lib/cache")
    const result = await fresh.cachedJson("ref:mapel", 60, async () => [{ id: "d" }])
    expect(result).toEqual([{ id: "d" }])
    expect(getMock).not.toHaveBeenCalled()
    expect(setMock).not.toHaveBeenCalled()
  })

  it("sanitasi key dinamis dari klien (cegah key injection)", async () => {
    getMock.mockResolvedValue(JSON.stringify("data"))
    const maliciousKey = "ref:kelas:byjenjang:abc/../periode:* def"
    await cachedJson(maliciousKey, 60, async () => "data")
    expect(getMock).toHaveBeenCalledWith("cache:ref:kelas:byjenjang:abc..periode:def")
    expect(setMock).not.toHaveBeenCalled()
  })
})

describe("invalidateCache", () => {
  it("hapus semua key yang cocok dengan prefix", async () => {
    keysMock.mockResolvedValue(["cache:ref:mapel:admin", "cache:ref:mapel"])
    await invalidateCache("ref:mapel")
    expect(delMock).toHaveBeenCalledWith("cache:ref:mapel:admin", "cache:ref:mapel")
  })

  it("tidak memanggil del saat tidak ada key cocok", async () => {
    keysMock.mockResolvedValue([])
    await invalidateCache("ref:mapel")
    expect(delMock).not.toHaveBeenCalled()
  })

  it("fail-open saat Redis error (tidak melempar error)", async () => {
    keysMock.mockRejectedValue(new Error("redis down"))
    await expect(invalidateCache("ref:mapel")).resolves.toBeUndefined()
  })
})