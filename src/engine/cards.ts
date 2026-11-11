/** Card definitions (print PDF p11-12). Effects are applied in engine.ts, keyed by card id. */
import type { DeckId } from './types';

export interface CardDef {
  id: string;
  deck: DeckId;
  title: string;
  text: string;
  /** Kept by the player until used (rather than discarded after drawing). */
  kept?: boolean;
}

const daiva = (key: string, title: string, text: string, kept = false): CardDef => ({ id: `daiva:${key}`, deck: 'daiva', title, text, kept });
const sankat = (key: string, title: string, text: string): CardDef => ({ id: `sankat:${key}`, deck: 'sankat', title, text });

export const CARD_LIST: readonly CardDef[] = [
  daiva('krishna', "Krishna's Counsel", 'Escape forest exile immediately without paying fine. Keep this card.', true),
  daiva('durvasa', "Sage Durvasa's Boon", 'Receive a royal tribute: collect 50 Suvarna from each player.'),
  daiva('karna', "Karna's Charity", 'Surya Deva bestows sacred gold: collect 150 Suvarna from the Bank.'),
  daiva('parashurama', 'Curse of Parashurama', 'Pay 100 Suvarna to the Treasury for purification ceremonies.'),
  daiva('chariot', 'Divine Chariot Speed', 'Advance directly to Rajasooya Yagna (GO) and collect 200 Suvarna.'),
  daiva('indra', "Indra's Armor", 'Negate the next rent payment you owe a rival. Keep this card.', true),
  daiva('hanuman', "Hanuman's Strength", 'Double the next rent you collect from any property. Keep this card.', true),
  daiva('draupadi', "Draupadi's Blessing", 'All players gift you 25 Suvarna.'),
  sankat('vidura', "Vidura's Warning", 'Move to Amaravati (Free Parking) and rest.'),
  sankat('dicegame', 'Hastinapura Dice Game', 'A tragic gamble: go directly to Vanavasa (Exile). Do not collect salary.'),
  sankat('ashrama', 'Ashrama Renovation', 'Pay 25 Suvarna per Ashrama you own.'),
  sankat('yaksha', "Yaksha's Questions", 'Answer truly and claim a divine reward: collect 100 Suvarna.'),
  sankat('coronation', 'Royal Coronation', 'Allied chieftains present gifts: collect 50 Suvarna from the Bank.'),
  sankat('lac', 'Lac Palace Escape', 'Finance an underground tunnel: pay 75 Suvarna to the Bank.'),
  sankat('bhishma', "Bhishma's Vow", 'Skip your next turn in meditation.'),
  sankat('sanjaya', "Sanjaya's Vision", 'Peek at the top card of either deck and return it.'),
];

export const CARDS: Readonly<Record<string, CardDef>> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]));
export const DECK_IDS: Record<DeckId, string[]> = {
  daiva: CARD_LIST.filter((c) => c.deck === 'daiva').map((c) => c.id),
  sankat: CARD_LIST.filter((c) => c.deck === 'sankat').map((c) => c.id),
};
