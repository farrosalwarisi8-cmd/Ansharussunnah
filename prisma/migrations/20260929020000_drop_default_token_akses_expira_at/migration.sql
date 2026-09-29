-- Buang DEFAULT dari `token_akses_expira_at`.
--
-- Latar: default ini muncul lewat migration 20260928000000 sebagai jaring
-- pengaman, tapi bertentangan dengan prinsip fail-closed yang dipakai seluruh
-- alur token. `isTokenAksesBelumKedaluwarsa(null)` mengembalikan FALSE,
-- artinya NULL dianggap KEDALUWARSA. Jadi:
--
--   - Dengan DEFAULT: insert yang lupa mengisinya diam-diam mendapat 90 hari
--     akses. Kesalahan tidak ketahuan.
--   - Tanpa DEFAULT: insert yang lupa mengisinya dapat NULL → langsung
--     kedaluwarsa. Kesalahan ketahuan, dan memang itu yang diinginkan —
--     masa berlaku yang terlewat hanya memperpendek masa berlaku,
--     bukan memperpanjang.
--
-- `createPendaftaran` selalu mengirim nilainya secara eksplisit
-- (`hitungTokenAksesExpiraAt()`), jadi tidak ada jalur yang bergantung pada
-- default ini. Backfill untuk baris lama sudah dilakukan di migration yang
-- menambah kolomnya.
--
-- Menyisakan satu alasan lain: dengan default dihapus, `migrate diff` antara
-- schema dan database menjadi nol, jadi `migrate dev` tidak lagi mengusulkan
-- perubahan yang tidak diminta — termasuk yang bisa menghapus index.

ALTER TABLE "pendaftarans"
  ALTER COLUMN "token_akses_expira_at" DROP DEFAULT;
