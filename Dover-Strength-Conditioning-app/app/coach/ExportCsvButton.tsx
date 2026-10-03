"use client";

import { LIFTS } from "@/lib/calc";

type Row = {
  name: string;
  position: string;
  gradYear: number | string;
  bodyweight: number | string;
  lifts: Record<string, number>;
  acwr: number | null;
};

function csvCell(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function ExportCsvButton({ rows }: { rows: Row[] }) {
  function download() {
    const header = ["Name", "Position", "Grad Year", "Bodyweight", ...LIFTS.map((l) => l.label), "ACWR"];
    const lines = [header.map(csvCell).join(",")];
    for (const r of rows) {
      const cells = [
        r.name,
        r.position,
        r.gradYear,
        r.bodyweight,
        ...LIFTS.map((l) => (r.lifts[l.key] != null ? r.lifts[l.key] : "")),
        r.acwr != null ? Math.round(r.acwr * 100) / 100 : "",
      ];
      lines.push(cells.map(csvCell).join(","));
    }
    const csv = lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `dover-sc-roster-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="text-xs uppercase tracking-wide border border-line rounded-md px-3 py-1.5 whitespace-nowrap"
    >
      Export CSV
    </button>
  );
}
