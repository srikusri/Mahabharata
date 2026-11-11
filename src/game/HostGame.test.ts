import { describe, expect, it } from 'vitest';
import { GuestManager } from '../multiplayer/GuestManager';
import { HostManager } from '../multiplayer/HostManager';
import { createLoopbackPair } from '../multiplayer/Transport';
import { HostGame } from './HostGame';

const tick = () => new Promise((r) => setTimeout(r, 0));

async function table() {
  const host = new HostManager({ hostName: 'Host', hostToken: 'crown', roomId: 'ROOM12', pin: '1234' });
  const guests: GuestManager[] = [];
  for (const [id, token] of [['G1', 'bow'], ['G2', 'horse']] as const) {
    const [h, g] = createLoopbackPair();
    const guest = new GuestManager({ roomId: host.roomId, hostId: host.hostId, playerId: id });
    host.attachTransport(h);
    guest.attachTransport(g);
    await tick();
    guest.join({ pin: '1234', name: id, tokenId: token });
    await tick();
    guest.setReady(true);
    await tick();
    guests.push(guest);
  }
  const lobby = host.publicLobby();
  const game = new HostGame(host, lobby.players.map((p) => ({ id: p.id, name: p.name, tokenId: p.tokenId })), { seed: 7 });
  host.onEvent = (e) => game.handleHostEvent(e);
  const views: Record<string, any[]> = { G1: [], G2: [] };
  const errors: Record<string, string[]> = { G1: [], G2: [] };
  guests.forEach((g) => (g.onGame = (m) => (m.game ? views[g.playerId].push(m.game) : errors[g.playerId].push(m.error!))));
  host.startGame();
  game.publishAll();
  await tick();
  return { host, game, guests, views, errors };
}

describe('host-authoritative game over the transport', () => {
  it('sends every guest a state with no secrets, and under the 64KB limit', async () => {
    const { views } = await table();
    const v = views.G1.at(-1);
    expect(v.turn.phase).toBe('roll');
    expect(v.rng).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain('daiva:krishna');
    expect(JSON.stringify(v).length).toBeLessThan(20000);
  });

  it('applies a guest action only on their turn; rejections come back as errors', async () => {
    const { game, guests, errors, views } = await table();
    guests[0].sendAction({ type: 'ROLL' }); // G1 is not first (host is)
    await tick();
    expect(errors.G1[0]).toMatch(/Not your turn/);
    expect(game.state.version).toBe(0);
    game.dispatchLocal({ type: 'ROLL' });
    await tick();
    expect(views.G1.at(-1).version).toBe(1);
    expect(views.G2.at(-1).version).toBe(1);
  });

  it('ignores garbage and cannot be told who is acting', async () => {
    const { game, guests, errors } = await table();
    guests[0].sendAction({ type: 'ROLL', playerId: 'H-whatever' });
    guests[0].sendAction({ type: 'BUILD', space: 'x' });
    await tick();
    expect(errors.G1.length).toBe(2);
    expect(game.state.version).toBe(0);
  });

  it('a resynced guest gets the current view', async () => {
    const { game, guests, views } = await table();
    game.dispatchLocal({ type: 'ROLL' });
    await tick();
    const before = views.G2.length;
    guests[1].resync();
    await tick();
    expect(views.G2.length).toBe(before + 1);
  });
});
