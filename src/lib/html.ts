// src/lib/html.ts

/**
 * Escape nilai agar aman ditulis ke dalam HTML (mis. template email).
 * Bobot: mencegah HTML/script injection lewat input pengguna (nama, email,
 * dll.) yang dikirim ke sendEmail.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Serialisasi JSON-LD aman untuk disisipkan di dalam tag <script
 * type="application/ld+json">. Karakter "</" di-escape ke "\u003c" agar nilai
 * JSON tidak bisa memutus keluar dari tag script (XSS).
 */
export function escapeHtmlJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}