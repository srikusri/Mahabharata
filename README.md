# Mahabharata - Battle for Dharma (serverless multiplayer)

A browser board game that runs entirely from static files on GitHub Pages. Players connect
directly to each other over WebRTC; there is no backend, database or account.

**Status: Phases 1-5 are built** (foundation, connectivity, rules engine, snapshots / reconnect / host migration, UI polish). Phase 6 is testing on real devices.
UI polish (Phase 5) is not here yet.

| Done | Not yet |
| --- | --- |
| Vite + React + TypeScript + Tailwind, PWA, GitHub Pages workflow | Game engine, dice, turns, property and money rules (Phase 3) |
| Board (40 spaces, mirrors the A3 print artwork) with pinch / pan / zoom | State sync of game actions, snapshots, host migration (Phase 4) |
| Two-stage QR pairing over WebRTC (with paste-code fallback) | Animations, sound, card art (Phase 5) |
| Host-authoritative lobby: PIN, 2-6 players, tokens, ready, start | |
| Versioned message protocol, replay protection, heartbeat/RTT | |
| Resume a seat with a secret after a dropped connection | |
| IndexedDB persistence (prefs, resume secret) | |

## Run it

```bash
npm install
npm test            # unit tests (58)
npm run dev         # http://localhost:5173 (also on your LAN)
npm run build       # type-check + production build into dist/
```

**Phones need https for the camera.** iOS Safari and Android Chrome block `getUserMedia` on plain
`http://` LAN addresses. Two ways to test on real devices:

1. Deploy to GitHub Pages (below). It is https, and it is how players will use it. Best option.
2. `npm run dev:https` serves a self-signed certificate; accept the browser warning on each phone.

You can always pair without a camera: both screens have **Copy code as text** and **Paste code instead**.

## Deploy to GitHub Pages

```bash
git init -b main && git add . && git commit -m "Mahabharata game"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

The workflow (`.github/workflows/deploy.yml`) enables Pages itself on the first push (if your account allows it; otherwise
set **Settings > Pages > Source: GitHub Actions** once), then runs tests, builds, adds a `404.html` SPA fallback and publishes to
`https://<you>.github.io/<repo>/`. Pull requests run the tests and build but do not deploy.

`vite.config.ts` uses `base: './'` and a relative PWA scope, so no per-repo configuration is needed. Pages is https, which phones
need for the camera and for installing the app to the home screen.

## Easier joining (Phase 5b)

- **Invite link instead of a QR**: on the invite screen the host taps "No camera? Send an invite link instead" (share sheet, or copy). The link is `.../#join=<code>`; the code sits in the URL fragment and is never sent to a server. Opening it takes the guest straight to the reply step. Players should open it in Safari or Chrome, not inside a chat app's built-in browser.
- **Reply by message**: the guest can send the reply code with the share sheet; the host copies it and taps "Paste code from clipboard". Surrounding chat text is ignored.
- **PIN filled in automatically**: the offer carries the PIN, so guests do not type it. The offer is single-use and the host must still accept the guest's reply, so this does not weaken the pairing; the PIN is still required to reclaim a seat after a host change.
- Step indicators on both phones, clearer wording, and a "phone connected" note on the host.
- `npm run e2e:link` covers the link path.

## How pairing works

There is no signalling server, so the WebRTC handshake travels through two QR codes.
Scanning the host's code alone does **not** connect anything.

```
HOST phone                                   GUEST phone
 Add a player
 creates an OFFER, shows QR #1  ----scan--->  Join Game, scans QR #1
                                              creates an ANSWER, shows QR #2
 Step 2: scans QR #2  <-----------scan-----
 ----------- WebRTC data channel opens (DTLS encrypted) -----------
                                              enters name, token, PIN  -> PLAYER_JOIN
 validates PIN, seat, token  ---> GAME_SNAPSHOT (welcome + secret) + lobby broadcast
```

Codes are `deflate` + base64url. Typical offer / answer is about 670 characters, which the app splits into
numbered parts (`MGP.<tag>.<i>.<n>.<data>`) that cycle on screen; the scanner reassembles them in any order.
ICE is not trickled: each side waits for gathering to finish so one offer and one answer carry every candidate.
Because the DTLS fingerprint travels in the QR, the key exchange is authenticated by what the players physically scanned.

Each additional player repeats the exchange (one WebRTC connection per guest, host in the middle).

## Layout

```
src/
  multiplayer/
    Transport.ts          Transport interface + in-memory loopback (tests)
    MessageProtocol.ts    envelope, validation, sequence + duplicate guard, ids, PIN
    signaling.ts          SDP slimming, compression, QR splitting / reassembly
    WebRTCConnection.ts   RTCPeerConnection + one reliable ordered DataChannel
    HostManager.ts        authoritative lobby, join validation, liveness, resume
    GuestManager.ts       guest side: join, ready, heartbeat/RTT, resync
    P2PManager.ts         HostSession / GuestSession: QR pairing glue
    lobby.ts, config.ts   lobby model, tokens, ICE + timing config
  engine/board.ts         board data only (rules arrive in Phase 3)
  components/             Board (PanZoom), Lobby (QR display/scanner), Player
  screens/                Home, HostSetup, HostLobby, JoinFlow, GuestLobby, PlayScreen
  state/connectionStore.ts   Zustand
  persistence/IndexedDBManager.ts   IndexedDB with localStorage/memory fallback
e2e/pairing.mjs           two real browsers, real WebRTC, through the actual UI
```

The multiplayer folder does not import React, the game engine or the board, so it can be lifted out as the
standalone P2P SDK recommended in the brief. Game logic and transport only meet at `Transport`.

## Protocol

Every message is `{ protocolVersion, roomId, senderId, messageId, sequenceNumber, type, payload }`.
All 16 message types from the brief are defined; Phase 2 uses `PLAYER_JOIN`, `PLAYER_LEAVE`, `PLAYER_READY`,
`GAME_START`, `GAME_STATE_UPDATE`, `GAME_SNAPSHOT`, `HEARTBEAT`, `RESYNC` and `GAME_ACTION` (relayed to the host's
`onEvent` hook, ready for the engine).

Join rejections come back as `PLAYER_LEAVE` with `{ rejected, fatal }`. A wrong PIN is non-fatal (retry on the same
connection, 3 attempts); a full room or started game is fatal.

## Security model

- Host-authoritative: guests only send requests; the host validates everything and broadcasts the result.
- Every inbound message is schema-checked, size-limited (64 KB) and pinned to one sender per connection.
  Duplicate `messageId`s and non-increasing sequence numbers are dropped, so a replay does nothing.
- Nothing except `PLAYER_JOIN` is accepted from a peer that has not joined.
- The PIN is compared in constant time, is never put in any broadcast, and gives 3 tries per connection.
- A seat can only be reclaimed with its 128-bit secret (issued on join, kept in IndexedDB); a second connection
  claiming a taken id without it is refused.
- WebRTC DataChannels are DTLS-encrypted. Names are sanitised before they are stored or shown.
- Honest limit: a 4-digit PIN is a convenience gate, not strong authentication. Getting a connection at all
  requires a physical QR exchange with the host, and that is the real barrier.

## Testing on real devices (the step that decides the architecture)

Automated tests cannot tell you whether your router and iPhones can reach each other. Do this before building
Phase 3 on top:

1. Deploy to GitHub Pages and open it on two iPhones in Safari, on the same Wi-Fi.
2. Pair them. Success = the guest reaches the lobby and the badge shows a round-trip time (ms).
3. Repeat with 4 devices, then iPhone + Android.
4. Different networks: add `?stun=1` to the URL on every device (adds one public STUN server, opt-in).
5. Failure cases: Wi-Fi client isolation on, host locks screen, guest switches app (Safari suspends the tab and
   the data channel drops; reopening and re-scanning restores the same seat via the saved secret), airplane mode blip.

Things most likely to bite on iPhone, in order:

- **Wi-Fi client isolation** (guest networks, some mesh/hotel routers) blocks device-to-device traffic. Nothing in
  the app can fix that; the join screen says so after 20 seconds.
- **mDNS host candidates.** WebKit hides local IPs behind `xxxx.local` names unless the page has camera permission.
  Peers normally resolve these over Bonjour on the same Wi-Fi, but if two iPhones fail to connect while the
  network is fine, this is the first suspect. Mitigation to try: ask the host for camera permission when creating the room,
  before the first offer is generated.
- **Backgrounding.** iOS suspends background tabs; expect the connection to drop and the seat to be resumed on return.
- **Compression.** `CompressionStream` needs Safari 16.4+; older versions fall back to uncompressed (larger, more QR parts).

## Rules engine (Phase 3)

`src/engine/` is pure TypeScript with no UI or network imports. `applyAction(state, playerId, action)` validates, applies and
returns a new state plus events; dice come from a seeded PRNG held in the state, so a seed replays a whole game.
The host runs it (`src/game/HostGame.ts`); guests send `GAME_ACTION` requests and receive their own sanitised view
(no PRNG, no deck order, private events only for their owner).

Encoded from the print PDF: 1500 start, 200 salary, doubles (third double to Vanavasa, no salary), Vanavasa exit by doubles /
50 S / Krishna's Counsel, 23 kingdom rent tables, Rathas by count, Astras 4x/10x dice, Ashramas built evenly, Royal Mahal after
4 Ashramas, mortgage at half price, 8 Daiva + 8 Dharma Sankat cards, last solvent player wins, optional timed play by net worth.

**Where the PDF is silent, these defaults apply (change in `src/engine`):**
- A declined purchase stays unowned (no auction). No player-to-player trading yet.
- Selling an Ashrama refunds half its cost; buildings must be sold evenly and before mortgaging.
- Redeeming a mortgage costs the mortgage value + 10%.
- Staying in Vanavasa is never forced to end; only doubles, the 50 S fine, or the card free you.
- Card moves to GO / Amaravati collect salary if they pass GO. A Royal Mahal counts as 4 Ashramas for Ashrama Renovation.
- Bankruptcy: cash and properties go to the creditor (buildings cleared, mortgages kept) or the bank.
- Unlimited building supply.

## Recovery (Phase 4)

There is no server, so recovery is built from what the devices already hold.

| Situation | What happens |
| --- | --- |
| Host reloads / crashes | The host saves the full game (state, seats, secrets, PIN) to IndexedDB after every action. Home shows **Resume your hosted game**. Players tap **Rejoin the game you were in**, scan the host's code, and resume their seat silently (saved secret, no PIN). |
| A guest drops or reloads | Host sees them offline under **Host tools**, taps **Reconnect a player** (QR exchange), and the guest resumes the same seat. If the game is waiting on them, the host can **Skip their turn** (a player who owes money is declared bankrupt instead). |
| Host is gone for good | Any guest taps **Take over as host**. That phone rebuilds the game from the newest state it received and opens a new room with a new PIN. Each other player taps **Reconnect**, scans the new host, and reclaims their own seat by entering the new PIN. |

Details and limits:
- A reconnect still needs a fresh QR exchange (no signalling server). Seats, money, properties, buildings, turn and held cards are preserved exactly.
- Guests never receive the dice generator or card order, so a migrated game **reshuffles the card decks** and restarts the dice from a new seed. Cards held by players stay with them.
- A migrated game continues from the newest state the new host saw, which can be one action behind another guest's.
- Seat reclaiming after a restore/migration is authenticated by the room PIN plus knowing the seat id (ids are visible to the table). It is a convenience gate for people sitting together, not strong security.
- Guests that were never connected to the new host stay as offline seats; use Skip to keep the game moving.

## UI polish (Phase 5)

- Tokens hop space by space (about 130 ms each); long or backward moves (cards, exile) jump. `src/ui/hop.ts` holds the pure helpers.
- Floating +/- money on the player cards, a "Your turn" toast with a chime and vibration (Android; iOS Safari has no vibrate API).
- Sounds are synthesized with WebAudio (no asset files). Audio starts after the first tap (iOS rule). The Sound button persists in localStorage.
- Screen Wake Lock during a game, to reduce iOS / Android backgrounding dropping the P2P link.
- `prefers-reduced-motion` disables animations and token hopping.
- Tap any space for its deed: price, rent table, mortgage value, owner and level.
- Two-column layout from the `lg` breakpoint (board sticks on the left); single column on phones.
- Game-over screen shows the standings by net worth.
- PWA: autoUpdate service worker precaches the app shell (about 514 KiB); installable, standalone.

## Known gaps

- Reconnecting still needs a fresh QR exchange (no signalling server); only the seat and identity are preserved.
- No TURN relay by design, so symmetric NATs on different networks can fail even with `?stun=1`.
- Host migration is manual (a person chooses to take over); there is no automatic election.
- Not yet tested on real phones, and the game screen has had only desktop-browser e2e coverage.

## Dev aids

- `#board-preview` (e.g. `http://localhost:5173/#board-preview`) shows the board with sample tokens.
- `npm run e2e` drives two headless browsers through pairing and a round of play; `npm run e2e:recovery` covers reconnect after a reload and host migration with three browsers. It needs Playwright
  (`PLAYWRIGHT_MODULE=/path/to/playwright`) and `npx vite preview --port 4173` running.
