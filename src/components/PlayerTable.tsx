import { useMemo, useState } from "react";
import type { Player } from "../types";
import { compare, type SortDir } from "../lib/sort";
import { avgPosition } from "../data/players";

type ExtPlayer = Player & { isDarkHorse?: boolean };

type ColKey = keyof Player | "avgPos";

type Col = {
  key: ColKey;
  label: string;
  title?: string;
  numeric?: boolean;
  className?: string;
};

const COLS: Col[] = [
  { key: "name", label: "Player" },
  { key: "odds", label: "Odds", numeric: true, className: "text-right" },
  { key: "sgTotal", label: "SG:Total", title: "Strokes Gained: Total", numeric: true, className: "text-right" },
  { key: "sgApp", label: "SG:App", title: "Strokes Gained: Approach", numeric: true, className: "text-right" },
  { key: "sgPutt", label: "SG:Putt", title: "Strokes Gained: Putting", numeric: true, className: "text-right" },
  { key: "sgOtt", label: "SG:Off Tee", title: "Strokes Gained: Off The Tee", numeric: true, className: "text-right" },
  { key: "avgDriveDistance", label: "Avg Drive", title: "Average Drive Distance (yards)", numeric: true, className: "text-right" },
  { key: "upAndDown", label: "Up&Down%", title: "Up & Down Percentage", numeric: true, className: "text-right" },
  { key: "last5", label: "Last 5" },
  { key: "avgPos", label: "Avg Pos", title: "Average finish position over last 5 starts (MC=70)", numeric: true, className: "text-right" },
  { key: "usOpen2025", label: "2025 U.S. Open", title: "2025 U.S. Open result at Oakmont" },
];

function fmtOdds(n: number): string {
  return n > 0 ? `+${n.toLocaleString()}` : `${n}`;
}
function fmtSg(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

const finishColor = (r: string) => {
  if (!r || r === "MC" || r === "WD") return "text-red-400";
  const n = parseInt(r.replace(/^T/, ""), 10);
  if (n === 1) return "text-yellow-300 font-bold";
  if (n <= 5) return "text-emerald-400";
  if (n <= 10) return "text-blue-300";
  if (n <= 20) return "text-slate-300";
  return "text-slate-500";
};

export default function PlayerTable({
  players,
  onDraft,
  canDraft = false,
}: {
  players: ExtPlayer[];
  onDraft?: (id: string) => void;
  canDraft?: boolean;
}) {
  const [sortKey, setSortKey] = useState<ColKey>("sgTotal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const withAvg = players.map((p) => ({ ...p, _avgPos: avgPosition(p.last5) }));
    withAvg.sort((a, b) => {
      if (sortKey === "last5") return 0;
      if (sortKey === "avgPos") return compare(a._avgPos, b._avgPos, sortDir);
      return compare(a[sortKey as keyof Player] as any, b[sortKey as keyof Player] as any, sortDir);
    });
    return withAvg;
  }, [players, sortKey, sortDir]);

  const onHeader = (key: ColKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : key === "avgPos" || key === "odds" ? "asc" : "desc");
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 sticky top-0">
          <tr>
            {onDraft && <th className="px-3 py-2 text-left font-semibold"></th>}
            {COLS.map((c) => (
              <th
                key={String(c.key)}
                title={c.title}
                onClick={() => onHeader(c.key)}
                className={`px-3 py-2 text-left font-semibold cursor-pointer select-none whitespace-nowrap hover:bg-slate-800 ${c.className ?? ""}`}
              >
                {c.label}
                {sortKey === c.key && (
                  <span className="ml-1 text-slate-400">{sortDir === "asc" ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr
              key={p.id}
              className={`${i % 2 ? "bg-slate-900/40" : "bg-slate-950"} hover:bg-slate-800/60`}
            >
              {onDraft && (
                <td className="px-3 py-2">
                  <button
                    onClick={() => onDraft(p.id)}
                    disabled={!canDraft}
                    className="px-3 py-1 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white whitespace-nowrap"
                  >
                    Draft
                  </button>
                </td>
              )}
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span>
                    {p.isDarkHorse ? (
                      <span>
                        <span className="text-yellow-400 mr-1">🐴</span>
                        <span className="text-slate-400 text-xs mr-1">DH:</span>
                        {p.name}
                      </span>
                    ) : (
                      p.name
                    )}
                  </span>
                  <span className="text-xs text-slate-500">{p.country}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtOdds(p.odds)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtSg(p.sgTotal)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtSg(p.sgApp)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtSg(p.sgPutt)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtSg(p.sgOtt)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{p.avgDriveDistance} yds</td>
              <td className="px-3 py-2 text-right tabular-nums">{p.upAndDown.toFixed(1)}%</td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  {p.last5.map((r, idx) => (
                    <span key={idx} className={`text-xs ${finishColor(r)}`}>{r}</span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{p._avgPos}</td>
              <td className={`px-3 py-2 text-center font-semibold ${finishColor(p.usOpen2025)}`}>
                {p.usOpen2025}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
