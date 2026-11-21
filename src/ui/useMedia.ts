import { useEffect, useState } from 'react';

/** True while the media query matches (e.g. "(min-width: 1024px)"). */
export function useMedia(query: string): boolean {
  const get = () => typeof matchMedia !== 'undefined' && matchMedia(query).matches;
  const [on, setOn] = useState(get);
  useEffect(() => {
    const m = matchMedia(query);
    const h = () => setOn(m.matches);
    h();
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, [query]);
  return on;
}
