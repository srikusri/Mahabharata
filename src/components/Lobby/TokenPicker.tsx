import { TOKENS, TokenId } from '../../multiplayer/lobby';
import { TOKEN_STYLE } from '../Player/tokens';

export function TokenPicker({
  value,
  onChange,
  taken = [],
}: {
  value: TokenId | null;
  onChange: (t: TokenId) => void;
  taken?: string[];
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Choose your token">
      {TOKENS.map((t) => {
        const isTaken = taken.includes(t.id);
        const selected = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={isTaken}
            onClick={() => onChange(t.id)}
            data-token={t.id}
            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition disabled:opacity-30 ${
              selected ? 'border-gold-light bg-gold/20' : 'border-gold/30'
            }`}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full font-bold text-navy"
              style={{ background: TOKEN_STYLE[t.id].color }}
            >
              {TOKEN_STYLE[t.id].letter}
            </span>
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
