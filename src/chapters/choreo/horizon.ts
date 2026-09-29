/**
 * The footer sunset (SPEC §1 "Credits", §5 C5 sink, C6): while the beacon
 * sinks to the footer horizon (store.fx.sink 0 → 1, scrubbed by Contact),
 * the horizon itself warms — an ember glow on the footer's top edge that
 * peaks as the beacon's centre touches it. The Footer registers its glow
 * element here; Contact's sink trigger writes the value (no React, no
 * layout reads). SSR-safe.
 */

let glow: HTMLElement | null = null;
let shown = -1;

/** Footer: register (or clear, with null) the horizon glow element. */
export function registerHorizon(el: HTMLElement | null): void {
  glow = el;
  shown = -1;
  if (el) el.style.opacity = '0';
}

/** Glow level for a sink progress: nothing until the beacon nears the horizon, then an eased rise. */
export function sunsetLevel(sink: number): number {
  const t = Math.min(1, Math.max(0, (sink - 0.35) / 0.65));
  return t * t * (3 - 2 * t);
}

/** Contact: write the horizon for sink progress `sink` (0 → 1). */
export function setSunset(sink: number): void {
  if (!glow) return;
  const v = Math.round(sunsetLevel(sink) * 1000) / 1000;
  if (v === shown) return;
  shown = v;
  glow.style.opacity = String(v);
}
