import { useMemo, useState } from "react";
import type { DraftState } from "./types";
import type { LeaderboardResult } from "./lib/espn";
import type { LiveOdds } from "./lib/odds";
import { isComplete, toPicks } from "./lib/draft";
import { readRoomFromUrl } from "./lib/urlState";
import Tabs from "./components/Tabs";
import AnalysisTab from "./components/AnalysisTab";
import Leaderboard from "./components/Leaderboard";
import CompareTab from "./components/CompareTab";
import DraftRoom from "./components/DraftRoom";

const TABS = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "compare", label: "Compare" },
  { id: "analysis", label: "Initial Analysis" },
];

export default function App() {
  const [tab, setTab] = useState("leaderboard");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResult | null>(null);
  const [liveOdds, setLiveOdds] = useState<LiveOdds | null>(null);

  const initialCode = useMemo(() => readRoomFromUrl(), []);
  const drafted = !!draft && isComplete(draft);
  const picks = useMemo(() => (drafted ? toPicks(draft!) : null), [drafted, draft]);

  function newDraft() {
    window.history.replaceState({}, "", window.location.pathname);
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(180deg, rgba(5,12,5,0.82) 0%, rgba(8,22,8,0.6) 50%, rgba(5,12,5,0.9) 100%),
              url("/shinnecock.jpg")`,
            backgroundSize: "cover",
            backgroundPosition: "center 42%",
            filter: "saturate(0.7)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-green-950/30 to-slate-950 -z-10" />
        <div className="relative px-4 md:px-6 py-6 md:py-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight drop-shadow-lg">⛳ 2026 U.S. Open</h1>
            <p className="text-slate-300 mt-1 text-sm md:text-base drop-shadow">
              Shinnecock Hills Golf Club · Southampton, NY · June 18–21, 2026
            </p>
          </div>
          {drafted && (
            <button
              onClick={newDraft}
              className="shrink-0 px-3 py-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold"
            >
              New draft
            </button>
          )}
        </div>
      </header>

      <div className="px-4 md:px-6 py-4">
        {!drafted || !picks ? (
          <DraftRoom initialCode={initialCode} onState={setDraft} />
        ) : (
          <>
            <Tabs tabs={TABS} active={tab} onChange={setTab} />
            {tab === "analysis" && <AnalysisTab picks={picks} />}
            {tab === "leaderboard" && (
              <Leaderboard
                picks={picks}
                leaderboard={leaderboard}
                onLeaderboard={setLeaderboard}
                liveOdds={liveOdds}
                onLiveOdds={setLiveOdds}
              />
            )}
            {tab === "compare" && <CompareTab picks={picks} leaderboard={leaderboard} />}
          </>
        )}
      </div>
    </div>
  );
}
