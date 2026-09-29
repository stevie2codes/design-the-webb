/**
 * Pre-initialise a scroll-driven gsap animation at build / refresh time
 * (§8.5: no layout reads per frame). gsap initialises a tween — CSSPlugin
 * reads computed styles, parses transforms (offsetParent, offsetHeight) and
 * records its start values — the first time its playhead reaches it. For a
 * scrubbed animation that is a scroll frame, once per tween per session.
 * Rendering it to the end and back to where it is (events suppressed) does
 * that work now, inside the gsap context being built, so the recorded start
 * states also belong to that context and revert with it.
 *
 * Pure (no gsap import): safe in the initial bundle and in lazy chunks.
 */
export interface Primable {
  progress(): number;
  progress(value: number, suppressEvents?: boolean): unknown;
}

export function prime<A extends Primable>(anim: A): A {
  const at = anim.progress();
  anim.progress(1, true);
  anim.progress(at, true);
  return anim;
}
