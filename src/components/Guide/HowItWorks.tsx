import { useCallback, useEffect, useRef, useState } from 'react';

interface Slide {
  img: string;
  title: string;
  text: string;
}

export const SLIDES: Slide[] = [
  { img: '01-home', title: 'One phone hosts', text: 'Tap Create New Game. Everyone else connects straight to the host phone: no server and no account.' },
  { img: '02-setup', title: 'Pick your name and token', text: 'The host chooses a name and a token. The lobby then opens with a 4-digit PIN.' },
  { img: '03-invite', title: 'Invite each player', text: "Tap Add a player and a code appears. Players scan it with Join Game. If a camera won't work, tap Send an invite link instead." },
  { img: '04-reply', title: 'Players show a reply', text: "After scanning, the player's phone shows a reply code. Hold it up to the host's camera, or send it as a message and use Paste code from clipboard." },
  { img: '05-profile', title: 'Choose a name and token', text: 'The PIN is filled in for you. Pick a token and tap Join lobby.' },
  { img: '06-lobby', title: 'Ready? Start the game', text: 'Each player taps Ready and the host taps Start game. Two to six players can play.' },
  { img: '07-play', title: 'Roll, buy, build', text: 'Roll the dice, buy kingdoms, raise Ashramas and collect rent. Pinch the board to zoom in.' },
  { img: '08-deed', title: 'Tap any space for its deed', text: 'See the price, the full rent table, the owner and the building level of any space.' },
];

const src = (n: string) => `${import.meta.env.BASE_URL}guide/${n}.webp`;

/** Swipeable how-to-play guide. Native scroll-snap does the swiping; buttons, dots and arrow keys do the rest. */
export function HowItWorks() {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const cur = useRef(0);
  const lock = useRef(0);

  const go = useCallback((n: number) => {
    const el = track.current;
    if (!el) return;
    const k = Math.max(0, Math.min(SLIDES.length - 1, n));
    el.scrollTo({ left: k * el.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    cur.current = k;
    lock.current = Date.now() + 700; // ignore scroll events caused by our own smooth scroll
    setI(k);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const settle = () => {
      const k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      cur.current = k;
      setI(k);
    };
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(settle, Date.now() < lock.current ? 750 : 80);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <section
      className="card flex flex-col gap-3 text-center"
      aria-roledescription="carousel"
      aria-label="How to play"
      data-testid="how-it-works"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(cur.current + 1);
        if (e.key === 'ArrowLeft') go(cur.current - 1);
      }}
    >
      <h2 className="text-sm font-bold uppercase tracking-widest text-gold-light">How it works</h2>
      <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" tabIndex={0} aria-live="polite">
        {SLIDES.map((s, n) => (
          <figure key={s.img} className="m-0 flex w-full flex-none snap-center flex-col items-center gap-2 px-1" aria-roledescription="slide" aria-label={`${n + 1} of ${SLIDES.length}`} data-testid="guide-slide">
            <div className="h-[300px] w-[150px] overflow-hidden rounded-2xl border-2 border-gold/60 bg-navy-2 shadow-lg">
              <img src={src(s.img)} alt={`Screenshot: ${s.title}`} className="h-full w-full object-cover object-top" loading={n === 0 ? 'eager' : 'lazy'} draggable={false} />
            </div>
            <figcaption className="max-w-[300px]">
              <div className="text-xs text-gold/80">Step {n + 1} of {SLIDES.length}</div>
              <div className="font-bold text-gold-light">{s.title}</div>
              <p className="mt-1 text-sm opacity-85">{s.text}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3">
        <button className="btn-ghost h-9 w-9 !p-0" onClick={() => go(cur.current - 1)} disabled={i === 0} aria-label="Previous step" data-testid="guide-prev">‹</button>
        <div className="flex gap-1.5" role="tablist" aria-label="Choose a step">
          {SLIDES.map((s, n) => (
            <button key={s.img} role="tab" aria-selected={n === i} aria-label={`Step ${n + 1}`} onClick={() => go(n)} className={`h-2 rounded-full transition-all ${n === i ? 'w-5 bg-gold' : 'w-2 bg-gold/30'}`} />
          ))}
        </div>
        <button className="btn-ghost h-9 w-9 !p-0" onClick={() => go(cur.current + 1)} disabled={i === SLIDES.length - 1} aria-label="Next step" data-testid="guide-next">›</button>
      </div>
    </section>
  );
}
