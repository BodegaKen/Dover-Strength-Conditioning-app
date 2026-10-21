import { phase0Week } from "@/lib/phase0";

// Display-only Phase 0 week: one collapsible card per session day, laid out like the Phase 1 day cards
// (sections with the exercises listed) but with nothing to log.
export default function Phase0Days({ week, audience }: { week: number; audience?: string }) {
  const w = phase0Week(week);
  if (!w) return null;
  const today = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-1.5">
        <div className="text-xs uppercase tracking-wide text-muted font-semibold">
          Phase 0 &middot; {w.label} &middot; {w.title}
        </div>
        <div className="text-xs text-muted">
          {w.dates}. {audience ? `This is what ${audience} sees. ` : ""}Display-only: nothing to log. Sessions are optional.
        </div>
        {w.note && <p className="text-sm">{w.note}</p>}
        {w.days.length === 0 && <p className="text-sm font-semibold">No sessions this week. Move around, sleep, eat.</p>}
      </div>

      {w.days.map((d, di) => (
        <details
          key={d.day}
          open={d.day.endsWith(today) || (di === 0 && !w.days.some((x) => x.day.endsWith(today)))}
          className="group bg-surface border border-line rounded-xl overflow-hidden"
        >
          <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none select-none">
            <span className="flex items-center gap-2">
              <span className="text-accent transition-transform group-open:rotate-90">&#9656;</span>
              <h3 className="text-base uppercase tracking-wide font-display">{d.day}</h3>
            </span>
            <span className="text-xs rounded-full px-2.5 py-1 border border-line text-muted">Optional</span>
          </summary>
          <div className="px-4 pb-4 flex flex-col gap-4">
            {d.blocks.map((b, bi) => (
              <div key={bi} className="flex flex-col gap-1.5">
                <div className="text-xs uppercase tracking-wide font-semibold text-accent">{b.heading}</div>
                {b.intro && <p className="text-sm text-muted">{b.intro}</p>}
                <ul className="flex flex-col divide-y divide-line border border-line rounded-lg">
                  {b.items.map((it, ii) => (
                    <li key={ii} className="px-3 py-2 text-sm">
                      <span className="font-semibold">{it.name}</span>
                      {it.detail && <span className="text-muted"> &mdash; {it.detail}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ))}

      {w.footer && (
        <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-2 text-sm text-muted">
          {w.footer.map((f, i) => (
            <p key={i}>{f}</p>
          ))}
        </div>
      )}
    </div>
  );
}
