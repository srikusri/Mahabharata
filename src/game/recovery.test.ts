import { describe, expect, it } from 'vitest';
import { restoreFromPublic } from '../engine';
import { GuestManager } from '../multiplayer/GuestManager';
import { HostManager } from '../multiplayer/HostManager';
import { createLoopbackPair } from '../multiplayer/Transport';
import { HostGame } from './HostGame';

const tick = () => new Promise((r) => setTimeout(r, 0));

async function table() {
  const host = new HostManager({ hostName: 'Host', hostToken: 'crown', roomId: 'ROOM12', hostId: 'HOST', pin: '1234' });
  const guests: Record<string, GuestManager> = {};
  const secrets: Record<string, string> = {};
  for (const [id, token] of [['G1', 'bow'], ['G2', 'horse']] as const) {
    const [h, g] = createLoopbackPair();
    const guest = new GuestManager({ roomId: host.roomId, hostId: host.hostId, playerId: id });
    guest.onSession = (s) => (secrets[id] = s.secret);
    host.attachTransport(h);
    guest.attachTransport(g);
    await tick();
    guest.join({ pin: '1234', name: id, tokenId: token });
    await tick();
    guest.setReady(true);
    await tick();
    guests[id] = guest;
  }
  const game = new HostGame(host, host.publicLobby().players.map((p) => ({ id: p.id, name: p.name, tokenId: p.tokenId })), { seed: 3 });
  host.onEvent = (e) => game.handleHostEvent(e);
  const views: Record<string, any> = {};
  for (const g of Object.values(guests)) g.onGame = (m) => m.game && (views[g.playerId] = m.game);
  host.startGame();
  game.publishAll();
  await tick();
  game.dispatchLocal({ type: 'ROLL' });
  await tick();
  return { host, game, guests, views, secrets };
}

async function connect(host: HostManager, id: string) {
  const [h, g] = createLoopbackPair();
  const guest = new GuestManager({ roomId: host.roomId, hostId: host.hostId, playerId: id });
  host.attachTransport(h);
  guest.attachTransport(g);
  await tick();
  return guest;
}

describe('host reload: restore from a saved snapshot', () => {
  it('guests resume their seat with the saved secret and get the current game', async () => {
    const { host, game, secrets } = await table();
    // Persist as JSON exactly as IndexedDB would, then "reload".
    const saved = JSON.parse(JSON.stringify({ seats: host.exportSeats(), state: game.state }));
    host.dispose();

    const host2 = new HostManager({ hostName: 'Host', hostToken: 'crown', roomId: 'ROOM12', hostId: 'HOST', pin: '1234', restore: saved.seats });
    const game2 = new HostGame(host2, [], { state: saved.state });
    host2.onEvent = (e) => game2.handleHostEvent(e);
    expect(host2.publicLobby().players.filter((p) => p.connected).map((p) => p.id)).toEqual(['HOST']);

    const g1 = await connect(host2, 'G1');
    let got: any = null;
    g1.onGame = (m) => (got = m.game);
    g1.join({ pin: '', name: 'G1', tokenId: 'bow' }, secrets.G1);
    await tick();
    expect(g1.getState().status).toBe('joined');
    expect(got.version).toBe(game2.state.version);
    expect(got.turn).toEqual(game2.state.turn);
    expect(host2.publicLobby().players.find((p) => p.id === 'G1')!.connected).toBe(true);
  });

  it('a wrong secret cannot take a seat, but the room PIN can (3 tries)', async () => {
    const { host, game } = await table();
    const saved = JSON.parse(JSON.stringify({ seats: host.exportSeats(), state: game.state }));
    host.dispose();
    const host2 = new HostManager({ hostName: 'Host', hostToken: 'crown', roomId: 'ROOM12', hostId: 'HOST', pin: '1234', restore: saved.seats });
    new HostGame(host2, [], { state: saved.state });
    const bad = await connect(host2, 'G2');
    bad.join({ pin: '0000', name: 'G2', tokenId: 'horse' }, 'f'.repeat(32));
    await tick();
    expect(bad.getState().joinError).toBe('BAD_PIN');
    const good = await connect(host2, 'G2');
    good.join({ pin: '1234', name: 'G2', tokenId: 'horse' });
    await tick();
    expect(good.getState().status).toBe('joined');
  });

  it('a stranger cannot claim the host seat or an online seat', async () => {
    const { host, game } = await table();
    const saved = JSON.parse(JSON.stringify({ seats: host.exportSeats(), state: game.state }));
    host.dispose();
    const host2 = new HostManager({ hostName: 'Host', hostToken: 'crown', roomId: 'ROOM12', hostId: 'HOST', pin: '1234', restore: saved.seats });
    new HostGame(host2, [], { state: saved.state });
    const a = await connect(host2, 'HOST');
    a.join({ pin: '1234', name: 'x', tokenId: 'conch' });
    await tick();
    expect(a.getState().joinError ?? a.getState().fatalReason).toBe('ID_IN_USE');
    const g = await connect(host2, 'G1');
    g.join({ pin: '1234', name: 'G1', tokenId: 'bow' });
    await tick();
    const dup = await connect(host2, 'G1');
    dup.join({ pin: '1234', name: 'G1', tokenId: 'bow' });
    await tick();
    expect(dup.getState().joinError ?? dup.getState().fatalReason).toBe('ID_IN_USE');
  });
});

describe('host migration: a guest takes over', () => {
  it('rebuilds the room from its view; the other player reclaims their seat with the new PIN and play continues', async () => {
    const { host, game, guests, views } = await table();
    const before = game.state;
    const g1View = views.G1;
    host.dispose(); // the host's phone dies
    await tick();
    expect(guests.G1.getState().status).toBe('closed');

    // G1 takes over.
    const newHost = new HostManager({
      hostName: 'G1',
      hostToken: 'bow',
      hostId: 'G1',
      roomId: 'NEWROOM',
      pin: '9876',
      restore: {
        version: 1,
        secrets: {},
        players: g1View.players.map((p: any) => ({ id: p.id, name: p.name, tokenId: p.tokenId, ready: true, connected: false, isHost: false })),
      },
    });
    const newGame = new HostGame(newHost, [], { state: restoreFromPublic(g1View, 777) });
    newHost.onEvent = (e) => newGame.handleHostEvent(e);
    expect(newGame.state.turn).toEqual(before.turn);
    expect(newGame.state.players.map((p) => p.cash)).toEqual(before.players.map((p) => p.cash));

    // G2 rejoins the new room keeping its id; wrong PIN first.
    const g2 = await connect(newHost, 'G2');
    let got: any = null;
    g2.onGame = (m) => (got = m.game);
    g2.join({ pin: '0000', name: 'G2', tokenId: 'horse' });
    await tick();
    expect(g2.getState().joinError).toBe('BAD_PIN');
    g2.join({ pin: '9876', name: 'G2', tokenId: 'horse' });
    await tick();
    expect(g2.getState().status).toBe('joined');
    expect(got.version).toBe(newGame.state.version);

    // Play continues under the new host: whoever is up acts; a guest action works through the new room.
    const current = newGame.state.players[newGame.state.turn.index].id;
    const errs: string[] = [];
    g2.onGame = (m) => m.error && errs.push(m.error);
    if (current === 'G2') {
      g2.sendAction({ type: 'END_TURN' });
      await tick();
    } else {
      g2.sendAction({ type: 'ROLL' });
      await tick();
      expect(errs[0]).toMatch(/Not your turn/);
    }
  });

  it('the old host can no longer act in the new room', async () => {
    const { host, game, views } = await table();
    host.dispose();
    const newHost = new HostManager({
      hostName: 'G1', hostToken: 'bow', hostId: 'G1', roomId: 'NEWROOM', pin: '9876',
      restore: { version: 1, secrets: {}, players: views.G1.players.map((p: any) => ({ id: p.id, name: p.name, tokenId: p.tokenId, ready: true, connected: false, isHost: false })) },
    });
    const ng = new HostGame(newHost, [], { state: restoreFromPublic(views.G1, 1) });
    newHost.onEvent = (e) => ng.handleHostEvent(e);
    const old = await connect(newHost, 'HOST');
    old.join({ pin: '1234', name: 'Host', tokenId: 'crown' }); // old PIN, wrong
    await tick();
    expect(old.getState().status).not.toBe('joined');
    expect(game.state.version).toBeGreaterThan(0);
  });
});

describe('skip offline player', () => {
  it('only skips when the game is waiting on an offline player', async () => {
    const { host, game, guests } = await table();
    expect(game.skipOffline('G1').ok).toBe(false); // online
    // find whose turn it is, then drop them
    const cur = game.state.players[game.state.turn.index].id;
    if (cur === 'HOST') {
      game.dispatchLocal({ type: 'END_TURN' }).ok || game.dispatchLocal({ type: 'DECLINE' });
    }
    const target = game.state.players[game.state.turn.index].id;
    if (target !== 'HOST') {
      guests[target].dispose();
      await tick();
      const r = game.skipOffline(target);
      expect(r.ok).toBe(true);
      expect(game.state.players[game.state.turn.index].id).not.toBe(target);
    }
    expect(host.publicLobby().phase).toBe('playing');
  });
});
