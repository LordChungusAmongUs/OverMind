/*
 * Solar War 2040 — Multiplayer Backend (scaffold)
 * ------------------------------------------------
 * A lightweight WebSocket lobby + action-relay server.
 *
 * Model: HOST-AUTHORITATIVE RELAY.
 *   - Players connect, then create or join a room by 4-letter code.
 *   - Each room has one HOST (the creator). The host runs the authoritative
 *     simulation in their browser and broadcasts {t:"state"} snapshots.
 *   - Non-host players send {t:"action"} messages; the server relays them to
 *     the host, who applies them and rebroadcasts the resulting state.
 *   - The server itself is authoritative ONLY for lobby concerns: room
 *     membership, company claims, chat, and host hand-off.
 *
 * This is deliberately simple so it can be deployed anywhere Node runs
 * (Render / Fly / Railway / a VPS). For a fully server-authoritative sim,
 * port the engine functions from solar-war.html into ./engine and tick here.
 *
 * Run:  npm install && npm start     (PORT env var, default 8090)
 * Wire: point the in-game Multiplayer lobby at  ws://<host>:8090
 */
"use strict";
const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8090;
const MAX_COMPANIES = 64;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

/** @type {Map<string, Room>} */
const rooms = new Map();
let nextId = 1;

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join("");
  } while (rooms.has(code));
  return code;
}

function roomView(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    settings: room.settings,
    players: room.players.map((p) => ({ id: p.id, name: p.name, company: p.company, host: p.id === room.hostId })),
  };
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, exceptId) {
  room.players.forEach((p) => {
    if (p.id !== exceptId) send(p.ws, msg);
  });
}

function leaveRoom(client) {
  const room = client.room;
  if (!room) return;
  room.players = room.players.filter((p) => p.id !== client.id);
  client.room = null;
  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }
  // host hand-off
  if (room.hostId === client.id) {
    room.hostId = room.players[0].id;
    broadcast(room, { t: "host", hostId: room.hostId });
  }
  broadcast(room, { t: "room", room: roomView(room) });
}

const server = http.createServer((req, res) => {
  // tiny health endpoint so platform health-checks pass
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, ts: Date.now() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  const client = { id: "p" + nextId++, name: "Player", ws, room: null };
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));
  send(ws, { t: "welcome", id: client.id });

  ws.on("message", (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== "string") return;

    switch (m.t) {
      case "hello":
        client.name = String(m.name || "Player").slice(0, 24);
        break;

      case "create": {
        if (client.room) leaveRoom(client);
        const code = makeCode();
        const room = {
          code,
          hostId: client.id,
          started: false,
          settings: sanitizeSettings(m.settings),
          players: [],
        };
        rooms.set(code, room);
        client.company = 0;
        room.players.push(client);
        client.room = room;
        send(ws, { t: "joined", code, you: client.id });
        broadcast(room, { t: "room", room: roomView(room) });
        break;
      }

      case "join": {
        const room = rooms.get(String(m.code || "").toUpperCase());
        if (!room) { send(ws, { t: "error", msg: "No room with that code." }); break; }
        if (room.started) { send(ws, { t: "error", msg: "Match already started." }); break; }
        if (room.players.length >= MAX_COMPANIES) { send(ws, { t: "error", msg: "Room is full." }); break; }
        if (client.room) leaveRoom(client);
        client.company = firstFreeCompany(room);
        room.players.push(client);
        client.room = room;
        send(ws, { t: "joined", code: room.code, you: client.id });
        broadcast(room, { t: "room", room: roomView(room) });
        break;
      }

      case "claim": {
        const room = client.room;
        if (!room || room.started) break;
        const idx = m.company | 0;
        if (idx < 0 || idx >= MAX_COMPANIES) break;
        if (room.players.some((p) => p.id !== client.id && p.company === idx)) break; // taken
        client.company = idx;
        broadcast(room, { t: "room", room: roomView(room) });
        break;
      }

      case "chat": {
        const room = client.room;
        if (!room) break;
        broadcast(room, { t: "chat", from: client.name, fromId: client.id, text: String(m.text || "").slice(0, 280) });
        break;
      }

      case "start": {
        const room = client.room;
        if (!room || room.hostId !== client.id) break;
        room.started = true;
        broadcast(room, { t: "start", room: roomView(room) });
        break;
      }

      case "action": {
        const room = client.room;
        if (!room) break;
        // relay player actions to the host for authoritative application
        const host = room.players.find((p) => p.id === room.hostId);
        if (host) send(host.ws, { t: "action", from: client.id, action: m.action });
        break;
      }

      case "state": {
        const room = client.room;
        if (!room || room.hostId !== client.id) break; // only host publishes state
        broadcast(room, { t: "state", snapshot: m.snapshot }, client.id);
        break;
      }

      case "leave":
        leaveRoom(client);
        break;
    }
  });

  ws.on("close", () => leaveRoom(client));
  ws.on("error", () => {});
});

function firstFreeCompany(room) {
  const taken = new Set(room.players.map((p) => p.company));
  for (let i = 0; i < MAX_COMPANIES; i++) if (!taken.has(i)) return i;
  return 0;
}

function sanitizeSettings(s) {
  s = s || {};
  const clamp = (v, lo, hi, d) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
  return {
    rivalCount: clamp(s.rivalCount, 0, MAX_COMPANIES - 1, 7),
    neutralCount: clamp(s.neutralCount, 0, MAX_COMPANIES - 1, 10),
  };
}

// drop dead connections every 30s
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch (e) {}
  });
}, 30000);
wss.on("close", () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`Solar War 2040 multiplayer server listening on :${PORT}`);
});
