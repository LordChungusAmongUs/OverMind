/*
 * Solar War 2040 — Multiplayer Backend (v2: accounts + company teams)
 * -------------------------------------------------------------------
 * A WebSocket server that models:  MATCH ▸ COMPANIES (teams) ▸ MEMBERS (devices).
 *
 *   - A device connects and AUTHENTICATES with an account identity
 *     (Google sub/email in production, or a dev email in local play).
 *   - A device joins a MATCH (by 4-letter code). Inside the match it is placed on
 *     the COMPANY that belongs to its account: every device signed into the SAME
 *     account shares one company TEAM and co-manages it (up to 64 devices/company).
 *   - Different accounts get different companies — up to 64 companies compete in a
 *     match.
 *
 * Authority model (host-authoritative, per company):
 *   - Each company team has a HOST device (the first to join that company) which
 *     runs that company's simulation and publishes {t:"state"} snapshots; the
 *     server fans them out to that company's OTHER devices only.
 *   - Teammates send {t:"action"}; the server relays them to their company host.
 *   - One device is the MATCH host (the creator) and controls match start/settings.
 *
 * NOTE ON AUTH: this scaffold TRUSTS the client-supplied identity so it runs with
 * zero secrets. In production, verify the Google ID token here (see verifyAccount)
 * before trusting account.id — never trust a raw client claim for ranked play.
 *
 * Run:  npm install && npm start     (PORT env, default 8090)
 */
"use strict";
const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8090;
const MAX_COMPANIES = 64;      // companies (accounts) per match
const MAX_TEAM = 64;           // devices per company
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** @type {Map<string, Match>} */
const matches = new Map();
let nextId = 1;

function makeCode() {
  let c; do { c = Array.from({ length: 4 }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join(""); } while (matches.has(c));
  return c;
}

/**
 * Production hook: verify a Google ID token and return a trusted account.
 * Left as a pass-through for the scaffold (no network/secrets required).
 */
async function verifyAccount(account) {
  // In production:
  //   const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + account.token);
  //   const tok = await r.json(); assert(tok.aud === GOOGLE_CLIENT_ID);
  //   return { id: "google:" + tok.sub, email: tok.email, name: tok.name, provider: "google" };
  return account;
}

function companyView(co) {
  return { index: co.index, name: co.name, accountId: co.accountId, hostId: co.hostId, members: co.members.map((m) => ({ id: m.id, name: m.name })) };
}
function matchView(match) {
  return {
    code: match.code, hostId: match.hostId, started: match.started, settings: match.settings,
    companies: [...match.companies.values()].map(companyView),
  };
}
function send(ws, msg) { if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); }
function toMatch(match, msg, exceptId) { match.companies.forEach((co) => co.members.forEach((m) => { if (m.id !== exceptId) send(m.ws, msg); })); }
function toTeam(co, msg, exceptId) { co.members.forEach((m) => { if (m.id !== exceptId) send(m.ws, msg); }); }
function companyOf(match, accountId) { return match.companies.get(accountId); }
function memberCompany(match, memberId) { for (const co of match.companies.values()) if (co.members.some((m) => m.id === memberId)) return co; return null; }
function freeIndex(match) { const used = new Set([...match.companies.values()].map((c) => c.index)); for (let i = 0; i < MAX_COMPANIES; i++) if (!used.has(i)) return i; return -1; }

function leaveMatch(client) {
  const match = client.match; if (!match) return;
  const co = memberCompany(match, client.id);
  client.match = null;
  if (!co) return;
  co.members = co.members.filter((m) => m.id !== client.id);
  if (co.members.length === 0) {
    match.companies.delete(co.accountId);
  } else if (co.hostId === client.id) {
    co.hostId = co.members[0].id;                 // company-host hand-off within team
    toTeam(co, { t: "host", scope: "team", companyIndex: co.index, hostId: co.hostId });
  }
  // match-host hand-off / empty cleanup
  const anyMember = [...match.companies.values()].some((c) => c.members.length);
  if (!anyMember) { matches.delete(match.code); return; }
  if (match.hostId === client.id) {
    const first = [...match.companies.values()][0];
    match.hostId = first.members[0].id;
    toMatch(match, { t: "host", scope: "match", hostId: match.hostId });
  }
  toMatch(match, { t: "match", match: matchView(match) });
}

function placeInCompany(client, match, chosenIndex) {
  let co = companyOf(match, client.account.id);   // same account -> same company team
  if (!co) {
    if (match.companies.size >= MAX_COMPANIES) return { error: "Match is full (64 companies)." };
    let idx = (typeof chosenIndex === "number" && chosenIndex >= 0 && chosenIndex < MAX_COMPANIES && ![...match.companies.values()].some((c) => c.index === chosenIndex)) ? chosenIndex : freeIndex(match);
    if (idx < 0) return { error: "No free company slot." };
    co = { index: idx, accountId: client.account.id, name: client.account.name ? client.account.name + " Corp" : "Company " + (idx + 1), hostId: client.id, members: [] };
    match.companies.set(client.account.id, co);
  }
  if (co.members.length >= MAX_TEAM) return { error: "Company team is full (64 devices)." };
  co.members.push(client);
  return { company: co };
}

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, matches: matches.size, ts: Date.now() }));
    return;
  }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  const client = { id: "d" + nextId++, ws, account: null, match: null };
  ws.isAlive = true; ws.on("pong", () => (ws.isAlive = true));
  send(ws, { t: "welcome", id: client.id });

  ws.on("message", async (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== "string") return;

    // must authenticate before anything else
    if (m.t === "auth") {
      const acc = await verifyAccount(m.account || {});
      client.account = {
        id: String(acc.id || ("guest:" + client.id)).slice(0, 80),
        email: String(acc.email || "").slice(0, 120),
        name: String(acc.name || "Player").slice(0, 32),
        provider: acc.provider === "google" ? "google" : "dev",
      };
      send(ws, { t: "authed", account: { id: client.account.id, name: client.account.name, provider: client.account.provider } });
      return;
    }
    if (!client.account) { send(ws, { t: "error", msg: "Sign in first." }); return; }

    switch (m.t) {
      case "create": {
        if (client.match) leaveMatch(client);
        const code = makeCode();
        const match = { code, hostId: client.id, started: false, settings: sanitizeSettings(m.settings), companies: new Map() };
        matches.set(code, match);
        client.match = match;
        const r = placeInCompany(client, match, m.company);
        if (r.error) { send(ws, { t: "error", msg: r.error }); break; }
        send(ws, { t: "joined", code, you: client.id, company: r.company.index });
        toMatch(match, { t: "match", match: matchView(match) });
        send(ws, { t: "team", company: companyView(r.company) });
        break;
      }
      case "join": {
        const match = matches.get(String(m.code || "").toUpperCase());
        if (!match) { send(ws, { t: "error", msg: "No match with that code." }); break; }
        if (client.match) leaveMatch(client);
        client.match = match;
        const r = placeInCompany(client, match, m.company);
        if (r.error) { client.match = null; send(ws, { t: "error", msg: r.error }); break; }
        send(ws, { t: "joined", code: match.code, you: client.id, company: r.company.index });
        toMatch(match, { t: "match", match: matchView(match) });
        toTeam(r.company, { t: "team", company: companyView(r.company) });
        break;
      }
      case "claim": {
        const match = client.match; if (!match || match.started) break;
        const co = memberCompany(match, client.id);
        if (!co || co.hostId !== client.id) break;          // only the company host re-slots
        const idx = m.company | 0;
        if (idx < 0 || idx >= MAX_COMPANIES) break;
        if ([...match.companies.values()].some((c) => c !== co && c.index === idx)) break;
        co.index = idx;
        toMatch(match, { t: "match", match: matchView(match) });
        break;
      }
      case "chat": {
        const match = client.match; if (!match) break;
        const co = memberCompany(match, client.id);
        const payload = { t: "chat", channel: m.channel === "team" ? "team" : "match", from: client.account.name, fromCompany: co ? co.index : -1, text: String(m.text || "").slice(0, 280) };
        if (payload.channel === "team" && co) toTeam(co, payload); else toMatch(match, payload);
        break;
      }
      case "start": {
        const match = client.match; if (!match || match.hostId !== client.id) break;
        match.started = true;
        toMatch(match, { t: "start", match: matchView(match) });
        break;
      }
      case "action": {                                       // relay to my company host
        const match = client.match; if (!match) break;
        const co = memberCompany(match, client.id); if (!co) break;
        const host = co.members.find((x) => x.id === co.hostId);
        if (host && host.id !== client.id) send(host.ws, { t: "action", from: client.id, action: m.action });
        break;
      }
      case "state": {                                        // company host -> teammates
        const match = client.match; if (!match) break;
        const co = memberCompany(match, client.id); if (!co || co.hostId !== client.id) break;
        toTeam(co, { t: "state", companyIndex: co.index, snapshot: m.snapshot }, client.id);
        break;
      }
      case "report": {                                       // company host publishes public metrics to all companies
        const match = client.match; if (!match) break;
        const co = memberCompany(match, client.id); if (!co || co.hostId !== client.id) break;
        co.pub = m.pub;
        toMatch(match, { t: "report", company: co.index, pub: m.pub }, client.id);
        break;
      }
      case "attack": {                                       // route to the target company's host, or to the world (match) host if the target is AI
        const match = client.match; if (!match) break;
        const me = memberCompany(match, client.id);
        const target = [...match.companies.values()].find((c) => c.index === (m.target | 0));
        let destId = target ? target.hostId : match.hostId;        // AI targets resolve to the world host
        let destWs = null;
        for (const c of match.companies.values()) { const h = c.members.find((x) => x.id === destId); if (h) { destWs = h.ws; break; } }
        if (destWs) send(destWs, { t: "attack", from: me ? me.index : -1, target: m.target | 0, kind: m.kind, mag: m.mag });
        break;
      }
      case "shipgoods": {                                    // physical delivery: route a parcel to the target company's host
        const match = client.match; if (!match) break;
        const me = memberCompany(match, client.id);
        const target = [...match.companies.values()].find((c) => c.index === (m.target | 0));
        if (!target) break;                                  // no human recipient (AI/unknown) -> goods don't arrive
        const h = target.members.find((x) => x.id === target.hostId);
        if (h) send(h.ws, { t: "shipgoods", from: me ? me.index : -1, target: m.target | 0, res: m.res, qty: m.qty });
        break;
      }
      case "worldroster": {                                   // authoritative world roster (match host -> everyone else)
        const match = client.match; if (!match || match.hostId !== client.id) break;
        toMatch(match, { t: "worldroster", roster: m.roster }, client.id);
        break;
      }
      case "victory": {                                        // authoritative match result (match host -> everyone else)
        const match = client.match; if (!match || match.hostId !== client.id) break;
        toMatch(match, { t: "victory", index: m.index }, client.id);
        break;
      }
      case "leave": leaveMatch(client); break;
    }
  });

  ws.on("close", () => leaveMatch(client));
  ws.on("error", () => {});
});

function sanitizeSettings(s) {
  s = s || {};
  const clamp = (v, lo, hi, d) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
  return { rivalCount: clamp(s.rivalCount, 0, MAX_COMPANIES - 1, 7), neutralCount: clamp(s.neutralCount, 0, MAX_COMPANIES - 1, 10) };
}

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => { if (ws.isAlive === false) return ws.terminate(); ws.isAlive = false; try { ws.ping(); } catch (e) {} });
}, 30000);
wss.on("close", () => clearInterval(heartbeat));

server.listen(PORT, () => console.log(`Solar War 2040 multiplayer server (v2 teams) listening on :${PORT}`));
