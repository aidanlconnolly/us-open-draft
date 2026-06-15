// Vercel Node serverless function — shared U.S. Open draft room backed by Vercel KV.
//
// GET  /api/draft?room=CODE              -> draft state (404 if room missing)
// POST /api/draft  { action, room, side, token, playerId?, firstPicker? }
//   action "create" -> make a new room, claim `side`, return state (+ generated code)
//   action "join"   -> claim an unclaimed `side` with `token`
//   action "pick"   -> validate turn/ownership/availability, append a pick
//
// Straight-alternating draft: 12 total picks (6 per side); each side's 6th pick is its
// dark horse. No auth beyond a per-device `token` that owns a side — friend-group toy.

import { kv } from '@vercel/kv';

const SIDES = ['me', 'dad'];
const TOTAL_PICKS = 12;
const PICKS_PER_SIDE = 6;
const roomKey = (code) => `draft:room:${code}`;

function sanitizeId(s) {
  // player ids are lowercase slugs (e.g. "scottie-scheffler")
  return String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48);
}
function sanitizeCode(s) {
  // room codes are uppercase alnum (e.g. "AB3K") — must NOT strip uppercase letters
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}
function sanitizeToken(s) {
  return String(s || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
}
function genCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let out = '';
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// Whose turn it is given the picks made so far (null once complete).
function currentSide(state) {
  const idx = state.picks.length;
  if (idx >= TOTAL_PICKS) return null;
  const other = state.firstPicker === 'me' ? 'dad' : 'me';
  return idx % 2 === 0 ? state.firstPicker : other;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Read-modify-write a room under a short-lived KV lock so concurrent join/pick
// writes can't clobber each other (@vercel/kv has no transactions). `mutate`
// receives the FRESH state and returns { state } or { error, status }.
async function lockedUpdate(code, mutate) {
  const lockKey = `draft:lock:${code}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const got = await kv.set(lockKey, '1', { nx: true, ex: 5 });
    if (got) {
      try {
        const fresh = await kv.get(roomKey(code));
        if (!fresh) return { error: 'room_not_found', status: 404 };
        const result = mutate(fresh);
        if (result.error) return result;
        await kv.set(roomKey(code), result.state);
        return { state: result.state };
      } finally {
        await kv.del(lockKey);
      }
    }
    await sleep(100);
  }
  return { error: 'busy', status: 409 };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const code = sanitizeCode(req.query.room);
      if (!code) return res.status(400).json({ error: 'room_required' });
      const state = await kv.get(roomKey(code));
      if (!state) return res.status(404).json({ error: 'room_not_found' });
      return res.status(200).json(state);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const action = String(body.action || '');
      const side = SIDES.includes(body.side) ? body.side : null;
      const token = sanitizeToken(body.token);
      if (!token) return res.status(400).json({ error: 'token_required' });
      if (!side) return res.status(400).json({ error: 'side_required' });

      const other = side === 'me' ? 'dad' : 'me';

      if (action === 'create') {
        const firstPicker = SIDES.includes(body.firstPicker) ? body.firstPicker : 'me';
        let code = sanitizeCode(body.room);
        if (code) {
          // explicit code: never clobber an existing room
          if (await kv.get(roomKey(code))) return res.status(409).json({ error: 'room_exists' });
        } else {
          for (let i = 0; i < 8; i++) {
            const c = genCode();
            if (!(await kv.get(roomKey(c)))) { code = c; break; }
          }
          if (!code) return res.status(503).json({ error: 'try_again' });
        }
        const state = {
          code,
          firstPicker,
          picks: [],
          claims: { [side]: token },
          version: 1,
          createdAt: Date.now(),
        };
        await kv.set(roomKey(code), state);
        return res.status(200).json(state);
      }

      const code = sanitizeCode(body.room);
      if (!code) return res.status(400).json({ error: 'room_required' });

      if (action === 'join') {
        const r = await lockedUpdate(code, (state) => {
          const owner = state.claims[side];
          if (owner && owner !== token) return { error: 'side_taken', status: 409 };
          if (state.claims[other] === token) return { error: 'same_device', status: 409 };
          state.claims[side] = token;
          state.version += 1;
          return { state };
        });
        if (r.error) return res.status(r.status || 500).json({ error: r.error });
        return res.status(200).json(r.state);
      }

      if (action === 'pick') {
        const playerId = sanitizeId(body.playerId);
        if (!playerId) return res.status(400).json({ error: 'player_required' });
        const r = await lockedUpdate(code, (state) => {
          if (state.claims[side] !== token) return { error: 'not_your_side', status: 403 };
          if (state.picks.length >= TOTAL_PICKS) return { error: 'draft_complete', status: 409 };
          if (currentSide(state) !== side) return { error: 'not_your_turn', status: 409 };
          if (state.picks.some((p) => p.playerId === playerId)) return { error: 'already_picked', status: 409 };
          if (state.picks.filter((p) => p.side === side).length >= PICKS_PER_SIDE) {
            return { error: 'side_full', status: 409 };
          }
          state.picks.push({ side, playerId, ts: Date.now() });
          state.version += 1;
          return { state };
        });
        if (r.error) return res.status(r.status || 500).json({ error: r.error });
        return res.status(200).json(r.state);
      }

      return res.status(400).json({ error: 'unknown_action' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (err) {
    return res.status(500).json({ error: 'kv_unavailable', message: String((err && err.message) || err) });
  }
}
