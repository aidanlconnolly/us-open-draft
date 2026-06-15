import type { DraftState, Picks, User } from "../types";

export const TOTAL_PICKS = 12;
export const PICKS_PER_SIDE = 6;
export const MAIN_PER_SIDE = 5;

// ─── derivations (mirror api/draft.js) ──────────────────────────────────────

/** Whose turn it is, or null once the draft is complete. */
export function currentSide(state: DraftState): User | null {
  const idx = state.picks.length;
  if (idx >= TOTAL_PICKS) return null;
  const other: User = state.firstPicker === "me" ? "dad" : "me";
  return idx % 2 === 0 ? state.firstPicker : other;
}

export function isComplete(state: DraftState): boolean {
  return state.picks.length >= TOTAL_PICKS;
}

export function pickedIds(state: DraftState): Set<string> {
  return new Set(state.picks.map((p) => p.playerId));
}

export function sideCount(state: DraftState, side: User): number {
  return state.picks.filter((p) => p.side === side).length;
}

/** "main" or "darkHorse" for the next pick a given side would make. */
export function slotForNextPick(state: DraftState, side: User): "main" | "darkHorse" {
  return sideCount(state, side) >= MAIN_PER_SIDE ? "darkHorse" : "main";
}

/** Convert chronological draft picks into the { me, dad } Picks shape used by the tabs. */
export function toPicks(state: DraftState): Picks {
  const build = (side: User) => {
    const ids = state.picks.filter((p) => p.side === side).map((p) => p.playerId);
    return { main: ids.slice(0, MAIN_PER_SIDE), darkHorse: ids[MAIN_PER_SIDE] ?? "" };
  };
  return { me: build("me"), dad: build("dad") };
}

// ─── per-device identity + local cache ──────────────────────────────────────

const TOKEN_KEY = "usopen2026.token";
const sideKey = (code: string) => `usopen2026.draft.${code}.side`;
const stateKey = (code: string) => `usopen2026.draft.${code}.state`;

export function getDeviceToken(): string {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = (crypto?.randomUUID?.() ?? `t-${Date.now()}-${Math.floor(Math.random() * 1e9)}`);
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch {
    return `t-${Date.now()}`;
  }
}

export function savedSide(code: string): User | null {
  try {
    const s = localStorage.getItem(sideKey(code));
    return s === "me" || s === "dad" ? s : null;
  } catch {
    return null;
  }
}
export function saveSide(code: string, side: User) {
  try { localStorage.setItem(sideKey(code), side); } catch {}
}

function cacheState(state: DraftState) {
  try { localStorage.setItem(stateKey(state.code), JSON.stringify(state)); } catch {}
}
export function loadCachedState(code: string): DraftState | null {
  try {
    const raw = localStorage.getItem(stateKey(code));
    return raw ? (JSON.parse(raw) as DraftState) : null;
  } catch {
    return null;
  }
}

// ─── server calls ───────────────────────────────────────────────────────────

export type DraftResult =
  | { ok: true; state: DraftState }
  | { ok: false; error: string; status?: number };

/** A response only counts as a draft state if it has the expected shape. */
function isDraftState(s: any): s is DraftState {
  return (
    !!s &&
    typeof s.code === "string" &&
    Array.isArray(s.picks) &&
    !!s.claims && typeof s.claims === "object" &&
    (s.firstPicker === "me" || s.firstPicker === "dad")
  );
}

async function post(body: Record<string, unknown>): Promise<DraftResult> {
  try {
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.error ?? `http_${res.status}`, status: res.status };
    if (!isDraftState(data)) return { ok: false, error: "bad_response" };
    cacheState(data);
    return { ok: true, state: data };
  } catch (e: any) {
    return { ok: false, error: e?.name === "TimeoutError" ? "timeout" : "network" };
  }
}

export function createRoom(opts: { side: User; firstPicker: User }): Promise<DraftResult> {
  return post({ action: "create", side: opts.side, firstPicker: opts.firstPicker, token: getDeviceToken() });
}

export function joinRoom(opts: { code: string; side: User }): Promise<DraftResult> {
  return post({ action: "join", room: opts.code, side: opts.side, token: getDeviceToken() });
}

export function submitPick(opts: { code: string; side: User; playerId: string }): Promise<DraftResult> {
  return post({ action: "pick", room: opts.code, side: opts.side, playerId: opts.playerId, token: getDeviceToken() });
}

export async function fetchRoom(code: string): Promise<DraftResult> {
  try {
    const res = await fetch(`/api/draft?room=${encodeURIComponent(code)}`, {
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && isDraftState(data)) {
      cacheState(data);
      return { ok: true, state: data };
    }
    if (res.status === 404) return { ok: false, error: data?.error ?? "room_not_found", status: 404 };
    // 200-but-not-a-state (e.g. dev server / HTML error page) or other error → fall back to cache.
    const cached = loadCachedState(code);
    if (cached) return { ok: true, state: cached };
    return { ok: false, error: data?.error ?? `http_${res.status}` };
  } catch {
    const cached = loadCachedState(code);
    if (cached) return { ok: true, state: cached };
    return { ok: false, error: "network" };
  }
}
