export type Player = {
  id: string;
  name: string;
  country: string;
  odds: number;          // American odds
  sgTotal: number;
  sgApp: number;
  sgPutt: number;
  sgOtt: number;         // Strokes Gained: Off The Tee
  sgArg: number;
  last5: string[];       // most recent first
  avgDriveDistance: number; // yards
  upAndDown: number;     // percentage 0–100
  usOpen2025: string;    // 2025 U.S. Open finish (Oakmont)
};

// One drafted selection, in chronological draft order.
export type DraftPick = { side: User; playerId: string; ts: number };

// Shared draft-room state (persisted in Vercel KV, mirrored to localStorage).
export type DraftState = {
  code: string;
  firstPicker: User;
  picks: DraftPick[];
  claims: { me?: string; dad?: string }; // device tokens that own each side
  version: number;
  createdAt: number;
};

export type UserPicks = { main: string[]; darkHorse: string };
export type Picks = { me: UserPicks; dad: UserPicks };

export type LeaderboardRow = {
  name: string;
  position: string;
  totalScore: string;
  today: string;
  thru: string;
  status: string;
};

export type User = "me" | "dad";
export type Slot = "main" | "darkHorse";
