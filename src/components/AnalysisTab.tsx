import { useState } from "react";
import type { Picks } from "../types";
import { PLAYERS_BY_ID } from "../data/players";
import PlayerTable from "./PlayerTable";

function PickSection({
  label,
  accentClass,
  borderClass,
  ids,
  darkHorse,
}: {
  label: string;
  accentClass: string;
  borderClass: string;
  ids: string[];
  darkHorse: string;
}) {
  // Build player list with DH appended
  const players = ids
    .map((id) => PLAYERS_BY_ID[id])
    .filter(Boolean)
    .map((p) => ({ ...p, isDarkHorse: false }));

  const dh = darkHorse ? PLAYERS_BY_ID[darkHorse] : null;
  if (dh) players.push({ ...dh, isDarkHorse: true });

  return (
    <section>
      <div className="flex items-center gap-3 mb-2">
        <h2 className={`text-xl font-bold ${accentClass}`}>{label}</h2>
        <div className={`h-px flex-1 opacity-30 ${borderClass}`} />
      </div>
      <PlayerTable players={players} />
    </section>
  );
}

export default function AnalysisTab({ picks }: { picks: Picks }) {
  const allPickedIds = new Set([
    ...picks.me.main,
    picks.me.darkHorse,
    ...picks.dad.main,
    picks.dad.darkHorse,
  ].filter(Boolean));

  // Top 20 players by odds (lowest odds = biggest favourites) not in either slate
  const notablePlayers = Object.values(PLAYERS_BY_ID)
    .filter((p) => !allPickedIds.has(p.id))
    .sort((a, b) => a.odds - b.odds)
    .slice(0, 20)
    .map((p) => ({ ...p, isDarkHorse: false }));

  const meIds = picks.me.main;
  const dadIds = picks.dad.main;

  return (
    <div className="space-y-8">
      <PickSection
        label="Aidan's Picks"
        accentClass="text-blue-300"
        borderClass="bg-blue-500"
        ids={meIds}
        darkHorse={picks.me.darkHorse}
      />

      <PickSection
        label="Dad's Picks"
        accentClass="text-orange-300"
        borderClass="bg-orange-500"
        ids={dadIds}
        darkHorse={picks.dad.darkHorse}
      />

      <section>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xl font-bold text-slate-300">Notable Players Not Added</h2>
          <div className="h-px flex-1 bg-slate-600 opacity-30" />
        </div>
        <p className="text-xs text-slate-500 mb-2">
          Top 20 players by betting odds not selected by either team.
        </p>
        <PlayerTable players={notablePlayers} />
      </section>
    </div>
  );
}
