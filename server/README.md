# Solar War 2040 — Multiplayer Backend (scaffold)

A small WebSocket server that provides **lobbies + action relay** so multiple
players can share one of the game's 64 companies in the same match.

This is the first scaffold of the long-term online-multiplayer goal. It runs the
lobby authoritatively and relays gameplay; the match simulation itself is
**host-authoritative** for now (see model below).

## Run locally

```bash
cd server
npm install
npm start          # listens on :8090 (override with PORT)
```

Then in the game (`solar-war.html`) open **Multiplayer (Beta)** from the main
menu and connect to `ws://localhost:8090`.

## Model: host-authoritative relay

```
            ┌─────────── ws ───────────┐
  Player B ─┤                          ├─ Player C
            │        SERVER            │
  (action)──┼──▶ relays to HOST ◀──────┼──(action)
            │                          │
            └────────── HOST (A) ──────┘
                         │
                runs the authoritative sim,
                broadcasts {t:"state"} snapshots
```

- The server is authoritative for **lobby state**: room membership, the 4-letter
  join code, company claims (each player picks one of 64 companies), chat, match
  start, and host hand-off if the host disconnects.
- One player is the **host**. The host runs the existing client-side simulation
  and publishes `{t:"state", snapshot}` messages; the server fans them out to the
  other players. Non-host players send `{t:"action", action}`; the server relays
  them to the host, which applies and rebroadcasts.

This keeps the (large, already-working) client engine as the single source of
truth while we iterate, with a clear path to a fully server-authoritative tick.

## Wire protocol (JSON over WebSocket)

Client → Server:

| message | fields | who | meaning |
|---|---|---|---|
| `hello` | `name` | any | set display name |
| `create` | `settings{rivalCount,neutralCount}` | any | create a room, become host |
| `join` | `code`, (`name`) | any | join a room by code |
| `claim` | `company` (0–63) | any | claim a company slot |
| `chat` | `text` | in-room | lobby/in-game chat |
| `start` | — | host | begin the match |
| `action` | `action` | in-room | gameplay action (relayed to host) |
| `state` | `snapshot` | host | authoritative state snapshot (fanned out) |
| `leave` | — | in-room | leave the room |

Server → Client:

| message | fields | meaning |
|---|---|---|
| `welcome` | `id` | your assigned player id |
| `joined` | `code`, `you` | you joined/created a room |
| `room` | `room{code,hostId,started,settings,players[]}` | full room state |
| `host` | `hostId` | host changed (hand-off) |
| `chat` | `from`, `fromId`, `text` | chat line |
| `action` | `from`, `action` | a player's action (host only) |
| `state` | `snapshot` | latest authoritative snapshot |
| `start` | `room` | match started |
| `error` | `msg` | human-readable error |

## Deploy

Any Node host works. Set `PORT` from the platform env. `GET /health` returns
`{ok,rooms,ts}` for health checks. Use a `wss://` (TLS) URL in production —
terminate TLS at the platform's load balancer.

## Roadmap

1. **Lobby** — rooms, codes, company claims, chat, host hand-off. ✅
2. **Relay match** — host broadcasts full-state snapshots (~1 Hz); guests mirror
   them live and relay their whitelisted economy actions (research, trade, crypto,
   sabotage/steal/acquire, pact, set-speed, space builds) back to the host, which
   applies them. ✅ Map-placed earth/orbit builds are still host-side — networking
   placement (send the chosen cell, not the mutation) is the immediate follow-up.
3. **Per-player companies** — today a room co-operatively drives the host's
   company. Next: give each claimed company its own detailed economy so players
   compete head-to-head across the 64 slots. 🔜
4. **Server-authoritative tick** — port `rates/advance/worldTick` into `./engine`
   and run the sim here for cheat-resistance, delta snapshots, and headless/AI matches.
5. **Persistence & auth** — durable rooms + accounts (e.g. Supabase, already a
   repo dependency) for reconnection and ranked play.
