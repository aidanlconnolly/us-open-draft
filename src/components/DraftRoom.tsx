import { useCallback, useEffect, useState } from "react";
import type { DraftState, User } from "../types";
import { PLAYERS, PLAYERS_BY_ID } from "../data/players";
import {
  createRoom, joinRoom, submitPick, fetchRoom,
  currentSide, isComplete, pickedIds, slotForNextPick, sideCount,
  savedSide, saveSide, MAIN_PER_SIDE, PICKS_PER_SIDE,
} from "../lib/draft";
import { writeRoomToUrl, roomShareUrl } from "../lib/urlState";
import PlayerTable from "./PlayerTable";

const sideName = (s: User) => (s === "me" ? "Aidan" : "Dad");
const sideAccent = (s: User) => (s === "me" ? "text-blue-300" : "text-orange-300");
const sideBorder = (s: User) => (s === "me" ? "border-blue-700" : "border-orange-700");

export default function DraftRoom({
  initialCode,
  onState,
}: {
  initialCode: string | null;
  onState: (s: DraftState) => void;
}) {
  const [state, setState] = useState<DraftState | null>(null);
  const [side, setSide] = useState<User | null>(null);
  const [phase, setPhase] = useState<"setup" | "join" | "draft">(initialCode ? "join" : "setup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup-form state
  const [createSide, setCreateSide] = useState<User>("me");
  const [firstPicker, setFirstPicker] = useState<User>("me");
  const [joinCode, setJoinCode] = useState(initialCode ?? "");
  const [copied, setCopied] = useState(false);

  const apply = useCallback((s: DraftState) => {
    setState(s);
    onState(s);
  }, [onState]);

  // Arriving via a shared link: load the room so we can show which side is open.
  useEffect(() => {
    if (!initialCode) return;
    let cancelled = false;
    (async () => {
      const r = await fetchRoom(initialCode);
      if (cancelled) return;
      if (r.ok) {
        apply(r.state);
        const mine = savedSide(initialCode);
        if (mine) { setSide(mine); setPhase("draft"); }
      } else if (r.error === "room_not_found") {
        setError(`No draft found for code ${initialCode}. Create a new one below.`);
        setPhase("setup");
      } else {
        setError("Couldn't reach the draft server. Check your connection.");
      }
    })();
    return () => { cancelled = true; };
  }, [initialCode, apply]);

  // Live polling while drafting. Depend only on the room code (stable) so the
  // interval isn't torn down/rebuilt on every poll; self-clear on completion.
  const code = state?.code ?? null;
  useEffect(() => {
    if (phase !== "draft" || !code) return;
    const id = window.setInterval(async () => {
      const r = await fetchRoom(code);
      if (r.ok) {
        apply(r.state);
        if (isComplete(r.state)) window.clearInterval(id);
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [phase, code, apply]);

  async function handleCreate() {
    setBusy(true); setError(null);
    const r = await createRoom({ side: createSide, firstPicker });
    setBusy(false);
    if (r.ok) {
      saveSide(r.state.code, createSide);
      writeRoomToUrl(r.state.code);
      setSide(createSide);
      apply(r.state);
      setPhase("draft");
    } else {
      setError(r.error === "network" || r.error === "timeout"
        ? "Couldn't reach the draft server (is Vercel KV configured?)."
        : `Create failed: ${r.error}`);
    }
  }

  async function handleJoin(chosen: User) {
    const code = (state?.code ?? joinCode).toUpperCase();
    if (!code) { setError("Enter a draft code."); return; }
    setBusy(true); setError(null);
    const r = await joinRoom({ code, side: chosen });
    setBusy(false);
    if (r.ok) {
      saveSide(code, chosen);
      writeRoomToUrl(code);
      setSide(chosen);
      apply(r.state);
      setPhase("draft");
    } else if (r.error === "side_taken") {
      setError(`${sideName(chosen)} is already taken on another device.`);
    } else if (r.error === "same_device") {
      setError("This device already joined as the other side.");
    } else if (r.error === "room_not_found") {
      setError(`No draft found for code ${code}.`);
    } else if (r.error === "busy") {
      setError("Server's busy — try again.");
    } else {
      setError(`Join failed: ${r.error}`);
    }
  }

  async function handleLookup() {
    const code = joinCode.toUpperCase();
    if (!code) { setError("Enter a draft code."); return; }
    setBusy(true); setError(null);
    const r = await fetchRoom(code);
    setBusy(false);
    if (r.ok) {
      apply(r.state);
      const mine = savedSide(code);
      if (mine) { setSide(mine); writeRoomToUrl(code); setPhase("draft"); }
    } else {
      setError(r.error === "room_not_found" ? `No draft found for code ${code}.` : "Couldn't reach the server.");
    }
  }

  async function handlePick(playerId: string) {
    if (!state || !side) return;
    setBusy(true); setError(null);
    const r = await submitPick({ code: state.code, side, playerId });
    setBusy(false);
    if (r.ok) {
      apply(r.state);
    } else {
      // Likely a race (opponent picked first / not your turn) — refresh to resync.
      const fresh = await fetchRoom(state.code);
      if (fresh.ok) apply(fresh.state);
      setError(r.error === "already_picked" ? "That player was just taken — pick another."
        : r.error === "not_your_turn" ? "Not your turn yet."
        : r.error === "busy" ? "Someone else just picked — try again."
        : `Pick failed: ${r.error}`);
    }
  }

  function copyShare() {
    if (!state) return;
    const url = roomShareUrl(state.code);
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  // ── SETUP ──────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card title="Start a new draft">
          <Field label="You are">
            <SideToggle value={createSide} onChange={setCreateSide} />
          </Field>
          <Field label="First pick">
            <SideToggle value={firstPicker} onChange={setFirstPicker} />
          </Field>
          <button
            onClick={handleCreate}
            disabled={busy}
            className="w-full mt-2 px-4 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-semibold"
          >
            {busy ? "Creating…" : "Create draft"}
          </button>
        </Card>

        <Card title="Join an existing draft">
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              maxLength={4}
              className="flex-1 px-3 py-2 rounded bg-slate-800 border border-slate-700 uppercase tracking-widest font-mono"
            />
            <button
              onClick={handleLookup}
              disabled={busy}
              className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 font-semibold"
            >
              Find
            </button>
          </div>
        </Card>
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      </div>
    );
  }

  // ── JOIN (room loaded, pick an open side) ─────────────────────────────────
  if (phase === "join" || (phase === "draft" && !side)) {
    const taken = state?.claims ?? {};
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card title={state ? `Join draft ${state.code}` : "Join draft"}>
          {!state && (
            <div className="flex gap-2 mb-4">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={4}
                className="flex-1 px-3 py-2 rounded bg-slate-800 border border-slate-700 uppercase tracking-widest font-mono"
              />
              <button onClick={handleLookup} disabled={busy}
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 font-semibold">Find</button>
            </div>
          )}
          {state && (
            <>
              <p className="text-sm text-slate-400 mb-3">Pick your side:</p>
              <div className="grid grid-cols-2 gap-3">
                {(["me", "dad"] as User[]).map((s) => {
                  const isTaken = !!taken[s];
                  return (
                    <button
                      key={s}
                      onClick={() => handleJoin(s)}
                      disabled={busy || isTaken}
                      className={`px-4 py-3 rounded border ${sideBorder(s)} bg-slate-900 hover:bg-slate-800 disabled:opacity-40 font-semibold ${sideAccent(s)}`}
                    >
                      {sideName(s)}{isTaken ? " (taken)" : ""}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                First pick: <span className={sideAccent(state.firstPicker)}>{sideName(state.firstPicker)}</span>
              </p>
            </>
          )}
        </Card>
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      </div>
    );
  }

  // ── DRAFT BOARD ──────────────────────────────────────────────────────────
  if (!state || !side) return null;
  const turn = currentSide(state);
  const complete = isComplete(state);
  const yourTurn = turn === side && !complete;
  const picked = pickedIds(state);
  const available = PLAYERS.filter((p) => !picked.has(p.id));
  const nextSlot = turn ? slotForNextPick(state, turn) : "main";

  return (
    <div className="space-y-5">
      {/* Room bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-slate-400">
          Draft code: <span className="font-mono font-bold text-slate-100 tracking-widest">{state.code}</span>
        </span>
        <button onClick={copyShare} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs font-semibold">
          {copied ? "Copied!" : "Share link"}
        </button>
        <span className="text-xs text-slate-500">You are <span className={sideAccent(side)}>{sideName(side)}</span></span>
      </div>

      {/* Turn banner */}
      <div className={`rounded-lg px-4 py-3 text-center font-semibold ${
        complete ? "bg-emerald-900/50 text-emerald-200"
        : yourTurn ? "bg-emerald-700/40 text-emerald-100 ring-1 ring-emerald-500"
        : "bg-slate-800/70 text-slate-300"
      }`}>
        {complete
          ? "🏁 Draft complete! Loading the tracker…"
          : yourTurn
            ? `🎯 You're up — pick your ${nextSlot === "darkHorse" ? "🐴 dark horse" : "main player"} (${sideCount(state, side) + 1} of ${PICKS_PER_SIDE})`
            : `⏳ Waiting on ${sideName(turn!)} to pick…`}
      </div>

      {/* Team boards */}
      <div className="grid md:grid-cols-2 gap-4">
        {(["me", "dad"] as User[]).map((s) => (
          <TeamBoard key={s} side={s} state={state} highlight={turn === s && !complete} />
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Available pool */}
      {!complete && (
        <section>
          <h3 className="text-lg font-bold text-slate-200 mb-2">
            Available players <span className="text-sm text-slate-500">({available.length})</span>
          </h3>
          <PlayerTable players={available} onDraft={handlePick} canDraft={yourTurn && !busy} />
        </section>
      )}
    </div>
  );
}

function TeamBoard({ side, state, highlight }: { side: User; state: DraftState; highlight: boolean }) {
  const ids = state.picks.filter((p) => p.side === side).map((p) => p.playerId);
  const slots = Array.from({ length: PICKS_PER_SIDE }, (_, i) => ids[i] ?? null);
  return (
    <div className={`rounded-lg border ${sideBorder(side)} bg-slate-900/40 p-4 ${highlight ? "ring-2 ring-offset-2 ring-offset-slate-950 " + (side === "me" ? "ring-blue-500" : "ring-orange-500") : ""}`}>
      <h3 className={`text-lg font-bold mb-3 ${sideAccent(side)}`}>{sideName(side)}</h3>
      <ol className="space-y-1.5">
        {slots.map((id, i) => {
          const isDH = i === MAIN_PER_SIDE;
          const p = id ? PLAYERS_BY_ID[id] : null;
          return (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-slate-500 text-xs">{isDH ? "🐴" : i + 1}</span>
              {p ? (
                <span>
                  {isDH && <span className="text-slate-400 text-xs mr-1">DH:</span>}
                  {p.name} <span className="text-slate-500 text-xs">{p.country} · {p.odds > 0 ? `+${p.odds.toLocaleString()}` : p.odds}</span>
                </span>
              ) : (
                <span className="text-slate-600 italic">{isDH ? "dark horse" : "empty"}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs text-slate-400 mb-1.5 uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

function SideToggle({ value, onChange }: { value: User; onChange: (s: User) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["me", "dad"] as User[]).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`px-4 py-2 rounded border font-semibold ${
            value === s
              ? `${sideBorder(s)} bg-slate-800 ${sideAccent(s)}`
              : "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800"
          }`}
        >
          {sideName(s)}
        </button>
      ))}
    </div>
  );
}
