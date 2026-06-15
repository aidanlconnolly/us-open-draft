import type { LeaderboardRow } from "../types";

const URL =
  "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard";

export type LeaderboardResult = {
  rows: LeaderboardRow[];
  eventName: string;
  status: string;
  roundDetail: string;
  fetchedAt: number;
};

export async function fetchLeaderboard(): Promise<LeaderboardResult> {
  const res = await fetch(URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  const data = await res.json();
  const event = data?.events?.[0];
  const comp = event?.competitions?.[0];
  const competitors: any[] = comp?.competitors ?? [];

  const scoreCounts = new Map<string, number>();
  for (const c of competitors) {
    const s = c?.score ?? "";
    scoreCounts.set(s, (scoreCounts.get(s) ?? 0) + 1);
  }

  const rows: LeaderboardRow[] = competitors.map((c) => {
    const a = c?.athlete ?? {};
    const ls0 = c?.linescores?.[0];
    const totalScore: string = c?.score ?? "";
    const todayRaw: string = ls0?.displayValue ?? "";
    const today = todayRaw === "-" ? "" : todayRaw;
    const holesPlayed: number = Array.isArray(ls0?.linescores) ? ls0.linescores.length : 0;
    const order: number = c?.order ?? 0;
    const tied = (scoreCounts.get(totalScore) ?? 0) > 1;
    const position = order ? `${tied ? "T" : ""}${order}` : "";
    return {
      name: a.displayName ?? a.shortName ?? "",
      position,
      totalScore,
      today,
      thru: holesPlayed > 0 ? String(holesPlayed) : "",
      status: comp?.status?.type?.shortDetail ?? "",
    };
  });

  return {
    rows,
    eventName: event?.name ?? "",
    status: comp?.status?.type?.description ?? "",
    roundDetail: comp?.status?.type?.shortDetail ?? "",
    fetchedAt: Date.now(),
  };
}

// crude score parser: "-7" -> -7, "E" -> 0, "+3" -> 3
export function parseScore(s: string): number {
  if (!s) return 0;
  if (s === "E" || s === "EVEN") return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}
