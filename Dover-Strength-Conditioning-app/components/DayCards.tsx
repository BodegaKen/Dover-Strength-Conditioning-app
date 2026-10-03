import SetLogger from "@/app/dashboard/SetLogger";
import { dayProgress, type PlanDay } from "@/lib/plan";
import { viewOf, type LatestTest } from "@/lib/planView";
import { weekdayOf, todayISO } from "@/lib/calc";

type Row = { lift: string; setNumber: number; weight: number | null; reps: number | null; date: string; planDay: string };

// One collapsible card per plan day. Tap the day to open it. The day matching
// today's Eastern weekday opens by default, otherwise the first unfinished day.
export default function DayCards({
  days,
  rows,
  latest,
  dayNotes,
  athleteId,
}: {
  days: PlanDay[];
  rows: Row[];
  latest: Record<string, LatestTest | undefined>;
  dayNotes?: Record<string, string>;
  athleteId?: string;
}) {
  const today = weekdayOf(todayISO());
  const info = days.map((d) => {
    const dayRows = rows.filter((r) => r.planDay === d.day);
    return { d, dayRows, progress: dayProgress(d, dayRows) };
  });
  let openDay = info.find((i) => i.d.day === today)?.d.day;
  if (!openDay) openDay = info.find((i) => !i.progress.complete)?.d.day;

  return (
    <div className="flex flex-col gap-3">
      {info.map(({ d, dayRows, progress }) => {
        const latestDate = dayRows.map((r) => r.date).sort().pop();
        return (
          <details
            key={d.day}
            open={d.day === openDay}
            className="group bg-surface border border-line rounded-xl overflow-hidden"
          >
            <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none select-none">
              <span className="flex items-center gap-2">
                <span className="text-accent transition-transform group-open:rotate-90">&#9656;</span>
                <h3 className="text-base uppercase tracking-wide font-display">{d.day}</h3>
              </span>
              <span
                className={`text-xs rounded-full px-2.5 py-1 border ${
                  progress.complete
                    ? "border-good bg-good-bg text-good font-semibold"
                    : progress.started
                    ? "border-warning bg-warning-bg text-warning"
                    : "border-line text-muted"
                }`}
              >
                {progress.complete ? "Complete ✓" : `${progress.done}/${progress.total} items`}
              </span>
            </summary>
            <div className="px-4 pb-4 flex flex-col gap-3">
              {dayNotes?.[d.day] && (
                <div className="text-sm rounded-md border border-warning bg-warning-bg px-3 py-2">{dayNotes[d.day]}</div>
              )}
              <SetLogger
                planDay={d.day}
                exercises={d.exercises.map((e) => viewOf(e, latest))}
                initial={dayRows.map((r) => ({ lift: r.lift, setNumber: r.setNumber, weight: r.weight, reps: r.reps }))}
                initialDate={latestDate}
                sectionNotes={d.notes}
                athleteId={athleteId}
              />
            </div>
          </details>
        );
      })}
    </div>
  );
}
