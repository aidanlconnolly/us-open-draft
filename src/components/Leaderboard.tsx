import { useState } from "react";
import type { Picks, Player, LeaderboardRow } from "../types";
import { PLAYERS_BY_ID } from "../data/players";
import { fetchLeaderboard, parseScore, type LeaderboardResult } from "../lib/espn";
import { fetchLiveOdds, lookupOdds, formatOdds, type LiveOdds } from "../lib/odds";
import Badge from "./Badge";

function normalize(n: string) {
  return n.toLowerCase().replace(/[^a-z]/g, "");
}

function findRow(playerName: string, rows: LeaderboardResult["rows"]) {
  const last = normalize(playerName.split(" ").slice(-1)[0]);
  return rows.find((r) => {
    const q = normalize(r.name);
    return q.includes(last) || normalize(playerName).includes(q);
  }) ?? null;
}

function pickTags(name: string, picks: Picks) {
  const tags: { user: "me" | "dad"; slot: "main" | "darkHorse" }[] = [];
  const check = (id: string, user: "me" | "dad", slot: "main" | "darkHorse") => {
    const p = PLAYERS_BY_ID[id];
    if (!p) return;
    const last = normalize(p.name.split(" ").slice(-1)[0]);
    if (normalize(name).includes(last) || last === normalize(name)) {
      tags.push({ user, slot });
    }
  };
  picks.me.main.forEach((id) => check(id, "me", "main"));
  check(picks.me.darkHorse, "me", "darkHorse");
  picks.dad.main.forEach((id) => check(id, "dad", "main"));
  check(picks.dad.darkHorse, "dad", "darkHorse");
  return tags;
}

function fmtScore(n: number) {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

function TeamSummary({
  label,
  accentClass,
  borderClass,
  ids,
  rows,
  liveOdds,
}: {
  label: string;
  accentClass: string;
  borderClass: string;
  ids: string[];
  rows: LeaderboardResult["rows"];
  liveOdds: LiveOdds | null;
}) {
  const live = rows.length > 0;
  const entries = ids.map((id) => {
    const p = PLAYERS_BY_ID[id];
    if (!p) return null;
    const row = live ? findRow(p.name, rows) : null;
    return { p, row };
  }).filter(Boolean) as { p: Player; row: LeaderboardRow | null }[];

  const todayTotal = entries.reduce((s, { row }) => s + (row ? parseScore(row.today) : 0), 0);
  const tournTotal = entries.reduce((s, { row }) => s + (row ? parseScore(row.totalScore) : 0), 0);

  return (
    <div className={`rounded-lg border ${borderClass} bg-slate-900/40 p-4`}>
      <h3 className={`text-lg font-bold mb-3 ${accentClass}`}>{label}</h3>
      <table className="w-full text-sm mb-3">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-800">
            <th className="pb-1 text-left">Player</th>
            <th className="pb-1 text-right">Pre-Tourney</th>
            {liveOdds && <th className="pb-1 text-right text-yellow-400">Live Odds</th>}
            {live && <th className="pb-1 text-right">Today</th>}
            {live && <th className="pb-1 text-right">Total</th>}
            {live && <th className="pb-1 text-right">Pos</th>}
            {live && <th className="pb-1 text-right">Thru</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map(({ p, row }, i) => {
            const isDH = ids.indexOf(p.id) === 5;
            const lo = liveOdds ? lookupOdds(p.name, liveOdds) : null;
            return (
              <tr key={p.id} className="border-b border-slate-800/50">
                <td className="py-1.5">
                  {isDH && <span className="mr-1">🐴</span>}
                  {p.name}
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-400 text-xs">
                  {p.odds > 0 ? `+${p.odds.toLocaleString()}` : p.odds}
                </td>
                {liveOdds && (
                  <td className="py-1.5 text-right tabular-nums text-yellow-300 text-xs font-medium">
                    {lo !== null ? formatOdds(lo) : "—"}
                  </td>
                )}
                {live && (
                  <td className="py-1.5 text-right tabular-nums">{row?.today || "—"}</td>
                )}
                {live && (
                  <td className="py-1.5 text-right tabular-nums font-semibold">
                    {row?.totalScore || "—"}
                  </td>
                )}
                {live && (
                  <td className="py-1.5 text-right tabular-nums text-slate-400 text-xs">
                    {row?.position || "—"}
                  </td>
                )}
                {live && (
                  <td className="py-1.5 text-right tabular-nums text-slate-400 text-xs">
                    {row?.thru || "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {live && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-0.5">Today</p>
            <p className="text-xl font-bold tabular-nums">{fmtScore(todayTotal)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-0.5">Tournament</p>
            <p className="text-xl font-bold tabular-nums">{fmtScore(tournTotal)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Leaderboard({
  picks,
  leaderboard,
  onLeaderboard,
  liveOdds,
  onLiveOdds,
}: {
  picks: Picks;
  leaderboard: LeaderboardResult | null;
  onLeaderboard: (r: LeaderboardResult) => void;
  liveOdds: LiveOdds | null;
  onLiveOdds: (o: LiveOdds) => void;
}) {
  const result = leaderboard;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, odds] = await Promise.allSettled([
        fetchLeaderboard(),
        fetchLiveOdds(import.meta.env.VITE_ODDS_API_KEY ?? ""),
      ]);
      if (data.status === "fulfilled") onLeaderboard(data.value);
      else throw data.reason;
      if (odds.status === "fulfilled") onLiveOdds(odds.value);
    } catch (e: any) {
      setError(e?.message ?? "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  const allMyIds = [...picks.me.main, picks.me.darkHorse].filter(Boolean);
  const allDadIds = [...picks.dad.main, picks.dad.darkHorse].filter(Boolean);
  const live = result && result.rows.length > 0;

  return (
    <div className="space-y-6">
      {/* Refresh bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-sm font-semibold"
        >
          {loading ? "Loading…" : "Refresh Leaderboard"}
        </button>
        {result && (
          <span className="text-xs text-slate-400">
            {result.eventName}
            {result.roundDetail && (
              <span className="ml-2 px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-medium">
                {result.roundDetail}
              </span>
            )}
            {" · fetched "}
            {new Date(result.fetchedAt).toLocaleTimeString()}
          </span>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
        {!result && (
          <span className="text-slate-500 text-sm">Hit Refresh to fetch the live leaderboard.</span>
        )}
      </div>

      {/* Team summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <TeamSummary
          label="Aidan"
          accentClass="text-blue-300"
          borderClass="border-blue-800"
          ids={allMyIds}
          rows={result?.rows ?? []}
          liveOdds={liveOdds}
        />
        <TeamSummary
          label="Dad"
          accentClass="text-orange-300"
          borderClass="border-orange-800"
          ids={allDadIds}
          rows={result?.rows ?? []}
          liveOdds={liveOdds}
        />
      </div>

      {/* Full leaderboard */}
      {live && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Pos</th>
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Today</th>
                <th className="px-3 py-2 text-right">Thru</th>
                <th className="px-3 py-2 text-right" title="Odds before tournament started">Pre-Tourney Odds</th>
                <th className="px-3 py-2 text-right text-yellow-400" title="Live odds from DraftKings">Live Odds</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => {
                const tags = pickTags(row.name, picks);
                const player = Object.values(PLAYERS_BY_ID).find((p) => {
                  const last = normalize(p.name.split(" ").slice(-1)[0]);
                  return normalize(row.name).includes(last);
                });
                const lo = liveOdds ? lookupOdds(row.name, liveOdds) : null;
                return (
                  <tr
                    key={i}
                    className={`${i % 2 ? "bg-slate-900/40" : "bg-slate-950"} ${
                      tags.length ? "ring-1 ring-inset ring-slate-600" : ""
                    } hover:bg-slate-800/60`}
                  >
                    <td className="px-3 py-2 text-slate-400">{row.position}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{row.name}</span>
                        {tags.map((t, idx) => (
                          <Badge key={idx} user={t.user} slot={t.slot} />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {row.totalScore || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.today || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                      {row.thru || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400 text-xs">
                      {player ? (player.odds > 0 ? `+${player.odds.toLocaleString()}` : player.odds) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-yellow-300 text-xs font-medium">
                      {lo !== null ? formatOdds(lo) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
