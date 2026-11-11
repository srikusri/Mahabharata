import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostManager } from './HostManager';
import { GuestManager } from './GuestManager';
import { Sequencer } from './MessageProtocol';
import { createLoopbackPair, Transport } from './Transport';

const tick = () => new Promise((r) => setTimeout(r, 0));

function setup(now?: () => number) {
  const host = new HostManager({ hostName: 'Yudhishthira', hostToken: 'crown', roomId: 'ROOM12', pin: '4821', now });
  const guests: GuestManager[] = [];
  const hostSides: Transport[] = [];
  const connect = (id?: string) => {
    const [h, g] = createLoopbackPair();
    const guest = new GuestManager({ roomId: host.roomId, hostId: host.hostId, playerId: id, now });
    host.attachTransport(h);
    guest.attachTransport(g);
    guests.push(guest);
    hostSides.push(h);
    return { guest, hostSide: h, guestSide: g };
  };
  return { host, connect, guests, hostSides };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('joining', () => {
  it('shows an unjoined guest a lobby preview with no PIN in it', async () => {
    const { connect } = setup();
    const { guest } = connect();
    await tick();
    const s = guest.getState();
    expect(s.status).toBe('open');
    expect(s.lobby?.players).toHaveLength(1);
    expect(JSON.stringify(s.lobby)).not.toContain('4821');
  });

  it('admits a guest with the right PIN and gives them a resume secret', async () => {
    const { host, connect } = setup();
    const { guest } = connect('GUEST001');
    const saved = vi.fn();
    guest.onSession = saved;
    await tick();
    guest.join({ pin: '4821', name: 'Arjuna', tokenId: 'bow' });
    await tick();
    expect(guest.getState().status).toBe('joined');
    expect(host.publicLobby().players.map((p) => p.name)).toEqual(['Yudhishthira', 'Arjuna']);
    expect(saved).toHaveBeenCalledOnce();
    expect(saved.mock.calls[0][0].secret).toMatch(/^[0-9a-f]{32}$/);
  });

  it('rejects a wrong PIN without closing, then locks out after 3 attempts', async () => {
    const { host, connect } = setup();
    const { guest } = connect('GUEST001');
    await tick();
    for (let i = 0; i < 2; i++) {
      guest.join({ pin: '0000', name: 'Eve', tokenId: 'horse' });
      await tick();
      expect(guest.getState().status).toBe('open');
      expect(guest.getState().joinError).toBe('BAD_PIN');
    }
    guest.join({ pin: '0000', name: 'Eve', tokenId: 'horse' });
    await tick();
    expect(guest.getState().status).toBe('rejected');
    expect(guest.getState().fatalReason).toBe('TOO_MANY_ATTEMPTS');
    expect(host.publicLobby().players).toHaveLength(1);
  });

  it('lets a guest fix a mistake and join on the same connection', async () => {
    const { host, connect } = setup();
    const { guest } = connect('GUEST001');
    await tick();
    guest.join({ pin: '9999', name: 'Bhima', tokenId: 'horse' });
    await tick();
    guest.join({ pin: '4821', name: 'Bhima', tokenId: 'horse' });
    await tick();
    expect(guest.getState().status).toBe('joined');
    expect(host.publicLobby().players).toHaveLength(2);
  });

  it('rejects duplicate tokens, bad names and bad tokens (non-fatal)', async () => {
    const { host, connect } = setup();
    const { guest } = connect('GUEST001');
    await tick();
    guest.join({ pin: '4821', name: 'Bhima', tokenId: 'crown' }); // host has the crown
    await tick();
    expect(guest.getState().joinError).toBe('TOKEN_TAKEN');
    guest.join({ pin: '4821', name: '   ', tokenId: 'horse' });
    await tick();
    expect(guest.getState().joinError).toBe('BAD_NAME');
    guest.join({ pin: '4821', name: 'Bhima', tokenId: 'dragon' });
    await tick();
    expect(guest.getState().joinError).toBe('BAD_TOKEN');
    expect(host.publicLobby().players).toHaveLength(1);
  });

  it('sanitises names', async () => {
    const { host, connect } = setup();
    const { guest } = connect('GUEST001');
    await tick();
    guest.join({ pin: '4821', name: '  <b>Nakula</b>\u0000   the   wise and very long name indeed ', tokenId: 'horse' });
    await tick();
    const name = host.publicLobby().players[1].name;
    expect(name).not.toMatch(/[<>\u0000]/);
    expect(name.length).toBeLessThanOrEqual(20);
  });

  it('enforces the 6 player maximum', async () => {
    const { host, connect } = setup();
    const toks = ['bow', 'horse', 'elephant', 'conch', 'chariot'];
    for (let i = 0; i < 5; i++) {
      const { guest } = connect(`GUEST00${i}`);
      await tick();
      guest.join({ pin: '4821', name: `P${i}`, tokenId: toks[i] });
      await tick();
    }
    expect(host.publicLobby().players).toHaveLength(6);
    const { guest: extra } = connect('GUEST009');
    await tick();
    extra.join({ pin: '4821', name: 'Late', tokenId: 'bow' });
    await tick();
    expect(extra.getState().fatalReason).toBe('ROOM_FULL');
    expect(host.publicLobby().players).toHaveLength(6);
  });

  it('refuses a second connection claiming an existing id without the secret', async () => {
    const { host, connect } = setup();
    const a = connect('GUEST001').guest;
    await tick();
    a.join({ pin: '4821', name: 'Bhima', tokenId: 'horse' });
    await tick();
    const imposter = connect('GUEST001').guest;
    await tick();
    imposter.join({ pin: '4821', name: 'Bhima', tokenId: 'conch' });
    await tick();
    expect(imposter.getState().fatalReason).toBe('ID_IN_USE');
    expect(host.publicLobby().players).toHaveLength(2);
  });
});

describe('security', () => {
  it('ignores everything except PLAYER_JOIN before a peer has joined', async () => {
    const { host, connect } = setup();
    const { guestSide } = connect('GUEST001');
    await tick();
    const seq = new Sequencer('ROOM12', 'GUEST001');
    guestSide.send(JSON.stringify(seq.next('PLAYER_READY', { ready: true })));
    guestSide.send(JSON.stringify(seq.next('GAME_ACTION', { action: 'ROLL_DICE' })));
    const onEvent = vi.fn();
    host.onEvent = onEvent;
    await tick();
    expect(onEvent).not.toHaveBeenCalled();
    expect(host.publicLobby().players).toHaveLength(1);
  });

  it('ignores replayed messages', async () => {
    const { host, connect } = setup();
    const { guest, guestSide } = connect('GUEST001');
    await tick();
    guest.join({ pin: '4821', name: 'Bhima', tokenId: 'horse' });
    await tick();
    const seq = new Sequencer('ROOM12', 'GUEST001');
    // Burn through sequence numbers so these are > the guest's own counter.
    for (let i = 0; i < 10; i++) seq.next('HEARTBEAT');
    const ready = JSON.stringify(seq.next('PLAYER_READY', { ready: true }));
    const unready = JSON.stringify(seq.next('PLAYER_READY', { ready: false }));
    guestSide.send(ready);
    await tick();
    expect(host.publicLobby().players[1].ready).toBe(true);
    guestSide.send(unready);
    await tick();
    expect(host.publicLobby().players[1].ready).toBe(false);
    guestSide.send(ready); // replay of the earlier "ready"
    await tick();
    expect(host.publicLobby().players[1].ready).toBe(false);
  });

  it('ignores a joined peer that tries to speak as another sender', async () => {
    const { host, connect } = setup();
    const a = connect('GUEST001');
    await tick();
    a.guest.join({ pin: '4821', name: 'Bhima', tokenId: 'horse' });
    await tick();
    const spoof = new Sequencer('ROOM12', host.hostId); // pretend to be the host
    for (let i = 0; i < 20; i++) spoof.next('HEARTBEAT');
    a.guestSide.send(JSON.stringify(spoof.next('PLAYER_LEAVE', { rejected: 'KICKED', fatal: true })));
    await tick();
    expect(host.publicLobby().players).toHaveLength(2);
  });

  it('guests ignore messages that are not from the host', async () => {
    const { connect } = setup();
    const { guest, hostSide } = connect('GUEST001');
    await tick();
    const fake = new Sequencer('ROOM12', 'SOMEONE');
    hostSide.send(JSON.stringify(fake.next('GAME_START', {})));
    await tick();
    expect(guest.getState().started).toBe(false);
  });

  it('survives garbage on the wire', async () => {
    const { host, connect } = setup();
    const { guestSide } = connect('GUEST001');
    await tick();
    for (const junk of ['', '{', 'null', '[]', '{"type":"PLAYER_JOIN"}', 'x'.repeat(100_000)]) guestSide.send(junk);
    await tick();
    expect(host.publicLobby().players).toHaveLength(1);
  });
});

describe('ready, start, leave', () => {
  async function twoPlayers() {
    const s = setup();
    const { guest } = s.connect('GUEST001');
    await tick();
    guest.join({ pin: '4821', name: 'Arjuna', tokenId: 'bow' });
    await tick();
    return { ...s, guest };
  }

  it('cannot start alone or before everyone is ready', async () => {
    const solo = setup();
    expect(() => solo.host.startGame()).toThrow(/2 players/);
    const { host, guest } = await twoPlayers();
    expect(() => host.startGame()).toThrow(/ready/);
    guest.setReady(true);
    await tick();
    host.startGame();
    await tick();
    expect(guest.getState().started).toBe(true);
    expect(host.publicLobby().phase).toBe('playing');
  });

  it('blocks late joiners after the game starts and keeps seats of dropped players', async () => {
    const { host, guest, hostSides } = await twoPlayers();
    guest.setReady(true);
    await tick();
    host.startGame();
    await tick();
    const late = (() => {
      const [h, g] = createLoopbackPair();
      const lg = new GuestManager({ roomId: host.roomId, hostId: host.hostId, playerId: 'LATE0001' });
      host.attachTransport(h);
      lg.attachTransport(g);
      return lg;
    })();
    await tick();
    late.join({ pin: '4821', name: 'Late', tokenId: 'conch' });
    await tick();
    expect(late.getState().fatalReason).toBe('GAME_STARTED');

    hostSides[0].close(); // Arjuna's connection drops mid-game
    await tick();
    const arjuna = host.publicLobby().players.find((p) => p.name === 'Arjuna');
    expect(arjuna?.connected).toBe(false);
  });

  it('frees the seat when a player disconnects in the lobby', async () => {
    const { host, guest } = await twoPlayers();
    guest.dispose();
    await tick();
    expect(host.publicLobby().players).toHaveLength(1);
  });

  it('removes a player who leaves gracefully, and the host can kick', async () => {
    const { host, guest, connect } = await twoPlayers();
    guest.leave();
    await tick();
    expect(host.publicLobby().players).toHaveLength(1);
    const g2 = connect('GUEST002').guest;
    await tick();
    g2.join({ pin: '4821', name: 'Bhima', tokenId: 'horse' });
    await tick();
    host.kick('GUEST002');
    await tick();
    expect(g2.getState().fatalReason).toBe('KICKED');
    expect(host.publicLobby().players).toHaveLength(1);
  });

  it('only ever lets guests toggle their own ready flag', async () => {
    const { host, guest } = await twoPlayers();
    guest.setReady(true);
    await tick();
    expect(host.publicLobby().players.map((p) => p.ready)).toEqual([true, true]);
    guest.setReady(false);
    await tick();
    expect(host.publicLobby().players[1].ready).toBe(false);
    expect(host.publicLobby().players[0].ready).toBe(true);
  });
});

describe('heartbeat, liveness and resume', () => {
  it('measures round-trip time', async () => {
    let t = 1000;
    const { connect } = setup(() => t);
    const { guest } = connect('GUEST001');
    await tick();
    guest.join({ pin: '4821', name: 'Arjuna', tokenId: 'bow' });
    t = 1000;
    await tick();
    expect(guest.getState().rttMs).not.toBeNull();
    guest.dispose();
  });

  it('drops a silent peer after the liveness timeout', async () => {
    let t = 0;
    const { host, connect } = setup(() => t);
    const { guest } = connect('GUEST001');
    await tick();
    guest.join({ pin: '4821', name: 'Arjuna', tokenId: 'bow' });
    await tick();
    guest.stopHeartbeat();
    t = 10_000;
    host.checkLiveness(15_000);
    await tick();
    expect(host.publicLobby().players).toHaveLength(2);
    t = 20_000;
    host.checkLiveness(15_000);
    await tick();
    expect(host.publicLobby().players).toHaveLength(1);
    expect(guest.getState().status).toBe('closed');
  });

  it('resumes the same seat with the secret on a new connection', async () => {
    const { host, connect } = setup();
    const a = connect('GUEST001');
    let secret = '';
    a.guest.onSession = (s) => (secret = s.secret);
    await tick();
    a.guest.join({ pin: '4821', name: 'Arjuna', tokenId: 'bow' });
    await tick();
    a.guest.setReady(true);
    await tick();
    host.startGame();
    await tick();
    a.hostSide.close();
    await tick();
    expect(host.publicLobby().players[1].connected).toBe(false);

    const b = connect('GUEST001');
    await tick();
    b.guest.join({ pin: '', name: 'Arjuna', tokenId: 'bow' }, secret); // no PIN needed with the secret
    await tick();
    expect(b.guest.getState().status).toBe('joined');
    expect(b.guest.getState().started).toBe(true);
    expect(host.publicLobby().players).toHaveLength(2);
    expect(host.publicLobby().players[1].connected).toBe(true);
  });

  it('rejects a resume attempt with the wrong secret', async () => {
    const { host, connect } = setup();
    const a = connect('GUEST001').guest;
    await tick();
    a.join({ pin: '4821', name: 'Arjuna', tokenId: 'bow' });
    await tick();
    const b = connect('GUEST001').guest;
    await tick();
    b.join({ pin: '4821', name: 'Arjuna', tokenId: 'bow' }, 'f'.repeat(32));
    await tick();
    expect(b.getState().fatalReason).toBe('ID_IN_USE');
    expect(host.publicLobby().players).toHaveLength(2);
  });

  it('a resumed connection replaces the old one without marking the player offline', async () => {
    const { host, connect } = setup();
    const a = connect('GUEST001');
    let secret = '';
    a.guest.onSession = (s) => (secret = s.secret);
    await tick();
    a.guest.join({ pin: '4821', name: 'Arjuna', tokenId: 'bow' });
    await tick();
    const b = connect('GUEST001');
    await tick();
    b.guest.join({ pin: '', name: 'Arjuna', tokenId: 'bow' }, secret);
    await tick();
    await tick();
    expect(host.publicLobby().players[1].connected).toBe(true);
    expect(a.guest.getState().status).toBe('closed');
  });
});
