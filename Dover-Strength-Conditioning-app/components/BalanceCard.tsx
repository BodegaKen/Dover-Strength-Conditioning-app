import { RATIOS, ratioValue, isOutlier, trends, MIN_TEAM_N, OUTLIER_PCT, type E1, type TeamMedians } from "@/lib/balance";
import { LIFT_LABEL } from "@/lib/calc";

const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

// "Balance" card. Player mode shows only the player's own numbers; coach mode
// adds the team-median comparison and flags.
export default function BalanceCard({
  e1,
  bodyweight,
  tests,
  teamMedians,
}: {
  e1: E1;
  bodyweight: number | null;
  tests: { lift: string; e1RM: number; date: string }[];
  teamMedians?: TeamMedians; // present = coach view
}) {
  const coach = !!teamMedians;
  const rows = RATIOS.map((r) => ({ def: r, value: ratioValue(r, e1, bodyweight) }));
  const shown = rows.filter((r) => r.value != null);
  const tr = trends(tests);

  return (
    <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-base">Strength balance</h3>
        <p className="text-sm text-muted mt-1">
          How your tested lifts compare with each other, and how each one has changed since your first test. There is no
          &ldquo;right&rdquo; ratio to hit &mdash; I couldn&rsquo;t find a validated standard for high-school football players &mdash; so
          this just shows your own numbers. If one lift is growing much slower than the others, that&rsquo;s the one to talk
          to your coach about.
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted">Log a few test maxes (and your bodyweight) to see your ratios.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {shown.map(({ def, value }) => {
            const med = teamMedians?.[def.key];
            const flag = coach && value != null ? isOutlier(value, med) : null;
            return (
              <div
                key={def.key}
                className={`rounded-md border px-3 py-2 ${flag ? "border-warning bg-warning-bg" : "border-line"}`}
              >
                <div className="text-xs uppercase tracking-wide text-muted">{def.label}</div>
                <div className="num text-lg font-semibold">{fmt(value as number)}</div>
                <div className="text-xs text-muted">{def.hint}</div>
                {coach && med && (
                  <div className="text-xs mt-1">
                    Team median {fmt(med.median)} (n={med.n})
                    {flag && (
                      <span className="text-warning font-semibold">
                        {" "}
                        &middot; {flag === "high" ? "well above" : "well below"} team
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tr.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted font-semibold mb-1">Change since first test</div>
          <ul className="flex flex-col gap-1">
            {tr
              .slice()
              .sort((a, b) => a.pct - b.pct)
              .map((t) => (
                <li key={t.lift} className="flex items-baseline gap-2 text-sm">
                  <span className="flex-1">{LIFT_LABEL[t.lift] ?? t.lift}</span>
                  <span className="num text-muted">
                    {t.first} &rarr; {t.latest} lb
                  </span>
                  <span className={`num font-semibold w-16 text-right ${t.pct >= 0 ? "text-good" : "text-danger"}`}>
                    {t.pct >= 0 ? "+" : ""}
                    {Math.round(t.pct * 10) / 10}%
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {coach && (
        <p className="text-xs text-muted border-t border-line pt-2">
          Coach view. Flags mean a ratio is {Math.round(OUTLIER_PCT * 100)}%+ away from this team&rsquo;s own median (needs{" "}
          {MIN_TEAM_N}+ athletes with data). That is a conversation starter, not a diagnosis, and the cutoff is my own choice,
          not a published standard. The one published marker in the program&rsquo;s research is Case, Knudson &amp; Downey (2020,
          J Strength Cond Res): in 71 Division I athletes, back squat below about 2.2&times; bodyweight (men) was linked to
          more lower-body injuries &mdash; adult college athletes, 1RM not e1RM, so treat it cautiously for high-schoolers.
        </p>
      )}
    </div>
  );
}
