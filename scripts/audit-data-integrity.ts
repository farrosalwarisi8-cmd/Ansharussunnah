import * as fs from "fs";
import prisma from "../src/lib/prisma";

function loadEnvFile(file: string) {
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // file not found; ignore silently
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const HEALTHY = "HEALTHY" as const;
const REPAIRABLE = "REPAIRABLE" as const;
const REQUIRES_REVIEW = "REQUIRES_REVIEW" as const;
const BLOCKED = "BLOCKED" as const;
type AuditStatus = typeof HEALTHY | typeof REPAIRABLE | typeof REQUIRES_REVIEW | typeof BLOCKED;

type QueryRowCount = { count: bigint };

type CheckResult = {
  name: string;
  status: AuditStatus;
  count: number;
  sample: unknown[];
  details: string[];
  safeToRepair: boolean;
};

function asCount(value: QueryRowCount[] | undefined, fallback = 0): number {
  const raw = value?.[0]?.count;
  if (typeof raw === "bigint") return Number(raw);
  if (typeof raw === "number") return raw;
  return fallback;
}

function statusFor(count: number, safeToRepair: boolean, reviewRequired = false): AuditStatus {
  if (count === 0) return HEALTHY;
  if (reviewRequired) return REQUIRES_REVIEW;
  if (safeToRepair) return REPAIRABLE;
  return REQUIRES_REVIEW;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log(JSON.stringify({
      status: BLOCKED,
      message: "DATABASE_URL not configured",
      checks: [],
    }, null, 2));
    return;
  }

  const checks: CheckResult[] = [];

  try {
    const userSiswaTanpaSiswa = await prisma.$queryRaw<QueryRowCount[]>`
      SELECT COUNT(*)::bigint AS count
      FROM users u
      LEFT JOIN siswas s ON s.user_id = u.id
      WHERE u.role = 'SISWA'
        AND u.deleted_at IS NULL
        AND (s.id IS NULL OR s.deleted_at IS NOT NULL)
    `;

    const userSiswaTanpaSiswaRows = await prisma.$queryRaw<Array<{
      id: string;
      nama: string | null;
      email: string | null;
      auth_id: string | null;
      deleted_at: Date | null;
    }>>`
      SELECT u.id, u.nama, u.email, u.auth_id, u.deleted_at
      FROM users u
      LEFT JOIN siswas s ON s.user_id = u.id
      WHERE u.role = 'SISWA'
        AND u.deleted_at IS NULL
        AND (s.id IS NULL OR s.deleted_at IS NOT NULL)
      ORDER BY u.created_at DESC
      LIMIT 10
    `;

    const siswaTanpaUser = await prisma.$queryRaw<QueryRowCount[]>`
      SELECT COUNT(*)::bigint AS count
      FROM siswas s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.deleted_at IS NULL AND u.id IS NULL
    `;

    const pendaftaranDiterimaTanpaSiswa = await prisma.$queryRaw<QueryRowCount[]>`
      SELECT COUNT(*)::bigint AS count
      FROM pendaftarans p
      LEFT JOIN siswas s ON s.pendaftaran_id = p.id
      WHERE p.status = 'DITERIMA'
        AND p.deleted_at IS NULL
        AND (s.id IS NULL OR s.deleted_at IS NOT NULL)
    `;

    const pendaftaranDiterimaTanpaSiswaRows = await prisma.$queryRaw<Array<{
      id: string;
      nomor_pendaftaran: string | null;
      nama_lengkap: string | null;
      status: string | null;
    }>>`
      SELECT p.id, p.nomor_pendaftaran, p.nama_lengkap, p.status
      FROM pendaftarans p
      LEFT JOIN siswas s ON s.pendaftaran_id = p.id
      WHERE p.status = 'DITERIMA'
        AND p.deleted_at IS NULL
        AND (s.id IS NULL OR s.deleted_at IS NOT NULL)
      ORDER BY p.created_at DESC
      LIMIT 10
    `;

    const userIdConflict = await prisma.$queryRaw<QueryRowCount[]>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT user_id
        FROM siswas
        WHERE user_id IS NOT NULL
        GROUP BY user_id
        HAVING COUNT(*) > 1
      ) x
    `;

    const pendaftaranIdConflict = await prisma.$queryRaw<QueryRowCount[]>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT pendaftaran_id
        FROM siswas
        WHERE pendaftaran_id IS NOT NULL
        GROUP BY pendaftaran_id
        HAVING COUNT(*) > 1
      ) x
    `;

    const duplicateEmailJenjang = await prisma.$queryRaw<QueryRowCount[]>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT LOWER(TRIM(email_orang_tua)) AS email_norm, jenjang_tujuan_id, COUNT(*)
        FROM pendaftarans
        WHERE deleted_at IS NULL
          AND status IN ('MENUNGGU_PEMBAYARAN', 'MENUNGGU_VERIFIKASI', 'SEDANG_DIPROSES')
        GROUP BY LOWER(TRIM(email_orang_tua)), jenjang_tujuan_id
        HAVING COUNT(*) > 1
      ) x
    `;

    const NISNConflict = await prisma.$queryRaw<QueryRowCount[]>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT nisn
        FROM siswas
        WHERE nisn IS NOT NULL
        GROUP BY nisn
        HAVING COUNT(*) > 1
      ) x
    `;

    const NISConflict = await prisma.$queryRaw<QueryRowCount[]>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT nis
        FROM siswas
        WHERE nis IS NOT NULL
        GROUP BY nis
        HAVING COUNT(*) > 1
      ) x
    `;

    const ortuTanpaProfil = await prisma.$queryRaw<QueryRowCount[]>`
      SELECT COUNT(*)::bigint AS count
      FROM users u
      LEFT JOIN orang_tuas o ON o.user_id = u.id
      WHERE u.role = 'ORANG_TUA'
        AND u.deleted_at IS NULL
        AND (o.id IS NULL OR o.deleted_at IS NOT NULL)
    `;

    const parentStudentBroken = await prisma.$queryRaw<QueryRowCount[]>`
      SELECT COUNT(*)::bigint AS count
      FROM parent_students ps
      LEFT JOIN orang_tuas o ON o.id = ps.orang_tua_id
      LEFT JOIN siswas s ON s.id = ps.siswa_id
      WHERE o.id IS NULL OR s.id IS NULL
    `;

    checks.push(
      {
        name: "User SISWA tanpa row Siswa aktif",
        status: statusFor(asCount(userSiswaTanpaSiswa), true),
        count: asCount(userSiswaTanpaSiswa),
        sample: userSiswaTanpaSiswaRows,
        details: [
          "User yang berrole SISWA tapi tidak punya siswa aktif atau null.",
          "Ini bisa diperbaiki secara additive dengan repair admin atau restore row yang cocok.",
        ],
        safeToRepair: true,
      },
      {
        name: "Siswa aktif tanpa user",
        status: statusFor(asCount(siswaTanpaUser), true),
        count: asCount(siswaTanpaUser),
        sample: [],
        details: [
          "Row siswa aktif tanpa user terkait.",
          "Perlu review untuk mencegah relasi salah atau data setengah.",
        ],
        safeToRepair: true,
      },
      {
        name: "Pendaftaran DITERIMA tanpa Siswa aktif",
        status: statusFor(asCount(pendaftaranDiterimaTanpaSiswa), true),
        count: asCount(pendaftaranDiterimaTanpaSiswa),
        sample: pendaftaranDiterimaTanpaSiswaRows,
        details: [
          "Pendaftaran sudah diterima namun tidak punya row siswa aktif.",
          "Direpair hanya bila identitas kandidat jelas dan valid.",
        ],
        safeToRepair: true,
      },
      {
        name: "Konflik userId siswa",
        status: statusFor(asCount(userIdConflict), false, asCount(userIdConflict) > 0),
        count: asCount(userIdConflict),
        sample: [],
        details: [
          "Satu user dipetakan ke lebih dari satu row siswa.",
          "Ini membutuhkan review, bukan hanya create/drop otomatis.",
        ],
        safeToRepair: false,
      },
      {
        name: "Konflik pendaftaranId siswa",
        status: statusFor(asCount(pendaftaranIdConflict), false, asCount(pendaftaranIdConflict) > 0),
        count: asCount(pendaftaranIdConflict),
        sample: [],
        details: [
          "Satu pendaftaran dipetakan ke lebih dari satu row siswa.",
          "Ambigu dan harus ditinjau admin.",
        ],
        safeToRepair: false,
      },
      {
        name: "Pendaftaran aktif duplikat email + jenjang",
        status: statusFor(asCount(duplicateEmailJenjang), false, asCount(duplicateEmailJenjang) > 0),
        count: asCount(duplicateEmailJenjang),
        sample: [],
        details: [
          "Duplication pada emailOrangTua + jenjang tujuan dapat mengindikasikan multiple submission atau stale draft.",
          "Perlu review untuk mencegah pendaftaran ganda yang ilegal.",
        ],
        safeToRepair: false,
      },
      {
        name: "Konflik NISN",
        status: statusFor(asCount(NISNConflict), false, asCount(NISNConflict) > 0),
        count: asCount(NISNConflict),
        sample: [],
        details: [
          "NISN dipakai lebih dari satu orang.",
          "Aman hanya jika identitas benar-benar jelas; default review.",
        ],
        safeToRepair: false,
      },
      {
        name: "Konflik NIS",
        status: statusFor(asCount(NISConflict), false, asCount(NISConflict) > 0),
        count: asCount(NISConflict),
        sample: [],
        details: [
          "NIS dipakai lebih dari satu siswa.",
          "Harus ditinjau dengan audit data lengkap.",
        ],
        safeToRepair: false,
      },
      {
        name: "User ORANG_TUA tanpa profil aktif",
        status: statusFor(asCount(ortuTanpaProfil), true),
        count: asCount(ortuTanpaProfil),
        sample: [],
        details: [
          "User wali aktif tanpa profil orang tua yang valid.",
          "Bisa diperbaiki secara additive bila identitas jelas.",
        ],
        safeToRepair: true,
      },
      {
        name: "Relasi ParentStudent bermasalah",
        status: statusFor(asCount(parentStudentBroken), false, asCount(parentStudentBroken) > 0),
        count: asCount(parentStudentBroken),
        sample: [],
        details: [
          "Relasi parent-student merujuk ke record yang tidak ada.",
          "Perlu review untuk menghindari orphan relation.",
        ],
        safeToRepair: true,
      },
    );

    const overallStatus: AuditStatus = checks.some((check) => check.status === REQUIRES_REVIEW || check.status === BLOCKED)
      ? (checks.some((check) => check.status === BLOCKED) ? BLOCKED : REQUIRES_REVIEW)
      : checks.some((check) => check.status === REPAIRABLE)
        ? REPAIRABLE
        : HEALTHY;

    console.log(JSON.stringify({
      status: overallStatus,
      generatedAt: new Date().toISOString(),
      checks,
    }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      status: BLOCKED,
      message: error instanceof Error ? error.message : "Database audit failed",
      checks: [],
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
