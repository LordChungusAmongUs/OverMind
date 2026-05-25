# Solar War 2040 — Multiplayer Backend

A WebSocket server modelling **MATCH ▸ COMPANIES (teams) ▸ MEMBERS (devices)**, so
that signed-in accounts own companies and many devices co-manage them.

## Run locally

```bash
cd server
npm install
npm start          # listens on :8090 (override with PORT)
```

Then in the game (`solar-war.html`) open **Multiplayer (Beta)** from the main
menu, sign in, and connect to `ws://localhost:8090`.

## Model: accounts → company teams → devices

```
  ACCOUNT (alice@gmail) ───────────┐        ACCOUNT (bob@gmail)
   device A1 (host) ─┐             │          device B1 (host)
   device A2 ────────┤  COMPANY 1  │          COMPANY 2
   …up to 64 devices ┘  (team)     │          (team)
        ▲ co-manage one company    │             ▲
        └─ company-host runs the sim, streams {state} to teammates,
           teammates relay {action} back.   …up to 64 companies / match
```

- A device **authenticates** with an account identity (Google `sub`/email in
  production; a dev email locally). **Same account = same company team.**
- Inside a match, every device on an account shares one **company** and
  co-manages it (up to 64 devices). Each device keeps its own POV (camera, tab,
  map) — only game state is shared.
- Different accounts get different companies — up to **64 companies per match**.
- **Authority (per company):** each team has a **company host** (first device in)
  that runs that company's sim and publishes `{t:"state"}` snapshots; the server
  fans them out to that company's other devices. Teammates send `{t:"action"}`
  which the server relays to the company host. One device is the **match host**
  (creator) and controls start/settings. Hosts hand off on disconnect.

### Auth

The scaffold **trusts the client-supplied identity** so it runs with zero
secrets. For production, verify the Google ID token in `verifyAccount()` (a
documented pass-through hook) before trusting `account.id` — and on the client
set `window.MP_GOOGLE_CLIENT_ID` to enable the real Google Identity Services
button (email sign-in works out of the box for dev/LAN play).

## Wire protocol (JSON over WebSocket)

Client → Server:

| message | fields | who | meaning |
|---|---|---|---|
| `auth` | `account{id,email,name,provider}` | any | authenticate (required first) |
| `create` | `settings{rivalCount,neutralCount}`, (`company`) | authed | create a match, become match host |
| `join` | `code`, (`company`) | authed | join a match (placed on your account's company) |
| `claim` | `company` (0–63) | company host | set your company's slot (pre-start) |
| `chat` | `channel`("team"\|"match"), `text` | in-match | team or match chat |
| `start` | — | match host | begin the match |
| `action` | `action` | in-match | gameplay action (relayed to your company host) |
| `state` | `snapshot` | company host | your company's snapshot (fanned to teammates) |
| `leave` | — | in-match | leave the match |

Server → Client:

| message | fields | meaning |
|---|---|---|
| `welcome` | `id` | your device id |
| `authed` | `account{id,name,provider}` | identity accepted |
| `joined` | `code`, `you`, `company` | you joined; your company index |
| `match` | `match{code,hostId,started,settings,companies[]}` | full match roster |
| `team` | `company{index,name,accountId,hostId,members[]}` | your company/team detail |
| `host` | `scope`("match"\|"team"), `companyIndex?`, `hostId` | host hand-off |
| `chat` | `channel`, `from`, `fromCompany`, `text` | chat line |
| `start` | `match` | match started |
| `action` | `from`, `action` | a teammate's action (company host only) |
| `state` | `companyIndex`, `snapshot` | latest snapshot (teammates only) |
| `error` | `msg` | human-readable error |

## Deploy

Any Node host works. Set `PORT` from the platform env. `GET /health` returns
`{ok,matches,ts}` for health checks. Use a `wss://` (TLS) URL in production —
terminate TLS at the platform's load balancer.

## Roadmap

1. **Lobby** — matches, codes, chat, host hand-off. ✅
2. **Relay match (co-op)** — company host streams full-state snapshots (~1 Hz);
   teammates mirror live and relay whitelisted economy actions (research, trade,
   crypto, sabotage/steal/acquire, pact, set-speed, space builds). ✅
3. **Accounts + company teams** — sign-in identity; same account = same company;
   many devices per company; team vs match chat; per-company state/action
   scoping. ✅
3b. **Networked map placement** — teammates' earth/moon (`placeRect`) and orbit
   (`placeOrbit`) builds relay to the company host by cell, get built there, and
   mirror back. ✅ (orbit ship/unit spawning is part of the combat-networking milestone)
4. **Cross-company shared world** — today each company team co-runs its own
   instance (others appear as AI). Next: one authoritative world where all 64
   companies are real entities competing in shared markets and combat. 🔜
5. **Server-authoritative tick** — port `rates/advance/worldTick` into `./engine`
   and run the sim here for cheat-resistance, delta snapshots, and headless/AI matches.
6. **Persistence & verified auth** — durable matches + accounts (e.g. Supabase,
   already a repo dependency) for reconnection, Google-token verification, and ranked play.
