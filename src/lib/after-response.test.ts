import { describe, it, expect, vi, afterEach } from "vitest"

const afterMock = vi.fn()
vi.mock("next/server", () => ({ after: (task: unknown) => afterMock(task) }))

import { runAfterResponse } from "@/lib/after-response"

describe("runAfterResponse", () => {
  afterEach(() => {
    afterMock.mockReset()
  })

  it("mendaftarkan task ke after() agar tetap dijalankan setelah response", () => {
    const task = vi.fn().mockResolvedValue(undefined)
    runAfterResponse(task)

    expect(afterMock).toHaveBeenCalledOnce()
    expect(afterMock).toHaveBeenCalledWith(task)
    // Task TIDAK dijalankan sinkron — itu justru tujuan dari after().
    expect(task).not.toHaveBeenCalled()
  })

  it("fallback ke void task() bila after() melempar (di luar request scope)", async () => {
    afterMock.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope.")
    })
    const task = vi.fn().mockResolvedValue(undefined)

    expect(() => runAfterResponse(task)).not.toThrow()
    expect(task).toHaveBeenCalledOnce()
  })
})
