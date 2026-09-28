/**
 * Engine-owned inputs (SPEC §3.7, §9.5 loop control): the pointer
 * (`store.pointer`), the touch ripple (`store.fx.ripple`) and page
 * visibility (`store.flags.hidden`). Listeners only write numbers; the
 * director damps the pointer and the shader does the rest.
 */
import { gsap } from '../motion/gsap.ts';
import { MQ } from './layout.ts';
import { store } from '../scroll/store.ts';

/** A tap: moves less than this (px) between down and up (§3.7). */
const TAP_SLOP = 10;
/** Ripple lifetime (s): one ripple at a time. */
const RIPPLE_S = 0.6;
const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])';

export interface InputHooks {
  /** Any input: the idle throttle resumes full rate. */
  wake(source: 'scroll' | 'pointer'): void;
  /** Visibility changed. */
  visibility(hidden: boolean): void;
}

export function attachInput(hooks: InputHooks): () => void {
  let fineMql: MediaQueryList | null = null;
  try {
    fineMql = window.matchMedia(MQ.finePointer);
  } catch {
    fineMql = null;
  }
  const p = store.pointer;
  p.fine = fineMql?.matches ?? false;
  const onFine = () => {
    p.fine = fineMql?.matches ?? false;
  };
  fineMql?.addEventListener('change', onFine);

  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    p.x = e.clientX;
    p.y = e.clientY;
    p.active = true;
    hooks.wake('pointer');
  };
  const leave = () => {
    p.active = false;
  };
  const docLeave = (e: MouseEvent) => {
    if (!e.relatedTarget) leave();
  };

  let downX = 0;
  let downY = 0;
  let downId = -1;
  const down = (e: PointerEvent) => {
    hooks.wake('pointer');
    if (e.pointerType !== 'touch') return;
    downX = e.clientX;
    downY = e.clientY;
    downId = e.pointerId;
  };
  const up = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || e.pointerId !== downId) return;
    downId = -1;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) >= TAP_SLOP) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest(INTERACTIVE)) return;
    const now = gsap.ticker.time;
    const r = store.fx.ripple;
    if (r[2] >= 0 && now - r[2] < RIPPLE_S) return;
    r[0] = e.clientX;
    r[1] = e.clientY;
    r[2] = now;
    r[3] = 1;
    hooks.wake('pointer');
  };
  const vis = () => {
    store.flags.hidden = document.hidden;
    hooks.visibility(document.hidden);
  };

  const passive = { passive: true } as const;
  window.addEventListener('pointermove', move, passive);
  window.addEventListener('pointerdown', down, passive);
  window.addEventListener('pointerup', up, passive);
  window.addEventListener('blur', leave);
  document.documentElement.addEventListener('mouseleave', docLeave);
  document.addEventListener('visibilitychange', vis);
  const scroll = () => hooks.wake('scroll');
  window.addEventListener('scroll', scroll, passive);
  store.flags.hidden = document.hidden;

  return () => {
    fineMql?.removeEventListener('change', onFine);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerdown', down);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('blur', leave);
    document.documentElement.removeEventListener('mouseleave', docLeave);
    document.removeEventListener('visibilitychange', vis);
    window.removeEventListener('scroll', scroll);
    p.active = false;
  };
}
