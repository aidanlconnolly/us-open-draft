import type { User, Slot } from "../types";

export function pickColor(user: User): string {
  return user === "me" ? "bg-blue-600 text-white" : "bg-orange-500 text-white";
}

export function pickBorder(user: User): string {
  return user === "me" ? "border-l-4 border-blue-500" : "border-l-4 border-orange-500";
}

export default function Badge({
  user,
  slot,
  label,
}: {
  user: User;
  slot?: Slot;
  label?: string;
}) {
  const color = pickColor(user);
  const striped = slot === "darkHorse"
    ? "ring-2 ring-offset-1 ring-offset-slate-900 ring-yellow-400"
    : "";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${color} ${striped}`}
    >
      {label ?? (user === "me" ? "Me" : "Dad")}
      {slot === "darkHorse" ? " 🐴" : ""}
    </span>
  );
}
