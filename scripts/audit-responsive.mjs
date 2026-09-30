// scripts/audit-responsive.mjs
// Audit responsif halaman publik memakai Chrome headless + CDP (tanpa dependensi).
//
// Cara pakai:
//   1. jalankan dev server: npm run dev
//   2. node scripts/audit-responsive.mjs [baseURL]
//
// Memeriksa per viewport (360 / 390 / 768 / 1024 / 1440):
//   - overflow horizontal (elemen melebihi lebar viewport, di luar wadah scroll)
//   - tap target < 40px pada mobile
//   - teks < 12px
//   - bottom-nav mobile menutupi konten utama

import { spawn } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "")
const DEBUG_PORT = 9333

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean)

const PAGES = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "pendaftaran", path: "/pendaftaran" },
  { name: "cek-pendaftaran", path: "/cek-pendaftaran" },
  { name: "lupa-password", path: "/lupa-password" },
  { name: "lupa-reset", path: "/lupa-password/reset" },
  { name: "lupa-verifikasi", path: "/lupa-password/verifikasi" },
  { name: "pilih-role", path: "/pilih-role" },
  { name: "pendaftaran-sukses", path: "/pendaftaran/sukses" },
  { name: "not-found", path: "/halaman-tidak-ada" },
]

const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 640, mobile: true },
  { name: "mobile-360", width: 360, height: 780, mobile: true },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "sm-640", width: 640, height: 900, mobile: true },
  { name: "tablet-768", width: 768, height: 1024, mobile: true },
  { name: "laptop-1024", width: 1024, height: 768, mobile: false },
  { name: "desktop-1440", width: 1440, height: 900, mobile: false },
]

import { existsSync } from "node:fs"

async function waitFor(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

// --- CDP client sederhana ---------------------------------------------------
class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.listeners = new Set()
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg)
      }
    })
  }
  static connect(wsUrl) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl)
      ws.addEventListener("open", () => resolve(new Cdp(ws)), { once: true })
      ws.addEventListener("error", reject, { once: true })
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`timeout: ${method}`))
        }
      }, 60000)
    })
  }
  once(method, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(fn)
        reject(new Error(`timeout event: ${method}`))
      }, timeoutMs)
      const fn = (msg) => {
        if (msg.method === method) {
          clearTimeout(timer)
          this.listeners.delete(fn)
          resolve(msg.params)
        }
      }
      this.listeners.add(fn)
    })
  }
}

const INSPECT_EXPR = `(() => {
  const vw = document.documentElement.clientWidth;
  const contained = (el) => {
    let p = el.parentElement;
    while (p && p !== document.documentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
      p = p.parentElement;
    }
    return false;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const overflow = [];
  const smallTaps = [];
  const tinyText = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 2 && !contained(el)) {
      overflow.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 90),
        right: Math.round(r.right),
        w: Math.round(r.width),
      });
    }
    const interactive = el.matches('a, button, input, select, textarea, [role="button"], [role="tab"], [role="link"]');
    const isDecorative = !!el.closest('[aria-hidden="true"]') || el.tabIndex < 0;
    if (interactive && !isDecorative && r.height < 40 && r.width < 40 && (el.textContent || '').trim().length > 0) {
      smallTaps.push({
        tag: el.tagName.toLowerCase(),
        txt: (el.textContent || '').trim().slice(0, 30),
        cls: String(el.className || '').slice(0, 70),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const ownText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (ownText && fs < 12) {
      tinyText.push({ tag: el.tagName.toLowerCase(), fs, txt: (el.textContent || '').trim().slice(0, 30) });
    }
  }
  // bottom nav vs konten utama
  let bottomNav = null;
  const navs = document.querySelectorAll('nav, header');
  for (const n of navs) {
    const cs = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    if (cs.position === 'fixed' && (cs.bottom === '0px' || Math.abs(r.bottom - window.innerHeight) < 2)) {
      bottomNav = { h: Math.round(r.height), cls: String(n.className || '').slice(0, 60) };
    }
  }
  let mainPad = null;
  const main = document.querySelector('main');
  if (main) mainPad = Math.round(parseFloat(getComputedStyle(main).paddingBottom) || 0);
  return JSON.stringify({
    vw,
    scrollW: Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0),
    overflow: overflow.slice(0, 15),
    smallTaps: smallTaps.slice(0, 15),
    tinyText: tinyText.slice(0, 15),
    bottomNav,
    mainPad,
  });
})()`

async function main() {
  const chromePath = CHROME_CANDIDATES.map((c) => c).find((c) => c && existsSync(c))
  if (!chromePath) {
    console.error("Chrome tidak ditemukan. Set CHROME_PATH.")
    process.exit(1)
  }

  const profile = mkdtempSync(join(tmpdir(), "chrome-audit-"))
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  )

  const ok = await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/version`, 20000)
  if (!ok) {
    console.error("Chrome debugging port tidak siap.")
    chrome.kill()
    process.exit(1)
  }

  const listRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
  const targets = await listRes.json()
  const page = targets.find((t) => t.type === "page")
  const cdp = await Cdp.connect(page.webSocketDebuggerUrl)

  await cdp.send("Page.enable")
  await cdp.send("Runtime.enable")

  const report = []

  // Filter opsional: node scripts/audit-responsive.mjs <base> <page:viewport>
  const filter = process.argv[3]
  const [fPage, fVp] = filter ? filter.split(":") : [null, null]
  const pages = fPage ? PAGES.filter((p) => p.name === fPage) : PAGES
  const viewports = fVp ? VIEWPORTS.filter((v) => v.name === fVp) : VIEWPORTS

  for (const p of pages) {
    for (const vp of viewports) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile,
      })
      const loaded = cdp.once("Page.loadEventFired", 90000)
      await cdp.send("Page.navigate", { url: BASE + p.path })
      try {
        await loaded
      } catch {
        /* navigasi mungkin sudah selesai */
      }
      // beri waktu Next.js dev compile + hydrate
      await new Promise((r) => setTimeout(r, vp.width < 800 ? 3500 : 2500))
      let data = null
      try {
        const res = await cdp.send("Runtime.evaluate", {
          expression: INSPECT_EXPR,
          returnByValue: true,
        })
        data = JSON.parse(res.result.value)
      } catch (e) {
        data = { error: String(e) }
      }
      report.push({ page: p.name, path: p.path, viewport: vp.name, ...data })
      const issues = []
      if (data.scrollW > vp.width + 1) issues.push(`H-overflow scrollW=${data.scrollW}>${vp.width} (${data.overflow.length} elem)`)
      if (data.smallTaps?.length) issues.push(`tap-kecil=${data.smallTaps.length}`)
      if (data.tinyText?.length) issues.push(`teks<12px=${data.tinyText.length}`)
      if (data.bottomNav && data.mainPad !== null && data.mainPad < data.bottomNav.h) {
        issues.push(`bottomNav(${data.bottomNav.h}px)>mainPad(${data.mainPad}px)`)
      }
      console.log(
        `${p.name.padEnd(16)} ${vp.name.padEnd(12)} ${issues.length ? "ISSUE: " + issues.join(" | ") : "OK"}`
      )
    }
  }

  console.log("\n=== DETAIL ===")
  for (const r of report) {
    if (r.error) {
      console.log(`\n${r.page} @ ${r.viewport}: ERROR ${r.error}`)
      continue
    }
    const hasIssue = r.scrollW > (VIEWPORTS.find((v) => v.name === r.viewport)?.width ?? 0) + 1 ||
      r.smallTaps?.length || r.tinyText?.length ||
      (r.bottomNav && r.mainPad !== null && r.mainPad < r.bottomNav.h)
    if (!hasIssue) continue
    console.log(`\n${r.page} @ ${r.viewport} (scrollW=${r.scrollW})`)
    if (r.overflow?.length) console.log("  overflow:", JSON.stringify(r.overflow, null, 2).replace(/\n/g, "\n  "))
    if (r.smallTaps?.length) console.log("  smallTaps:", JSON.stringify(r.smallTaps))
    if (r.tinyText?.length) console.log("  tinyText:", JSON.stringify(r.tinyText))
    if (r.bottomNav && r.mainPad !== null && r.mainPad < r.bottomNav.h)
      console.log("  bottomNavOverlap:", JSON.stringify({ nav: r.bottomNav, mainPad: r.mainPad }))
  }

  try {
    const res = await cdp.send("Browser.close")
    void res
  } catch {
    chrome.kill()
  }
  setTimeout(() => {
    try {
      rmSync(profile, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    process.exit(0)
  }, 1000)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
