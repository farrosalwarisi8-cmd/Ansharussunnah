// src/lib/monitoring.test.ts
// Mengunci perilaku pelaporan error cache ke Sentry:
// - terkirim ke Sentry.captureMessage dengan level "warning" + extra
// - di-throttle per fingerprint operasi:key (1x per window)
// - key berbeda tidak ikut ter-throttle
// - setelah window berlalu, boleh terkirim lagi
// - error internal pelapor tidak pernah sampai ke pemanggil (fail-open)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const captureMessageMock = vi.fn()

vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...args: unknown[]) => captureMessageMock(...args),
}))

import {
  reportCacheError,
  resetCacheErrorThrottle,
} from "@/lib/monitoring"

beforeEach(() => {
  captureMessageMock.mockReset()
  resetCacheErrorThrottle()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("reportCacheError", () => {
  it("kirim event ke Sentry dengan level warning & detail key", () => {
    reportCacheError("read", "cache:ref:mapel", new Error("redis down"))

    expect(captureMessageMock).toHaveBeenCalledTimes(1)
    const [message, opts] = captureMessageMock.mock.calls[0]
    expect(message).toContain("read")
    expect(message).toContain("cache:ref:mapel")
    expect(opts.level).toBe("warning")
    expect(opts.extra.key).toBe("cache:ref:mapel")
    expect(opts.extra.error).toBe("redis down")
  })

  it("throttle event beruntun dengan fingerprint sama (1x per window)", () => {
    reportCacheError("write", "cache:ref:kelas", new Error("redis down"))
    reportCacheError("write", "cache:ref:kelas", new Error("redis down"))
    reportCacheError("write", "cache:ref:kelas", new Error("redis down"))

    expect(captureMessageMock).toHaveBeenCalledTimes(1)
  })

  it("key berbeda tidak ikut ter-throttle", () => {
    reportCacheError("read", "cache:ref:mapel", new Error("redis down"))
    reportCacheError("read", "cache:ref:kelas", new Error("redis down"))

    expect(captureMessageMock).toHaveBeenCalledTimes(2)
  })

  it("operasi berbeda pada key sama tidak ikut ter-throttle", () => {
    reportCacheError("read", "cache:ref:mapel", new Error("redis down"))
    reportCacheError("write", "cache:ref:mapel", new Error("redis down"))

    expect(captureMessageMock).toHaveBeenCalledTimes(2)
  })

  it("boleh terkirim lagi setelah window throttle berlalu", () => {
    reportCacheError("read", "cache:ref:mapel", new Error("redis down"))
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    reportCacheError("read", "cache:ref:mapel", new Error("redis down"))

    expect(captureMessageMock).toHaveBeenCalledTimes(2)
  })

  it("non-Error tetap dilaporkan dengan representasi string", () => {
    reportCacheError("invalidation", "ref:mapel", "keajaiban string")

    const [, opts] = captureMessageMock.mock.calls[0]
    expect(opts.extra.error).toBe("keajaiban string")
    expect(opts.extra.errorName).toBeUndefined()
  })

  it("fail-open: error internal pelapor tidak pernah sampai ke pemanggil", () => {
    captureMessageMock.mockImplementation(() => {
      throw new Error("sentry SDK meledak")
    })

    expect(() =>
      reportCacheError("read", "cache:ref:mapel", new Error("redis down"))
    ).not.toThrow()
  })
})
