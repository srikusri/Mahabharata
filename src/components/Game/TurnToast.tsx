import { useEffect, useRef, useState } from 'react';
import { buzz, play } from '../../ui/sound';

/** Slides in when the turn passes to you, with a chime and a short vibration (Android). */
export function TurnToast({ myTurn, phase }: { myTurn: boolean; phase: string }) {
  const [show, setShow] = useState(false);
  const was = useRef(myTurn);
  useEffect(() => {
    if (myTurn && !was.current && phase !== 'over') {
      setShow(true);
      play('turn');
      buzz([120, 60, 120]);
      const t = setTimeout(() => setShow(false), 2200);
      was.current = myTurn;
      return () => clearTimeout(t);
    }
    was.current = myTurn;
  }, [myTurn, phase]);
  if (!show) return null;
  return (
    <div role="status" data-testid="turn-toast" className="slide-down pointer-events-none fixed left-0 right-0 top-2 z-40 mx-auto w-fit rounded-full border border-gold bg-navy-2 px-5 py-2 font-bold text-gold-light shadow-xl">
      Your turn
    </div>
  );
}
