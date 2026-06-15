export type LiveOdds = Record<string, number>; // player name → American odds

const SPORT_KEY = "golf_pga_championship_winner";
const PREFERRED_BOOKS = ["draftkings", "fanduel", "williamhill_us", "betmgm", "bovada"];

export async function fetchLiveOdds(apiKey: string): Promise<LiveOdds> {
  if (!apiKey) throw new Error("No odds API key configured");
  const url = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds?apiKey=${apiKey}&regions=us&markets=outrights&oddsFormat=american`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Odds API ${res.status}`);
  const events: any[] = await res.json();
  const event = events[0];
  if (!event) return {};

  const bookmakers: any[] = event.bookmakers ?? [];
  const bm =
    PREFERRED_BOOKS.reduce<any>((found, key) => found ?? bookmakers.find((b) => b.key === key) ?? null, null) ??
    bookmakers[0];
  if (!bm) return {};

  const market = bm.markets?.find((m: any) => m.key === "outrights");
  if (!market) return {};

  const result: LiveOdds = {};
  for (const outcome of market.outcomes ?? []) {
    if (typeof outcome.name === "string" && typeof outcome.price === "number") {
      result[outcome.name] = outcome.price;
    }
  }
  return result;
}

export function formatOdds(n: number): string {
  return n > 0 ? `+${n.toLocaleString()}` : `${n}`;
}

function normalizeName(n: string) {
  return n.toLowerCase().replace(/[^a-z]/g, "");
}

export function lookupOdds(playerName: string, odds: LiveOdds): number | null {
  if (odds[playerName] !== undefined) return odds[playerName];
  const lastName = normalizeName(playerName.split(" ").slice(-1)[0]);
  for (const [name, val] of Object.entries(odds)) {
    if (normalizeName(name).includes(lastName)) return val;
  }
  return null;
}
