// step2-tautan-ortu.mjs — uji end-to-end alur "Tautkan Orang Tua" di browser.
//
// Skenario:
//   1. Login sebagai admin (E2E_EMAIL / E2E_PASSWORD).
//   2. Buka /dashboard/siswa → baca jumlah total siswa.
//   3. Aktifkan chip filter "Tanpa Orang Tua" → jumlah harus menyusut (10).
//   4. Klik "Tautkan Ortu" di baris pertama → dialog terbuka, daftar ortu (57) termuat.
//   5. Pilih ortu → klik "Tautkan Orang Tua" → relasi tersimpan.
//   6. Verifikasi: jumlah filter berkurang 1; setelah filter dilepas, kolom
//      "Orang Tua" siswa itu menampilkan nama ortu.
//   7. Buka dialog "Lengkapi Data" (prefill) → Batal (tanpa menulis).
//
// PENTING: uji ini MENULIS 1 relasi. Jalankan snapshot sebelum & sesudah lalu
// revert-links.mjs untuk mengembalikan keadaan persis seperti semula.
//
// Pemakaian:
//   E2E_EMAIL=admin@x E2E_PASSWORD=... node scripts/e2e/step2-tautan-ortu.mjs

import {
  launch,
  connect,
  init,
  navigate,
  evalJs,
  click,
  clickText,
  typeInto,
  shot,
  sleep,
} from "./cdp.mjs"

const BASE = process.env.E2E_BASE || "http://localhost:3100"
const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error("E2E_EMAIL & E2E_PASSWORD wajib diisi.")
  process.exit(1)
}

const log = (...a) => console.log("•", ...a)
const fail = (msg) => {
  throw new Error(`GAGAL: ${msg}`)
}

async function waitFor(fn, { timeout = 30000, label = "kondisi" } = {}) {
  const start = Date.now()
  let last
  while (Date.now() - start < timeout) {
    last = await fn()
    if (last) return last
    await sleep(400)
  }
  throw new Error(`Timeout menunggu: ${label} (terakhir=${JSON.stringify(last)})`)
}

async function totalSiswa(ws) {
  const t = await evalJs(
    ws,
    `(() => { const m = document.body.innerText.match(/Daftar Siswa \((\d+) Siswa\)/); return m ? Number(m[1]) : null; })()`,
  )
  return t
}

async function jumlahBaris(ws) {
  return evalJs(ws, `document.querySelectorAll('table.data-table tbody tr').length`)
}

const chrome = await launch()
const hasil = {}
let ws

try {
  ws = await connect()
  await init(ws)

  // ---------- 1. LOGIN ----------
  log("membuka halaman login…")
  await navigate(ws, `${BASE}/login`)
  await sleep(1200)
  await typeInto(ws, "#email", EMAIL)
  await typeInto(ws, "#password", PASSWORD)
  await shot(ws, ".tmp-e2e/02-login-terisi.png")
  await clickText(ws, "Masuk ke Dashboard")
  await sleep(2500)

  await waitFor(
    async () => {
      const url = await evalJs(ws, "location.pathname")
      return url !== "/login" ? url : null
    },
    { label: "redirect setelah login" },
  )

  let url = await evalJs(ws, "location.pathname")
  log("setelah login:", url)

  // Bila diminta memilih role → pilih Super Admin.
  if (url.includes("pilih-role")) {
    log("memilih role Super Admin…")
    const ok = await evalJs(
      ws,
      `(() => {
        const els = [...document.querySelectorAll('button, a')].filter(e => e.getBoundingClientRect().width > 0);
        const el = els.find(e => /Super Admin/i.test(e.innerText));
        if (!el) return false;
        el.click();
        return true;
      })()`,
    )
    if (!ok) fail("tombol role Super Admin tidak ditemukan")
    await sleep(2500)
    url = await evalJs(ws, "location.pathname")
    log("setelah pilih role:", url)
  }
  await shot(ws, ".tmp-e2e/03-setelah-login.png")

  // ---------- 2. BUKA KELOLA SISWA ----------
  log("membuka /dashboard/siswa…")
  await navigate(ws, `${BASE}/dashboard/siswa`)
  await waitFor(async () => (await totalSiswa(ws)) !== null, {
    timeout: 60000,
    label: "daftar siswa termuat",
  })
  const totalAwal = await totalSiswa(ws)
  const barisAwal = await jumlahBaris(ws)
  hasil.totalAwal = totalAwal
  hasil.barisAwal = barisAwal
  log(`total siswa = ${totalAwal}, baris terlihat = ${barisAwal}`)
  await shot(ws, ".tmp-e2e/04-daftar-siswa.png")
  if (!totalAwal || totalAwal < 1) fail("daftar siswa kosong")

  // ---------- 3. FILTER "TANPA ORANG TUA" ----------
  log("mengaktifkan filter Tanpa Orang Tua…")
  await clickText(ws, "Tanpa Orang Tua")
  await waitFor(async () => {
    const t = await totalSiswa(ws)
    return t !== null && t < totalAwal ? t : null
  }, { label: "filter diterapkan" })
  const totalFilter = await totalSiswa(ws)
  const barisFilter = await jumlahBaris(ws)
  hasil.totalFilter = totalFilter
  hasil.barisFilter = barisFilter
  log(`filter aktif → total = ${totalFilter}, baris = ${barisFilter}`)
  await shot(ws, ".tmp-e2e/05-filter-tanpa-ortu.png")

  // Nama siswa pertama yang akan ditautkan.
  const namaSiswa = await evalJs(
    ws,
    `(() => {
      const tr = document.querySelector('table.data-table tbody tr');
      if (!tr) return null;
      return tr.children[0].innerText.split("\\n")[0].trim();
    })()`,
  )
  if (!namaSiswa) fail("tidak ada baris siswa pada filter")
  hasil.siswaDiuji = namaSiswa
  log("siswa yang ditautkan:", namaSiswa)

  // ---------- 4. BUKA DIALOG TAUTAN ----------
  await clickText(ws, "Tautkan Ortu")
  await waitFor(
    async () => evalJs(ws, `!!document.querySelector('[role="dialog"]')`),
    { label: "dialog tautan terbuka" },
  )
  await waitFor(
    async () =>
      evalJs(
        ws,
        `[...document.querySelectorAll('[role="dialog"] button')].filter(b => /\\banak\\b/.test(b.innerText)).length`,
      ),
    { label: "daftar orang tua termuat" },
  )
  const jumlahOrtu = await evalJs(
    ws,
    `[...document.querySelectorAll('[role="dialog"] button')].filter(b => /\\banak\\b/.test(b.innerText)).length`,
  )
  hasil.jumlahOrtuDiDialog = jumlahOrtu
  log(`daftar orang tua di dialog = ${jumlahOrtu}`)
  await shot(ws, ".tmp-e2e/06-dialog-tautan.png")

  // ---------- 5. PILIH ORTU + TAUTKAN ----------
  await evalJs(
    ws,
    `(() => {
      const opts = [...document.querySelectorAll('[role="dialog"] button')].filter(b => /\\banak\\b/.test(b.innerText));
      opts[0].click();
      return opts[0].innerText.split("\\n")[0].trim();
    })()`,
  ).then((namaOrtu) => {
    hasil.ortuDipilih = namaOrtu
    log("ortu dipilih:", namaOrtu)
  })
  await sleep(500)
  await shot(ws, ".tmp-e2e/07-ortu-terpilih.png")

  await clickText(ws, "Tautkan Orang Tua", '[role="dialog"] button')

  await waitFor(async () => !(await evalJs(ws, `!!document.querySelector('[role="dialog"]')`)), {
    timeout: 20000,
    label: "dialog tertutup setelah tautan",
  })
  await waitFor(async () => (await totalSiswa(ws)) === totalFilter - 1, {
    timeout: 20000,
    label: "jumlah filter berkurang 1",
  })
  hasil.totalSetelahTautan = await totalSiswa(ws)
  log(`setelah ditautkan, filter = ${hasil.totalSetelahTautan} (harus ${totalFilter - 1})`)
  await shot(ws, ".tmp-e2e/08-setelah-tautan.png")

  // ---------- 6. VERIFIKASI DI DAFTAR UTAMA ----------
  log("melepas filter…")
  await clickText(ws, "Tanpa Orang Tua")
  await waitFor(async () => (await totalSiswa(ws)) === totalAwal, {
    label: "filter dilepas",
  })

  const ortuTampil = await evalJs(
    ws,
    `(async () => {
      const q = ${JSON.stringify(namaSiswa)};
      const rows = [...document.querySelectorAll('table.data-table tbody tr')];
      // Cari lewat paginasi bila tidak di halaman pertama.
      for (let page = 1; page <= 3; page++) {
        const tr = rows.find(r => r.children[0].innerText.split("\\n")[0].trim() === q);
        if (tr) return tr.children[3].innerText.trim();
        const next = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Halaman berikutnya' || /Berikutnya/.test(b.innerText));
        if (!next) break;
        next.click();
        await new Promise(r => setTimeout(r, 1500));
      }
      return null;
    })()`,
  )
  hasil.orangTuaTampil = ortuTampil
  log('kolom "Orang Tua" →', JSON.stringify(ortuTampil))
  await shot(ws, ".tmp-e2e/09-verifikasi-ortu.png")

  if (!ortuTampil || ortuTampil === "—") fail('kolom "Orang Tua" kosong setelah tautan')

  // ---------- 7. DIALOG LENGKAPI DATA (tanpa tulis) ----------
  await clickText(ws, "Lengkapi Data")
  await waitFor(
    async () => evalJs(ws, `!!document.querySelector('[role="dialog"]')`),
    { label: "dialog lengkapi data terbuka" },
  )
  await sleep(600)
  const isiForm = await evalJs(
    ws,
    `(() => {
      const d = document.querySelector('[role="dialog"]');
      return {
        teks: d.innerText.slice(0, 400),
        adaPilihanGender: d.innerText.includes('Ikhwan') && d.innerText.includes('Akhwat'),
        tombolSimpanAktif: [...d.querySelectorAll('button')].some(b => b.innerText.includes('Simpan Data') && !b.disabled),
      };
    })()`,
  )
  hasil.formLengkapiData = isiForm
  log("dialog lengkapi data:", JSON.stringify(isiForm))
  await shot(ws, ".tmp-e2e/10-dialog-lengkapi-data.png")

  await clickText(ws, "Batal", '[role="dialog"] button')
  await sleep(600)

  hasil.status = "LULUS"
  console.log("\n=== RINGKASAN ===")
  console.log(JSON.stringify(hasil, null, 2))
} catch (err) {
  console.error("\n!!!", err.message)
  if (ws) {
    try {
      await shot(ws, ".tmp-e2e/99-error.png")
      const body = await evalJs(ws, "document.body.innerText.slice(0, 800)")
      console.error("--- halaman ---\n" + body)
    } catch {
      /* noop */
    }
  }
  process.exitCode = 1
} finally {
  if (ws) ws.close()
  chrome.kill()
}
