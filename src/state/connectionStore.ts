import { create } from 'zustand';
import type { GameState } from '../engine';
import type { LobbyPlayer } from '../multiplayer/lobby';
import { HostManager } from '../multiplayer/HostManager';
import { GuestState } from '../multiplayer/GuestManager';
import { GuestSession, HostSession } from '../multiplayer/P2PManager';
import { getIceServers } from '../multiplayer/config';
import type { PublicLobby, TokenId } from '../multiplayer/lobby';
import { Action, GameEvent, PublicState, isPublicState, randomSeed, restoreFromPublic } from '../engine';
import { HostGame } from '../game/HostGame';
import { clearSession, loadSession, saveSession } from '../persistence/IndexedDBManager';
import { HostSave, clearHostGame, loadHostGame, saveHostGame } from '../persistence/gameSave';
import { newId, newPin } from '../multiplayer/MessageProtocol';

export type Screen = 'home' | 'host-setup' | 'host-lobby' | 'join' | 'guest-lobby' | 'play';

interface Store {
  screen: Screen;
  role: 'none' | 'host' | 'guest';
  lobby: PublicLobby | null;
  selfId: string | null;
  pin: string | null;
  guest: GuestState | null;
  hostSession: HostSession | null;
  guestSession: GuestSession | null;
  hostGame: HostGame | null;
  /** Latest authoritative game view (host and guests alike) and the events of the action that produced it. */
  game: PublicState | null;
  gameRoomId: string | null;
  events: GameEvent[];
  gameError: string | null;
  /** A saved host game found on this device (shown on Home). */
  savedGame: HostSave | null;
  /** A saved guest seat found on this device (shown on Home). */
  savedSeat: { roomId: string; playerId: string } | null;
  loadSaved: () => Promise<void>;
  resumeHost: () => void;
  /** Guest: open the join flow again keeping this seat (host came back, or a new host took over). */
  reconnect: () => void;
  /** Guest: the host is gone; carry on as host using the newest state this device has. */
  takeOver: () => void;
  skipOffline: (playerId: string) => void;
  dispatch: (a: Action) => void;
  clearError: () => void;
  go: (s: Screen) => void;
  startHost: (name: string, tokenId: TokenId) => void;
  startGuest: () => GuestSession;
  leave: () => void;
}

type Set = (p: Partial<Store>) => void;
type Get = () => Store;

function openGuest(set: Set, get: Get, keepId: string | undefined, rejoin = false): GuestSession {
  const session = new GuestSession({
    rtc: { iceServers: getIceServers() },
    playerId: keepId,
    onGame: (m) => {
      if (m.error) set({ gameError: m.error });
      if (!isPublicState(m.game)) return;
      const { game: cur, gameRoomId } = get();
      const roomId = get().guest?.lobby?.roomId ?? get().lobby?.roomId ?? null;
      // A different room means a new host (migration): its state may be a version behind ours, and it is now the truth.
      if (cur && roomId === gameRoomId && m.game.version < cur.version) return; // stale
      set({ game: m.game, gameRoomId: roomId, events: Array.isArray(m.events) ? (m.events as GameEvent[]) : [], gameError: null });
    },
    loadSaved: loadSession,
    saveSession: (s) => void saveSession(s),
    onState: (s) => {
      set({ guest: s, lobby: s.lobby ?? get().lobby, selfId: s.selfId });
      const screen = get().screen;
      if (s.started && s.status === 'joined' && screen !== 'play') set({ screen: 'play' });
      else if (s.status === 'joined' && screen === 'join') set({ screen: 'guest-lobby' });
      if (s.status === 'rejected') void clearSession();
    },
  });
  set(rejoin ? { role: 'guest', guestSession: session, guest: null, screen: 'join' } : { role: 'guest', guestSession: session, guest: null, lobby: null, game: null, screen: 'join' });
  return session;
}

/** Create the host session, and the game if one is being resumed; persist a snapshot after every change. */
function wireHost(set: Set, get: Get, manager: HostManager, restored: GameState | null) {
  const session = new HostSession(manager, { iceServers: getIceServers() });
  const hostToken = () => manager.publicLobby().players.find((p) => p.isHost)!.tokenId;
  const attach = (hg: HostGame) => {
    hg.onView = (view, events) => set({ game: view, events, gameError: null });
    hg.onSnapshot = (state) => {
      if (state.turn.phase === 'over') return void clearHostGame();
      void saveHostGame({
        v: 1,
        roomId: manager.roomId,
        hostId: manager.hostId,
        hostName: manager.hostName,
        hostToken: hostToken(),
        pin: manager.pin,
        seats: manager.exportSeats(),
        state,
        savedAt: Date.now(),
      });
    };
    set({ hostGame: hg });
    return hg;
  };
  manager.onChange = (lobby) => set({ lobby });
  manager.onEvent = (e) => {
    if (e.type === 'started') {
      const hg = attach(new HostGame(manager, manager.publicLobby().players.map((p) => ({ id: p.id, name: p.name, tokenId: p.tokenId }))));
      set({ screen: 'play' });
      hg.publishAll();
      hg.onSnapshot?.(hg.state);
    } else get().hostGame?.handleHostEvent(e);
  };
  manager.startLivenessMonitor();
  set({ role: 'host', hostSession: session, lobby: manager.publicLobby(), selfId: manager.hostId, pin: manager.pin, game: null, gameRoomId: null, events: [] });
  if (restored) {
    const hg = attach(new HostGame(manager, [], { state: restored }));
    set({ game: hg.hostView(), gameRoomId: manager.roomId });
    hg.onSnapshot?.(hg.state);
  }
}

export const useStore = create<Store>((set, get) => ({
  screen: 'home',
  role: 'none',
  lobby: null,
  selfId: null,
  pin: null,
  guest: null,
  hostSession: null,
  guestSession: null,
  hostGame: null,
  savedGame: null,
  savedSeat: null,
  game: null,
  gameRoomId: null,
  events: [],
  gameError: null,

  dispatch: (a) => {
    const { role, hostGame, guestSession } = get();
    if (role === 'host' && hostGame) {
      const r = hostGame.dispatchLocal(a);
      if (!r.ok) set({ gameError: r.error });
    } else if (role === 'guest') guestSession?.manager?.sendAction({ ...a });
  },
  clearError: () => set({ gameError: null }),

  go: (screen) => set({ screen }),

  startHost: (name, tokenId) => {
    get().leave();
    void clearHostGame();
    const manager = new HostManager({ hostName: name, hostToken: tokenId });
    wireHost(set, get, manager, null);
    set({ screen: 'host-lobby' });
  },

  loadSaved: async () => {
    const [savedGame, session] = await Promise.all([loadHostGame(), loadSession()]);
    set({ savedGame, savedSeat: session ? { roomId: session.roomId, playerId: session.playerId } : null });
  },

  resumeHost: () => {
    const save = get().savedGame;
    if (!save) return;
    get().leave();
    const manager = new HostManager({
      hostName: save.hostName,
      hostToken: save.hostToken,
      roomId: save.roomId,
      hostId: save.hostId,
      pin: save.pin,
      restore: save.seats,
    });
    wireHost(set, get, manager, save.state);
    set({ screen: 'play' });
  },

  takeOver: () => {
    const { game, lobby, selfId } = get();
    if (!game || !lobby || !selfId) return;
    const me = game.players.find((p) => p.id === selfId);
    if (!me) return;
    const players = game.players.map((p) => ({
      id: p.id,
      name: p.name,
      tokenId: p.tokenId as LobbyPlayer['tokenId'],
      ready: true,
      connected: p.id === selfId,
      isHost: p.id === selfId,
    }));
    get().leave();
    const manager = new HostManager({
      hostName: me.name,
      hostToken: me.tokenId,
      hostId: selfId,
      roomId: newId(6),
      pin: newPin(),
      restore: { players, secrets: {}, version: lobby.version },
    });
    wireHost(set, get, manager, restoreFromPublic(game, randomSeed()));
    set({ screen: 'play' });
  },

  skipOffline: (playerId) => {
    const r = get().hostGame?.skipOffline(playerId);
    if (r && !r.ok) set({ gameError: r.error });
  },

  startGuest: () => {
    get().leave();
    return openGuest(set, get, undefined);
  },

  reconnect: () => {
    const { selfId, savedSeat, guestSession, hostGame } = get();
    const keep = selfId ?? savedSeat?.playerId;
    if (hostGame) return;
    guestSession?.dispose();
    openGuest(set, get, keep, true);
  },

  leave: () => {
    const { hostSession, guestSession, role } = get();
    hostSession?.dispose();
    if (role === 'guest') {
      guestSession?.manager?.leave();
      void clearSession();
    }
    guestSession?.dispose();
    set({ role: 'none', hostGame: null, game: null, gameRoomId: null, events: [], gameError: null, lobby: null, selfId: null, pin: null, guest: null, hostSession: null, guestSession: null, screen: 'home' });
  },
}));
