// Sortieren durch Ziehen am Griff, mit Maus, Finger oder Stift. Pfeiltasten auf dem Griff verschieben ebenfalls.
import { useEffect, useRef, useState } from '../../vendor/htm-preact.js';

const EDGE = 72; // Abstand zum Rand in px, ab dem beim Ziehen mitgescrollt wird
const BOTTOM_EDGE = 110; // unten zusätzlich die Leiste am Handy

function scrollerOf(el) {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return document.scrollingElement || document.documentElement;
}

// `listRef`: Element, dessen Kinder die Einträge sind. `onMove(from, to)` speichert die neue Reihenfolge.
// `ids`: Schlüssel der Einträge, damit der Griff nach dem Verschieben per Taste den Fokus behält.
export function useSortable(listRef, ids, onMove) {
  const [drag, setDrag] = useState(null);
  const st = useRef(null);
  const refocus = useRef(null);

  useEffect(() => {
    if (!refocus.current) return;
    listRef.current?.querySelector(`[data-sort-id="${refocus.current}"] [data-sort-handle]`)?.focus();
    refocus.current = null;
  });

  useEffect(() => () => {
    if (!st.current) return;
    cancelAnimationFrame(st.current.raf);
    window.removeEventListener('keydown', st.current.onKey, true);
  }, []);

  function frame() {
    const s = st.current;
    if (!s) return;
    // Mitscrollen, wenn der Finger nah am oberen oder unteren Rand ist
    const box = s.scroller === document.scrollingElement || s.scroller === document.documentElement
      ? { top: 0, bottom: window.innerHeight }
      : s.scroller.getBoundingClientRect();
    const top = s.clientY - box.top;
    const bottom = box.bottom - s.clientY;
    if (top < EDGE) s.scroller.scrollTop -= Math.ceil((EDGE - top) / 6);
    else if (bottom < BOTTOM_EDGE) s.scroller.scrollTop += Math.ceil((BOTTOM_EDGE - bottom) / 6);

    const dy = s.clientY - s.startY + (s.scroller.scrollTop - s.startScroll);
    const r = s.rects[s.from];
    const center = r.top + r.height / 2 + dy;
    let to = s.from;
    s.rects.forEach((x, i) => {
      const mid = x.top + x.height / 2;
      if (i > s.from && center > mid) to = i;
      if (i < s.from && center < mid && i < to) to = i;
    });
    if (to !== s.to || dy !== s.dy) {
      s.to = to;
      s.dy = dy;
      setDrag({ from: s.from, to, dy, height: r.height });
    }
    s.raf = requestAnimationFrame(frame);
  }

  function start(e, index) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const items = [...listRef.current.children];
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const scroller = scrollerOf(listRef.current);
    st.current = {
      from: index, to: index, dy: 0, pointerId: e.pointerId, startY: e.clientY, clientY: e.clientY,
      scroller, startScroll: scroller.scrollTop,
      rects: items.map((el) => { const b = el.getBoundingClientRect(); return { top: b.top, height: b.height }; }),
    };
    st.current.onKey = (k) => { if (k.key === 'Escape') { k.preventDefault(); finish(false); } };
    window.addEventListener('keydown', st.current.onKey, true);
    setDrag({ from: index, to: index, dy: 0, height: st.current.rects[index].height });
    st.current.raf = requestAnimationFrame(frame);
  }

  function finish(commit) {
    const s = st.current;
    if (!s) return;
    cancelAnimationFrame(s.raf);
    window.removeEventListener('keydown', s.onKey, true);
    st.current = null;
    setDrag(null);
    if (commit && s.to !== s.from) onMove(s.from, s.to);
  }

  const handle = (index) => ({
    'data-sort-handle': '',
    onPointerDown: (e) => start(e, index),
    onPointerMove: (e) => { if (st.current && e.pointerId === st.current.pointerId) st.current.clientY = e.clientY; },
    onPointerUp: (e) => { if (st.current && e.pointerId === st.current.pointerId) finish(true); },
    onPointerCancel: () => finish(false),
    onKeyDown: (e) => {
      if (st.current) return;
      const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      if (!d) return;
      e.preventDefault();
      const to = index + d;
      if (to < 0 || to >= ids.length) return;
      refocus.current = ids[index];
      onMove(index, to);
    },
  });

  // Verschiebung jedes Eintrags während des Ziehens
  const offset = (i) => {
    if (!drag) return 0;
    const { from, to, dy, height } = drag;
    if (i === from) return dy;
    if (from < to && i > from && i <= to) return -height;
    if (to < from && i >= to && i < from) return height;
    return 0;
  };

  return { drag, handle, offset };
}

export const moveItem = (list, from, to) => {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
};
