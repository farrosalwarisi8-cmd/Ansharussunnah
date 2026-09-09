"use client"

// TargetGenderSelector
// Pilihan target gender konten akademik (tugas/ujian/materi):
// null = Semua (campuran), LAKI_LAKI = khusus Ikhwan, PEREMPUAN = khusus Akhwat.

interface TargetGenderSelectorProps {
  value: "LAKI_LAKI" | "PEREMPUAN" | null
  onChange: (value: "LAKI_LAKI" | "PEREMPUAN" | null) => void
  disabled?: boolean
  id?: string
}

export function TargetGenderSelector({
  value,
  onChange,
  disabled = false,
  id,
}: TargetGenderSelectorProps) {
  const selectClass =
    "h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-yellow-500"

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
        Target Gender
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value
          onChange(
            v === "LAKI_LAKI" || v === "PEREMPUAN" ? v : null
          )
        }}
        className={selectClass}
        disabled={disabled}
      >
        <option value="">Semua (Ikhwan &amp; Akhwat)</option>
        <option value="LAKI_LAKI">Khusus Ikhwan (Laki-laki)</option>
        <option value="PEREMPUAN">Khusus Akhwat (Perempuan)</option>
      </select>
      <p className="text-xs text-slate-400">
        Kosongkan untuk seluruh siswa di kelas ini, atau batasi hanya ke gender tertentu.
      </p>
    </div>
  )
}