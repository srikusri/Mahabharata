import { ReactNode } from 'react';
import { GROUP_COLOR, SPACES, Space, gridPos } from '../../engine/board';
import type { TokenId } from '../../multiplayer/lobby';
import { TOKEN_STYLE } from '../Player/tokens';
import { PanZoom } from './PanZoom';

export interface Ownership {
  color: string;
  level: number;
  mortgaged: boolean;
}

export interface BoardToken {
  id: string;
  tokenId: TokenId;
  position: number;
  name: string;
}

const KIND_BG: Record<string, string> = {
  go: 'linear-gradient(135deg,#B02A33,#6F131C)',
  daiva: 'linear-gradient(135deg,#1F3A82,#0E1D4A)',
  sankat: 'linear-gradient(135deg,#5A2478,#2E1043)',
  exile: '#EAF0DC',
  park: '#FAEFC9',
  goexile: '#F2DAD3',
};
const DARK = new Set(['go', 'daiva', 'sankat']);
const LABEL: Record<string, string> = {
  go: 'COLLECT 200',
  exile: 'EXILE',
  park: 'REST',
  goexile: 'EXILE!',
  daiva: 'DAIVA',
  sankat: 'DHARMA SANKAT',
  ratha: 'RATHA',
  astra: 'ASTRA',
  tax: 'ROYAL TAX',
};

/** Soft-hyphen break points so long names wrap at syllables on the narrow top/bottom tiles. */
const SOFT = '­';
const BREAKS: Record<string, string> = {
  Khandavaprastha: `Khandava${SOFT}prastha`,
  Indraprastha: `Indra${SOFT}prastha`,
  'Nandighosha Ratha': `Nandi${SOFT}ghosha Ratha`,
  Viratanagara: `Virata${SOFT}nagara`,
  Pataliputra: `Patali${SOFT}putra`,
  Purushapura: `Purusha${SOFT}pura`,
  Hastinapura: `Hastina${SOFT}pura`,
};
const label = (name: string) => BREAKS[name] ?? name;

function Tile({ s, tokens, active, own }: { s: Space; tokens: BoardToken[]; active: boolean; own?: Ownership }) {
  const { row, col, side, corner } = gridPos(s.index);
  const dark = DARK.has(s.kind);
  const bg = KIND_BG[s.kind] ?? '#FBF7EC';
  // The colour band faces the centre of the board.
  const flex = { bottom: 'flex-col', top: 'flex-col-reverse', left: 'flex-row-reverse', right: 'flex-row' }[side];
  const band = s.kind === 'prop' && s.group;
  return (
    <div
      data-space={s.index}
      className={`relative flex overflow-hidden ${flex} ${active ? 'ring-[0.35cqw] ring-gold-light z-10' : ''}`}
      style={{
        gridRow: row + 1,
        gridColumn: col + 1,
        background: bg,
        border: '0.12cqw solid #9A8250',
        color: dark ? '#E9D091' : '#2B2114',
      }}
    >
      {band && (
        <div
          style={{
            background: GROUP_COLOR[s.group!],
            [side === 'bottom' || side === 'top' ? 'height' : 'width']: '22%',
            flexShrink: 0,
          }}
        />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-[0.3cqw] text-center leading-[1.15]">
        <div
          className="font-bold uppercase"
          style={{ fontSize: corner ? '1.35cqw' : '1.05cqw', hyphens: 'manual', overflowWrap: 'break-word' }}
        >
          {s.kind === 'prop' || s.kind === 'ratha' || s.kind === 'astra' || corner ? label(s.name) : LABEL[s.kind]}
        </div>
        {s.price !== undefined && s.kind !== 'tax' && (
          <div style={{ fontSize: '1.05cqw' }} className="mt-[0.2cqw] font-semibold">
            {s.price} S
          </div>
        )}
        {(s.kind === 'tax' || corner) && (
          <div style={{ fontSize: '0.95cqw' }} className="mt-[0.2cqw] italic opacity-80">
            {s.kind === 'tax' ? 'Pay 100 S' : LABEL[s.kind]}
          </div>
        )}
      </div>
      {own && (
        <div
          data-owner
          className="absolute left-0 right-0 top-0 flex items-center justify-center gap-[0.15cqw]"
          style={{ background: own.color, height: '1.5cqw', opacity: own.mortgaged ? 0.55 : 1 }}
        >
          {own.mortgaged ? (
            <b style={{ fontSize: '1cqw', color: '#0E1A33' }}>MORTGAGED</b>
          ) : own.level === 5 ? (
            <b style={{ fontSize: '1.2cqw', color: '#0E1A33' }}>MAHAL</b>
          ) : (
            Array.from({ length: own.level }, (_, i) => (
              <i key={i} style={{ width: '0.8cqw', height: '0.8cqw', background: '#0E1A33', borderRadius: '50%' }} />
            ))
          )}
        </div>
      )}
      {tokens.length > 0 && (
        <div className="absolute bottom-[0.2cqw] left-0 right-0 flex flex-wrap justify-center gap-[0.15cqw]">
          {tokens.map((t) => (
            <span
              key={t.id}
              title={t.name}
              className="flex items-center justify-center rounded-full font-bold text-navy"
              style={{
                width: '1.9cqw',
                height: '1.9cqw',
                fontSize: '1.15cqw',
                background: TOKEN_STYLE[t.tokenId].color,
                border: '0.18cqw solid #0E1A33',
              }}
            >
              {TOKEN_STYLE[t.tokenId].letter}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Board({
  tokens = [],
  activeIndex,
  center,
  ownership = {},
}: {
  tokens?: BoardToken[];
  activeIndex?: number;
  center?: ReactNode;
  ownership?: Record<number, Ownership>;
}) {
  return (
    <PanZoom>
      <div
        className="absolute inset-0 bg-[#FBF7EC]"
        style={{
          containerType: 'inline-size',
          display: 'grid',
          gridTemplateColumns: '1.62fr repeat(9, 1fr) 1.62fr',
          gridTemplateRows: '1.62fr repeat(9, 1fr) 1.62fr',
        }}
      >
        {SPACES.map((s) => (
          <Tile key={s.index} s={s} own={ownership[s.index]} active={activeIndex === s.index} tokens={tokens.filter((t) => t.position === s.index)} />
        ))}
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{
            gridRow: '2 / 11',
            gridColumn: '2 / 11',
            background: 'radial-gradient(ellipse at 50% 40%, #22397A, #0E1A33 75%)',
            border: '0.4cqw solid #BF9A45',
            color: '#E9D091',
          }}
        >
          <div className="font-bold tracking-[0.35em]" style={{ fontSize: '5.2cqw' }}>
            MAHABHARATA
          </div>
          <div className="italic text-ivory" style={{ fontSize: '1.9cqw' }}>
            The Battle for Dharma &amp; Sovereign Realm
          </div>
          <div className="mt-[2cqw] flex w-full justify-center" style={{ fontSize: '1.6cqw' }}>
            {center}
          </div>
        </div>
      </div>
    </PanZoom>
  );
}
