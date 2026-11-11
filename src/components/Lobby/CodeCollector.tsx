import { useCallback, useRef, useState } from 'react';
import { PartAssembler } from '../../multiplayer/signaling';
import { QrScanner } from './QrScanner';

/**
 * Collects one complete pairing code, either by scanning (single or
 * multi-part QR) or by pasting text. Calls onCode exactly once; remount it
 * (change its `key`) to scan again after an error.
 */
export function CodeCollector({ onCode }: { onCode: (code: string) => void }) {
  const asm = useRef(new PartAssembler());
  const done = useRef(false);
  const [progress, setProgress] = useState<{ have: number; total: number } | null>(null);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  const handleText = useCallback(
    (text: string) => {
      if (done.current) return;
      const r = asm.current.add(text);
      if (r.ignored) return;
      setProgress({ have: r.have, total: r.total });
      if (r.complete && r.code) {
        done.current = true;
        onCode(r.code);
      }
    },
    [onCode],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <QrScanner onText={handleText} />
      {progress && progress.total > 1 && (
        <div className="text-sm text-gold-light" data-testid="scan-progress">
          Scanned {progress.have} of {progress.total}
        </div>
      )}
      {!showPaste ? (
        <button className="text-sm text-gold-light underline" onClick={() => setShowPaste(true)}>
          Paste code instead
        </button>
      ) : (
        <div className="flex w-full max-w-[340px] flex-col gap-2">
          <textarea
            className="h-24 w-full rounded border border-gold/50 bg-navy p-2 text-xs text-ivory"
            placeholder="Paste the code here"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            data-testid="paste-box"
          />
          <button className="btn-ghost" disabled={!paste.trim()} onClick={() => handleText(paste)} data-testid="paste-use">
            Use code
          </button>
        </div>
      )}
    </div>
  );
}
