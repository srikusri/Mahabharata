import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/**
 * Camera QR scanner. The camera is only requested when this component mounts
 * (i.e. when the user taps a scan button), and is always released on unmount.
 * Uses jsQR so it works on iOS Safari, which has no BarcodeDetector.
 */
export function QrScanner({ onText }: { onText: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef(onText);
  cb.current = onText;
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let last = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = (t: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      if (t - last < 100) return;
      last = t;
      const v = video.current;
      if (!v || !ctx || v.readyState < 2 || !v.videoWidth) return;
      const scale = Math.min(1, 900 / Math.max(v.videoWidth, v.videoHeight));
      const w = Math.round(v.videoWidth * scale);
      const h = Math.round(v.videoHeight * scale);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(v, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const r = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
      if (r?.data) cb.current(r.data);
    };

    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErr(
          window.isSecureContext
            ? 'This browser cannot use the camera. Use "Paste code" instead.'
            : 'The camera only works on secure (https) pages. Open the https link, or use "Paste code".',
        );
        setStarting(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        const v = video.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        setStarting(false);
        raf = requestAnimationFrame(tick);
      } catch (e) {
        const name = (e as DOMException).name;
        setErr(
          name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access for this site in your browser settings, or use "Paste code".'
            : 'Could not start the camera. Use "Paste code" instead.',
        );
        setStarting(false);
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  return (
    <div className="relative aspect-square w-full max-w-[340px] overflow-hidden rounded-lg border border-gold/50 bg-black">
      <video ref={video} className="h-full w-full object-cover" playsInline muted autoPlay />
      {starting && !err && <div className="absolute inset-0 grid place-items-center text-sm text-gold-light">Starting camera...</div>}
      {err && <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-ivory">{err}</div>}
      {!err && !starting && (
        <div className="pointer-events-none absolute inset-[12%] rounded-lg border-2 border-gold-light/70" />
      )}
    </div>
  );
}
