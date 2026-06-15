// Draft rooms are shared via a ?room=CODE query param so a link opens straight into the draft.

export function readRoomFromUrl(): string | null {
  const r = new URLSearchParams(window.location.search).get("room");
  return r ? r.toUpperCase() : null;
}

export function writeRoomToUrl(code: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("room", code);
  window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
}

export function roomShareUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}?room=${code}`;
}
