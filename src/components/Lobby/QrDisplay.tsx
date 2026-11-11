import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { splitForQr } from '../../multiplayer/signaling';

/**
 * Shows a pairing code as a QR. Codes that do not fit one comfortably
 * scannable QR are split and the parts are cycled automatically; the
 * scanner collects them in any order.
 */
export function QrDisplay({ code, partSize = 600 }: { code: string; partSize?: number }) {
  const parts = useMemo(() => splitForQr(code, partSize), [code, partSize]);
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setI(0);
    if (parts.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % parts.length), 1400);
    return () => clearInterval(t);
  }, [parts]);

  useEffect(() => {
    if (!canvas.current) return;
    void QRCode.toCanvas(canvas.current, parts[i % parts.length], {
      errorCorrectionLevel: 'L',
      margin: 2,
      width: 340,
      color: { dark: '#0E1A33', light: '#FFFFFF' },
    });
  }, [parts, i]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this code', code);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvas} className="w-full max-w-[340px] rounded-lg bg-white" data-testid="qr-canvas" />
      {parts.length > 1 && (
        <div className="text-sm text-gold-light" data-testid="qr-part">
          Code {(i % parts.length) + 1} of {parts.length}, keep the camera on it until it finishes
        </div>
      )}
      <button className="text-sm text-gold-light underline" onClick={copy}>
        {copied ? 'Copied' : 'Copy code as text'}
      </button>
    </div>
  );
}
