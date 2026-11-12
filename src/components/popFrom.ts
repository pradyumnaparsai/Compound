import { celebrate } from '@/store/useCelebration';

/** Small confetti pop centred on `view` (e.g. the checkbox that was just ticked). */
type Measurable = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };

export function popFrom(view: Measurable | null) {
  view?.measureInWindow((x, y, w, h) => {
    if (w || h) celebrate('small', { x: x + w / 2, y: y + h / 2 });
  });
}
