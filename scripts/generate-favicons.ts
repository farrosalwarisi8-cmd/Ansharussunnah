import sharp from "sharp"
import fs from "fs"
import path from "path"

async function createIco(pngBuffers: Buffer[], sizes: number[]): Promise<Buffer> {
  const numImages = pngBuffers.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // ICO type
  header.writeUInt16LE(numImages, 4) // count

  let offset = 6 + numImages * 16
  const entries: Buffer[] = []
  for (let i = 0; i < numImages; i++) {
    const size = sizes[i]
    const buf = pngBuffers[i]
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // palette
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // planes
    entry.writeUInt16LE(32, 6) // bpp
    entry.writeUInt32LE(buf.length, 8) // size
    entry.writeUInt32LE(offset, 12) // offset
    entries.push(entry)
    offset += buf.length
  }
  return Buffer.concat([header, ...entries, ...pngBuffers])
}

async function main() {
  const rootDir = process.cwd()
  const sourceLogo = path.join(rootDir, "public", "anshorussunnah-logo.webp")

  if (!fs.existsSync(sourceLogo)) {
    console.error("Source logo not found at:", sourceLogo)
    process.exit(1)
  }

  console.log("Generating icon assets from:", sourceLogo)

  const sizes = [16, 32, 48, 96, 144, 180, 192, 512]
  const pngBuffers: Record<number, Buffer> = {}

  for (const size of sizes) {
    const buf = await sharp(sourceLogo)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer()
    
    pngBuffers[size] = buf

    // Write specific files to public
    fs.writeFileSync(path.join(rootDir, "public", `icon-${size}x${size}.png`), buf)
  }

  // Also write standard names
  fs.writeFileSync(path.join(rootDir, "public", "icon.png"), pngBuffers[512])
  fs.writeFileSync(path.join(rootDir, "public", "logo.png"), pngBuffers[512])
  fs.writeFileSync(path.join(rootDir, "public", "apple-touch-icon.png"), pngBuffers[180])
  fs.writeFileSync(path.join(rootDir, "public", "apple-touch-icon-precomposed.png"), pngBuffers[180])

  // Write to src/app for Next.js app router conventions
  fs.writeFileSync(path.join(rootDir, "src", "app", "icon.png"), pngBuffers[512])
  fs.writeFileSync(path.join(rootDir, "src", "app", "apple-icon.png"), pngBuffers[180])

  // Generate ICO (16, 32, 48)
  const icoBuffer = await createIco(
    [pngBuffers[16], pngBuffers[32], pngBuffers[48]],
    [16, 32, 48]
  )

  fs.writeFileSync(path.join(rootDir, "public", "favicon.ico"), icoBuffer)
  fs.writeFileSync(path.join(rootDir, "src", "app", "favicon.ico"), icoBuffer)

  // Generate site.webmanifest and manifest.json
  const manifestContent = JSON.stringify(
    {
      name: "Pesantren & Sekolah Anshorussunnah",
      short_name: "Anshorussunnah",
      description: "Platform Manajemen Pendidikan & Pembelajaran Digital Pesantren/Sekolah Anshorussunnah",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#f59e0b",
      icons: [
        {
          src: "/icon-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: "/icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    },
    null,
    2
  )

  fs.writeFileSync(path.join(rootDir, "public", "site.webmanifest"), manifestContent)
  fs.writeFileSync(path.join(rootDir, "public", "manifest.json"), manifestContent)

  console.log("Successfully generated all favicon, icon, and manifest assets!")
}

main().catch((err) => {
  console.error("Error generating favicons:", err)
  process.exit(1)
})
