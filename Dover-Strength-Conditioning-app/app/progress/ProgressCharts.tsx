"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { LIFTS } from "@/lib/calc";

type Test = { date: string; lift: string; e1RM: number };

export default function ProgressCharts({ tests }: { tests: Test[] }) {
  const byLift = Object.fromEntries(LIFTS.map((l) => [l.key, tests.filter((t) => t.lift === l.key)]));
  const hasAny = tests.length > 0;

  if (!hasAny) {
    return (
      <div className="border border-dashed border-line rounded-xl p-8 text-center text-muted">
        No tests logged yet. Log your first 5RM from the This Week tab to start your progress chart.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {LIFTS.map((l) => {
        const data = byLift[l.key];
        if (!data.length) return null;
        const latest = data[data.length - 1];
        const first = data[0];
        const delta = latest.e1RM - first.e1RM;
        return (
          <div key={l.key} className="bg-surface border border-line rounded-xl p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-base">{l.label}</h3>
              <div className="num text-lg font-semibold">
                {latest.e1RM} lb{" "}
                {data.length > 1 && (
                  <span className={delta >= 0 ? "text-good text-sm" : "text-danger text-sm"}>
                    ({delta >= 0 ? "+" : ""}
                    {delta} since first test)
                  </span>
                )}
              </div>
            </div>
            {data.length > 1 ? (
              <div className="h-40 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                      domain={["dataMin - 10", "dataMax + 10"]}
                    />
                    <Tooltip
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)" }}
                      labelStyle={{ color: "var(--fg)" }}
                    />
                    <Line type="monotone" dataKey="e1RM" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted mt-1">Log a second test to start a trend line.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
