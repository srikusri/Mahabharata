import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, publicView, END_VOTE_AFTER_ROUNDS } from '../../engine';
import type { GameEvent } from '../../engine';
import { CardModal } from './CardModal';
import { EndGamePanel } from './EndGamePanel';
import { LastAction } from './LastAction';

const base = () => {
  const s = createGame([{ id: 'a', name: 'Arjuna', tokenId: 'bow' }, { id: 'b', name: 'Bhima', tokenId: 'crown' }, { id: 'c', name: 'Karna', tokenId: 'horse' }], 3);
  return s;
};
const noop = () => undefined;
const card: GameEvent = { seq: 5, type: 'card', text: 'Arjuna draws X', playerId: 'a', data: { deck: 'daiva', title: 'Gandiva', text: 'Collect 100 S' } };
const pay: GameEvent = { seq: 6, type: 'pay', text: 'Bhima pays 50 S to Arjuna (Gandiva)', playerId: 'b' };

describe('CardModal', () => {
  it('names the player whose card it is, and what it did', () => {
    const html = renderToStaticMarkup(<CardModal event={card} effects={[pay]} who="Arjuna" mine={false} onClose={noop} />);
    expect(html).toContain('Arjuna drew this card');
    expect(html).toContain('Gandiva');
    expect(html).toContain('Bhima pays 50 S to Arjuna');
    expect(html).toContain('>Close<');
  });
  it('tells the drawer it is theirs', () => {
    const html = renderToStaticMarkup(<CardModal event={card} effects={[]} who="Arjuna" mine onClose={noop} />);
    expect(html).toContain('You drew this card');
    expect(html).toContain('>OK<');
  });
  it('marks a private peek as only theirs', () => {
    const peek: GameEvent = { seq: 7, type: 'peek', text: 'You see the top card', playerId: 'a', private: 'a' };
    expect(renderToStaticMarkup(<CardModal event={peek} effects={[]} who="Arjuna" mine onClose={noop} />)).toContain('Only you can see this');
  });
});

describe('EndGamePanel', () => {
  it('is hidden before 100 rounds', () => {
    const s = base();
    s.turn.round = END_VOTE_AFTER_ROUNDS;
    expect(renderToStaticMarkup(<EndGamePanel game={publicView(s)} selfId="a" send={noop} />)).toBe('');
  });
  it('offers a proposal after 100 rounds', () => {
    const s = base();
    s.turn.round = END_VOTE_AFTER_ROUNDS + 1;
    expect(renderToStaticMarkup(<EndGamePanel game={publicView(s)} selfId="a" send={noop} />)).toContain('propose-end');
  });
  it('shows who agreed and lets the others agree or decline', () => {
    const s = base();
    s.turn.round = END_VOTE_AFTER_ROUNDS + 1;
    s.endVote = { by: 'a', agreed: ['a'] };
    const other = renderToStaticMarkup(<EndGamePanel game={publicView(s)} selfId="b" send={noop} />);
    expect(other).toContain('Arjuna proposes to end the game');
    expect(other).toContain('agree-end');
    expect(other).toContain('decline-end');
    const proposer = renderToStaticMarkup(<EndGamePanel game={publicView(s)} selfId="a" send={noop} />);
    expect(proposer).toContain('withdraw-end');
    expect(proposer).toContain('1 of 3');
  });
});

describe('LastAction', () => {
  it('lists the latest events', () => {
    const s = base();
    s.log = [pay, { seq: 7, type: 'buy', text: 'Arjuna buys Anarta for 280 S', playerId: 'a' }];
    const html = renderToStaticMarkup(<LastAction game={publicView(s)} />);
    expect(html).toContain('Bhima pays 50 S to Arjuna');
    expect(html).toContain('Arjuna buys Anarta');
  });
  it('renders nothing for an empty log', () => {
    expect(renderToStaticMarkup(<LastAction game={publicView(base())} />)).toBe('');
  });
});
