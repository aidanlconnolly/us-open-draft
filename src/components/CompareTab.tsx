import type { Picks } from "../types";
import { PLAYERS_BY_ID } from "../data/players";
import type { LeaderboardResult } from "../lib/espn";
import { parseScore } from "../lib/espn";

function findRow(name: string, rows: LeaderboardResult["rows"] | undefined) {
  if (!rows || rows.length === 0) return null;
  const normalize = (n: string) => n.toLowerCase().replace(/[^a-z]/g, "");
  const last = name.split(" ").slice(-1)[0];
  return (
    rows.find((r) => {
      const q = normalize(r.name);
      return q.includes(normalize(last)) || normalize(name).includes(q);
    }) ?? null
  );
}

function fmtScore(s: string | null | undefined) {
  if (!s) return "—";
  return s;
}
function fmtOdds(n: number) {
  return n > 0 ? `+${n.toLocaleString()}` : `${n}`;
}
function fmtSg(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

function avgOdds(ids: string[]): number {
  const valid = ids.map((id) => PLAYERS_BY_ID[id]?.odds).filter((o): o is number => o != null);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export default function CompareTab({
  picks,
  leaderboard,
}: {
  picks: Picks;
  leaderboard: LeaderboardResult | null;
}) {
  const meIds = [...picks.me.main, picks.me.darkHorse].filter(Boolean);
  const dadIds = [...picks.dad.main, picks.dad.darkHorse].filter(Boolean);

  const meTotal = meIds.reduce((s, id) => {
    const p = PLAYERS_BY_ID[id];
    if (!p) return s;
    const row = findRow(p.name, leaderboard?.rows);
    return s + (row ? parseScore(row.totalScore) : 0);
  }, 0);
  const dadTotal = dadIds.reduce((s, id) => {
    const p = PLAYERS_BY_ID[id];
    if (!p) return s;
    const row = findRow(p.name, leaderboard?.rows);
    return s + (row ? parseScore(row.totalScore) : 0);
  }, 0);

  const meAvgSg = meIds.reduce((s, id) => s + (PLAYERS_BY_ID[id]?.sgTotal ?? 0), 0) / (meIds.length || 1);
  const dadAvgSg = dadIds.reduce((s, id) => s + (PLAYERS_BY_ID[id]?.sgTotal ?? 0), 0) / (dadIds.length || 1);
  const meAvgOdds = avgOdds(meIds);
  const dadAvgOdds = avgOdds(dadIds);

  const live = leaderboard && leaderboard.rows.length > 0;

  // Edge = SG advantage; lower tournament score = leading (golf scoring)
  const sgEdgeMe = meAvgSg - dadAvgSg;
  const liveEdgeMe = live ? dadTotal - meTotal : null; // positive = me leading

  return (
    <div className="space-y-6">
      {/* Head-to-head summary */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h4 className="text-sm font-semibold text-slate-400 mb-4">Head-to-Head</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-sm">

          {/* SG:Total avg */}
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Avg SG:Total</p>
            <div className="flex justify-between px-4">
              <span className={`text-lg font-bold ${meAvgSg >= dadAvgSg ? "text-blue-300" : "text-slate-400"}`}>
                {meAvgSg.toFixed(2)}
              </span>
              <span className={`text-lg font-bold ${dadAvgSg >= meAvgSg ? "text-orange-300" : "text-slate-400"}`}>
                {dadAvgSg.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              SG edge: <span className={sgEdgeMe >= 0 ? "text-blue-300" : "text-orange-300"}>
                {sgEdgeMe >= 0 ? "Aidan" : "Dad"} +{Math.abs(sgEdgeMe).toFixed(2)}
              </span>
            </p>
          </div>

          {/* Avg odds */}
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Avg Odds</p>
            <div className="flex justify-between px-4">
              <span className={`text-lg font-bold ${meAvgOdds <= dadAvgOdds ? "text-blue-300" : "text-slate-400"}`}>
                {fmtOdds(meAvgOdds)}
              </span>
              <span className={`text-lg font-bold ${dadAvgOdds <= meAvgOdds ? "text-orange-300" : "text-slate-400"}`}>
                {fmtOdds(dadAvgOdds)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Odds edge: <span className={meAvgOdds <= dadAvgOdds ? "text-blue-300" : "text-orange-300"}>
                {meAvgOdds <= dadAvgOdds ? "Aidan" : "Dad"} (shorter odds)
              </span>
            </p>
          </div>

          {/* Tournament score */}
          <div className="space-y-1">
            <p className="text-xs text-slate-500">{live ? "Tournament Score" : "Pre-tourney edge"}</p>
            {live ? (
              <>
                <div className="flex justify-between px-4">
                  <span className={`text-lg font-bold ${meTotal <= dadTotal ? "text-blue-300" : "text-slate-400"}`}>
                    {meTotal === 0 ? "E" : meTotal > 0 ? `+${meTotal}` : meTotal}
                  </span>
                  <span className={`text-lg font-bold ${dadTotal <= meTotal ? "text-orange-300" : "text-slate-400"}`}>
                    {dadTotal === 0 ? "E" : dadTotal > 0 ? `+${dadTotal}` : dadTotal}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Leading: <span className="text-yellow-300 font-semibold">
                    {liveEdgeMe! > 0 ? `Aidan by ${liveEdgeMe}` : liveEdgeMe! < 0 ? `Dad by ${Math.abs(liveEdgeMe!)}` : "Tied"}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-yellow-300 font-semibold text-center mt-2">
                {sgEdgeMe >= 0 ? "Aidan" : "Dad"}
              </p>
            )}
          </div>
        </div>

        {/* Labels */}
        <div className="flex justify-between px-4 mt-3 text-xs text-slate-500 border-t border-slate-800 pt-2">
          <span className="text-blue-400 font-semibold">Aidan</span>
          <span className="text-orange-400 font-semibold">Dad</span>
        </div>
      </div>

      {/* Side-by-side picks */}
      <div className="grid md:grid-cols-2 gap-4">
        <UserColumn user="me" ids={meIds} dhId={picks.me.darkHorse} leaderboard={leaderboard} label="Aidan" />
        <UserColumn user="dad" ids={dadIds} dhId={picks.dad.darkHorse} leaderboard={leaderboard} label="Dad" />
      </div>
    </div>
  );
}

function UserColumn({
  user,
  ids,
  dhId,
  leaderboard,
  label,
}: {
  user: "me" | "dad";
  ids: string[];
  dhId: string;
  leaderboard: LeaderboardResult | null;
  label: string;
}) {
  const accent = user === "me" ? "text-blue-300" : "text-orange-300";
  const border = user === "me" ? "border-blue-800" : "border-orange-800";
  const live = leaderboard && leaderboard.rows.length > 0;

  return (
    <div className={`rounded-lg border ${border} bg-slate-900/40 p-4`}>
      <h3 className={`text-lg font-bold mb-3 ${accent}`}>{label}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-800">
            <th className="pb-2 text-left">#</th>
            <th className="pb-2 text-left">Player</th>
            <th className="pb-2 text-right">Odds</th>
            <th className="pb-2 text-right">SG</th>
            {live && <th className="pb-2 text-right">Score</th>}
            {live && <th className="pb-2 text-right">Pos</th>}
          </tr>
        </thead>
        <tbody>
          {ids.map((id, i) => {
            const p = PLAYERS_BY_ID[id];
            const row = p ? findRow(p.name, leaderboard?.rows) : null;
            const isDH = id === dhId;
            return (
              <tr key={id} className="border-b border-slate-800/50">
                <td className="py-2 text-slate-500 text-xs">{isDH ? "🐴" : i + 1}</td>
                <td className="py-2">
                  {isDH && <span className="text-slate-400 text-xs mr-1">DH:</span>}
                  {p?.name ?? id}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-400 text-xs">
                  {p ? fmtOdds(p.odds) : "—"}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-400">
                  {p ? fmtSg(p.sgTotal) : "—"}
                </td>
                {live && (
                  <td className="py-2 text-right tabular-nums font-semibold">
                    {fmtScore(row?.totalScore)}
                  </td>
                )}
                {live && (
                  <td className="py-2 text-right tabular-nums text-slate-400">
                    {row?.position ?? "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
