import { ReactNode, useEffect, useRef, useState } from 'react';

interface T {
  x: number;
  y: number;
  k: number;
}

const MIN = 1;
const MAX = 4;

function clampT(t: T, w: number, h: number): T {
  const k = Math.min(MAX, Math.max(MIN, t.k));
  return { k, x: Math.min(0, Math.max(w - w * k, t.x)), y: Math.min(0, Math.max(h - h * k, t.y)) };
}

/** Drag to pan, pinch / wheel to zoom, double-tap to reset. Content must fill the box. */
export function PanZoom({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<T>({ x: 0, y: 0, k: 1 });
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const lastTap = useRef(0);

  const size = () => {
    const r = box.current?.getBoundingClientRect();
    return { w: r?.width ?? 1, h: r?.height ?? 1, left: r?.left ?? 0, top: r?.top ?? 0 };
  };

  const zoomAt = (cx: number, cy: number, ratio: number) =>
    setT((cur) => {
      const { w, h } = size();
      const k = Math.min(MAX, Math.max(MIN, cur.k * ratio));
      const f = k / cur.k;
      return clampT({ k, x: cx - (cx - cur.x) * f, y: cy - (cy - cur.y) * f }, w, h);
    });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { left, top } = size();
      zoomAt(e.clientX - left, e.clientY - top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
    const now = Date.now();
    if (ptrs.current.size === 1 && now - lastTap.current < 300) setT({ x: 0, y: 0, k: 1 });
    lastTap.current = now;
  };

  const onMove = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    ptrs.current.set(e.pointerId, cur);
    const { w, h, left, top } = size();
    if (ptrs.current.size === 1) {
      setT((c) => clampT({ ...c, x: c.x + cur.x - prev.x, y: c.y + cur.y - prev.y }, w, h));
    } else if (ptrs.current.size === 2 && pinch.current) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2 - left, (a.y + b.y) / 2 - top, d / pinch.current);
      pinch.current = d;
    }
  };

  const onUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    pinch.current = null;
  };

  return (
    <div
      ref={box}
      className="relative aspect-square w-full overflow-hidden rounded-lg border border-gold/50 bg-navy"
      style={{ touchAction: 'none' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})` }}
      >
        {children}
      </div>
      {t.k > 1 && (
        <button
          className="absolute right-2 top-2 rounded bg-navy/80 px-2 py-1 text-xs text-gold-light"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setT({ x: 0, y: 0, k: 1 })}
        >
          Reset view
        </button>
      )}
    </div>
  );
}
