import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const ADMIN_EMAIL = 'farrosalwarisi8@gmail.com'
const ADMIN_AUTH_ID = '4f090888-1afc-4768-bcd1-2d662d485882'

// Ambil semua siswa yang pendaftarannya DITERIMA dengan email orang tua = admin
const pdfts = await prisma.pendaftaran.findMany({
  where: { status: 'DITERIMA', emailOrangTua: ADMIN_EMAIL },
  select: { id: true, nomorPendaftaran: true, namaOrangTua: true, noHpOrangTua: true, alamatOrangTua: true, alamatSiswa: true },
})

const siswas = await prisma.siswa.findMany({
  where: { pendaftaranId: { in: pdfts.map(p => p.id) } },
  select: { id: true, userId: true, pendaftaranId: true },
})

console.log('Pendaftaran DITERIMA:', pdfts.map(p => `${p.nomorPendaftaran} (${p.namaOrangTua})`))
console.log('Siswa terkait:', siswas.map(s => `${s.id} <= ${s.pendaftaranId}`))

// Cek apakah sudah ada ORANG_TUA utk authId ini
let ortuUser = await prisma.user.findFirst({
  where: { authId: ADMIN_AUTH_ID, role: 'ORANG_TUA' },
})
console.log('ORANG_TUA existing:', ortuUser ? ortuUser.id : '(none)')

if (!ortuUser) {
  const lastP = pdfts[pdfts.length - 1]
  ortuUser = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      nama: lastP.namaOrangTua,
      role: 'ORANG_TUA',
      authId: ADMIN_AUTH_ID,
      aktif: true,
      mustChangePassword: false,
    },
  })
  console.log('Created ORANG_TUA user:', ortuUser.id)
}

let ot = await prisma.orangTua.findUnique({ where: { userId: ortuUser.id } })
if (!ot) {
  const lastP = pdfts[pdfts.length - 1]
  ot = await prisma.orangTua.create({
    data: {
      userId: ortuUser.id,
      noHp: lastP.noHpOrangTua,
      alamat: lastP.alamatOrangTua || lastP.alamatSiswa,
    },
  })
  console.log('Created OrangTua:', ot.id)
}

// Buat relasi ke semua siswa DITERIMA
for (const s of siswas) {
  const existing = await prisma.parentStudent.findUnique({
    where: { orangTuaId_siswaId: { orangTuaId: ot.id, siswaId: s.id } },
  })
  if (!existing) {
    await prisma.parentStudent.create({
      data: { orangTuaId: ot.id, siswaId: s.id, hubungan: 'Orang Tua' },
    })
    console.log('Linked ParentStudent:', s.id)
  } else {
    console.log('Already linked:', s.id)
  }
}

console.log('DONE')
await prisma.$disconnect()
