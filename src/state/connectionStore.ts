import { create } from 'zustand';
import { HostManager } from '../multiplayer/HostManager';
import { GuestState } from '../multiplayer/GuestManager';
import { GuestSession, HostSession } from '../multiplayer/P2PManager';
import { getIceServers } from '../multiplayer/config';
import type { PublicLobby, TokenId } from '../multiplayer/lobby';
import type { Action, GameEvent, PublicState } from '../engine';
import { HostGame } from '../game/HostGame';
import { clearSession, loadSession, saveSession } from '../persistence/IndexedDBManager';

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
  events: GameEvent[];
  gameError: string | null;
  dispatch: (a: Action) => void;
  clearError: () => void;
  go: (s: Screen) => void;
  startHost: (name: string, tokenId: TokenId) => void;
  startGuest: () => GuestSession;
  leave: () => void;
}

function isPublicState(x: unknown): x is PublicState {
  const g = x as PublicState | undefined;
  return !!g && typeof g === 'object' && typeof g.version === 'number' && Array.isArray(g.players) && !!g.turn && typeof g.turn === 'object' && !!g.props;
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
  game: null,
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
    const manager = new HostManager({ hostName: name, hostToken: tokenId });
    const session = new HostSession(manager, { iceServers: getIceServers() });
    manager.onChange = (lobby) => set({ lobby });
    manager.onEvent = (e) => {
      if (e.type === 'started') {
        const hg = new HostGame(
          manager,
          manager.publicLobby().players.map((p) => ({ id: p.id, name: p.name, tokenId: p.tokenId })),
        );
        hg.onView = (view, events) => set({ game: view, events, gameError: null });
        set({ hostGame: hg, screen: 'play' });
        hg.publishAll();
      } else get().hostGame?.handleHostEvent(e);
    };
    manager.startLivenessMonitor();
    set({
      role: 'host',
      hostSession: session,
      lobby: manager.publicLobby(),
      selfId: manager.hostId,
      pin: manager.pin,
      screen: 'host-lobby',
    });
  },

  startGuest: () => {
    get().leave();
    const session = new GuestSession({
      rtc: { iceServers: getIceServers() },
      onGame: (m) => {
        if (m.error) set({ gameError: m.error });
        if (!isPublicState(m.game)) return;
        const cur = get().game;
        if (cur && m.game.version < cur.version) return; // stale
        set({ game: m.game, events: Array.isArray(m.events) ? (m.events as GameEvent[]) : [], gameError: null });
      },
      loadSaved: loadSession,
      saveSession: (s) => void saveSession(s),
      onState: (s) => {
        set({ guest: s, lobby: s.lobby ?? get().lobby, selfId: s.selfId });
        const screen = get().screen;
        if (s.started && screen !== 'play') set({ screen: 'play' });
        else if (s.status === 'joined' && screen === 'join') set({ screen: 'guest-lobby' });
        if (s.status === 'rejected') void clearSession();
      },
    });
    set({ role: 'guest', guestSession: session, guest: null, lobby: null, screen: 'join' });
    return session;
  },

  leave: () => {
    const { hostSession, guestSession, role } = get();
    hostSession?.dispose();
    if (role === 'guest') {
      guestSession?.manager?.leave();
      void clearSession();
    }
    guestSession?.dispose();
    set({ role: 'none', hostGame: null, game: null, events: [], gameError: null, lobby: null, selfId: null, pin: null, guest: null, hostSession: null, guestSession: null, screen: 'home' });
  },
}));
