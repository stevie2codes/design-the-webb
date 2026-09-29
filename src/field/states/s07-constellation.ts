/**
 * S7 CONSTELLATION — MCP App, "a hub and its tools" (SPEC §3.10). Project
 * emblem, aspect-fit into the card box (layout.ts: desktop card box left of
 * centre, mobile project slot) at 90% (CARD.emblemFill). MCP App has no
 * screenshot: during its curtain window the anchor grows it ×1.15 into the
 * card box instead (anchors.ts); the detail page re-stages it (×1.3).
 *
 * MODEL frame (units, the ring radius R = .62): the orbit lies in the XZ
 * plane, the hub at the origin, satellite k at angle 60°·k on the ring.
 * DISPLAY = Rx(TILT)·model with TILT = 28°: the orbit is seen from 28° above
 * its plane — the ring "tilted 62° about X" from face-on (§3.10), an ellipse
 * of axis ratio cos 62° = .47, the near side low. One unit is `s` su
 * (fitScale over the graph's rotation-invariant bounds, ±(R + r_sat) ×
 * ±(R·sin 28° + r_sat)); the hub sits on the anchor centre.
 *
 * | Element    | Share | Role   | Geometry                                                            |
 * |------------|-------|--------|---------------------------------------------------------------------|
 * | Hub        |  7%   | edge g7| Fibonacci shell r .09                                               |
 * | Ring       |  7%   | ring g6| r .62 in the orbit plane, dotted (96 dots)                          |
 * | Satellites | 18%   | edge gk| 6 Fibonacci shells r .045 on the ring                               |
 * | Spokes     | 24%   | flow gk| hub → satellite k; 1 in 10 is an ember PACKET (role packet gk)      |
 * | Chords     |  6%   | fill gk| satellite k → k + 1, faint                                          |
 * | Halo       | 38%   | halo   | Fibonacci shell, equatorial r 1.0, p-noise α .06 (flattened, below) |
 * | Sparks     |  S    | spark  | the hub core, ember → core                                          |
 *
 * Spokes store u = distance from the hub centre / R, 8-bit EXACT (u = b/255
 * with b ∈ [38, 236]: from the hub's surface to the satellite's), and every
 * spoke particle's jitter is perpendicular to its spoke. Packets are two
 * short ember dashes per spoke (Gaussian in u, σ .012), not a uniform
 * sprinkle: "1 in 10" is their share of the spoke budget.
 *
 * The halo: §3.10's shell of r 1.0 is 1.6× the ring, so as a sphere it
 * would spill far above and below the card box (onto the MCP App caption
 * under it; the near side is also magnified by perspective). It stays a
 * Fibonacci shell, but OBLATE about the spin axis (polar = HALO_FLAT ×
 * equatorial, so the Y spin never changes its silhouette) with the largest
 * equatorial radius ≤ 1.0 whose projected half-height, perspective
 * included, fits HALO_FIT of the box (haloRadii: ≈ .68 on a 1440 × 900
 * card, ≈ .88 in a 390 × 844 slot).
 *
 * Shader contracts (shaders/live/s07.glsl mirrors the constants below):
 * - live() untilts to the model frame, moves spoke / packet particles along
 *   their spoke k (group) with u = fract-wrapped over [U0, U1]: odd spokes
 *   outbound (+.2/s in u), even spokes inbound (request / response); the
 *   spoke length is recovered as dot(p, dir_k) / u0 (u0 exact, jitter ⟂).
 *   Then the whole graph spins about the model Y at .07 rad/s and is
 *   re-tilted. No unit-length carrier is needed: every motion is linear.
 * - Packets draw at 1.8× size and fade in/out at the spoke ends; each
 *   satellite brightens as a packet reaches (odd) or leaves (even) it.
 *   PACKET_PHASE[k] (packet centre, as a fraction of the visible span at
 *   t = 0) is shared.
 *
 * Sort (§3.3): seeded shuffle. Stagger key (§3.9): rand; spokes .4 + .5u.
 *
 * Reduced-motion poster (§3.10 "packets mid-spoke"): uTime frozen at
 * CONSTELLATION_POSTER_T = 0 — the leading packet of every spoke sits
 * mid-spoke (PACKET_PHASE ≈ .5), the graph at its generated pose (satellites
 * at the ellipse's ends and shoulders). POSTER_TIME[CONSTELLATION] is
 * already 0.
 */
import { StateId } from './ids.ts';
import { RAMP, fibonacciSphere, fitScale, gauss, type StateGenerator } from './common.ts';
import { CAMERA_Z, Role } from '../uniforms.ts';

type V3 = [number, number, number];

export const CONSTELLATION = {
  /** Hub shell radius, ring radius, satellite shell radius (units). */
  hub: 0.09,
  ring: 0.62,
  sat: 0.045,
  sats: 6,
  /** Orbit plane seen from this far above (deg): 62° from face-on (§3.10). */
  tilt: 28,
  /** Y spin (rad/s), spoke flow (u/s), packet size. */
  spin: 0.07,
  flow: 0.2,
  packetSize: 1.8,
  /** Packets per spoke and their u spread (σ, in u). */
  packets: 2,
  packetSigma: 0.012,
  /** Halo: equatorial radius (units). */
  halo: 1.0,
} as const;

/** Spoke u range, 8-bit exact: hub surface → satellite surface. */
export const SPOKE_B0 = Math.ceil((CONSTELLATION.hub / CONSTELLATION.ring) * 255); // 38
export const SPOKE_B1 = Math.floor((1 - CONSTELLATION.sat / CONSTELLATION.ring) * 255); // 236
export const SPOKE_U0 = SPOKE_B0 / 255;
export const SPOKE_U1 = SPOKE_B1 / 255;

/** Leading packet centre per spoke at t = 0, as a fraction of the visible span (≈ mid-spoke: the poster). */
export const PACKET_PHASE: readonly number[] = [0.5, 0.58, 0.45, 0.62, 0.4, 0.54];

/** Reduced-motion poster: packets mid-spoke, the graph at its generated pose. */
export const CONSTELLATION_POSTER_T = 0;

const TILT = (CONSTELLATION.tilt * Math.PI) / 180;
const TC = Math.cos(TILT);
const TS = Math.sin(TILT);

/** Model → display (in place): Rx(TILT). The near side (+z) drops. */
function tilt(v: V3): V3 {
  const y = v[1] * TC - v[2] * TS;
  const z = v[1] * TS + v[2] * TC;
  v[1] = y;
  v[2] = z;
  return v;
}

/** Graph bounds in display units (rotation-invariant: the ring's ellipse plus a satellite). */
export const CONSTELLATION_BOX = {
  w: 2 * (CONSTELLATION.ring + CONSTELLATION.sat),
  h: 2 * (CONSTELLATION.ring * TS + CONSTELLATION.sat),
} as const;

// ---------------------------------------------------------------------------
// Tuning (α before density .55 × FIELD_GAIN 3; judged at 1440 × 900 High and
// 390 × 844 Low).

const SHARE = { hub: 0.07, ring: 0.07, sats: 0.18, spokes: 0.24, chords: 0.06 } as const; // halo: the rest (38%)
const PACKET_SHARE = 0.1;
const ALPHA = { hub: 0.85, ring: 0.66, sat: 0.8, spoke: 0.52, packet: 0.95, chord: 0.26, halo: 0.06 } as const;
/** Ring dots per turn and their duty (dotted, §3.10). */
const RING_DOTS = 96;
const RING_DUTY = 0.42;
/** Perpendicular jitter (units): spokes, ring, chords. */
const JIT = { spoke: 0.0035, ring: 0.004, chord: 0.003, packet: 0.005 } as const;
/** The halo's projected half-height stays within this share of the box's half-height. */
const HALO_FIT = 0.92;
/** Halo polar / equatorial radius (an oblate shell about the spin axis). */
const HALO_FLAT = 0.65;

/**
 * Halo radii (units): equatorial ≤ CONSTELLATION.halo, polar = HALO_FLAT ×
 * equatorial, the largest whose projected half-height — perspective
 * included: the near side (+z after the tilt) is magnified by
 * 3.732 / (3.732 − z) — fits HALO_FIT × `halfH` (su). `s` = su per unit.
 */
export function haloRadii(s: number, halfH: number): [number, number] {
  const limit = HALO_FIT * halfH;
  const v: V3 = [0, 0, 0];
  const extent = (eq: number): number => {
    let m = 0;
    for (let i = 0; i < 48; i++) {
      const th = (i / 48) * Math.PI * 2;
      for (let j = 0; j <= 24; j++) {
        const ph = (j / 24) * Math.PI - Math.PI / 2;
        v[0] = Math.cos(ph) * Math.cos(th) * eq;
        v[1] = Math.sin(ph) * eq * HALO_FLAT;
        v[2] = Math.cos(ph) * Math.sin(th) * eq;
        tilt(v);
        const persp = CAMERA_Z / (CAMERA_Z - v[2] * s);
        m = Math.max(m, Math.abs(v[1] * s * persp));
      }
    }
    return m;
  };
  let lo = 0.3;
  let hi: number = CONSTELLATION.halo;
  if (extent(hi) <= limit) lo = hi;
  else {
    for (let it = 0; it < 18; it++) {
      const mid = (lo + hi) / 2;
      if (extent(mid) <= limit) lo = mid;
      else hi = mid;
    }
  }
  return [lo, lo * HALO_FLAT];
}

export const generator: StateGenerator = {
  id: StateId.CONSTELLATION,
  sort: { kind: 'shuffle' },
  generate(ctx, { shape, spark }) {
    const { rand } = ctx;
    const M = shape.capacity;
    const C = CONSTELLATION;
    const s = fitScale(ctx, CONSTELLATION_BOX.w, CONSTELLATION_BOX.h, 0.9);
    const v: V3 = [0, 0, 0];
    /** Push a MODEL-frame point (units): tilt, scale. */
    const put = (
      x: number,
      y: number,
      z: number,
      key: number,
      ramp: number,
      alpha: number,
      param: number,
      role: Role,
      group: number,
    ) => {
      v[0] = x;
      v[1] = y;
      v[2] = z;
      tilt(v);
      shape.push(v[0] * s, v[1] * s, v[2] * s, key, ramp, alpha, param, role, group);
    };

    // Hub 7%: Fibonacci shell.
    const nHub = Math.round(M * SHARE.hub);
    for (let i = 0; i < nHub; i++) {
      fibonacciSphere(i, nHub, v);
      const r = C.hub * (1 + gauss(rand) * 0.02);
      put(v[0] * r, v[1] * r, v[2] * r, rand(), RAMP.signal, ALPHA.hub, 0, Role.EDGE, 7);
    }

    // Ring 7%: dotted, in the orbit plane.
    const nRing = Math.round(M * SHARE.ring);
    for (let i = 0; i < nRing; ) {
      const f = rand();
      if ((f * RING_DOTS) % 1 > RING_DUTY) continue;
      const th = f * Math.PI * 2;
      const r = C.ring + gauss(rand) * JIT.ring;
      put(Math.cos(th) * r, gauss(rand) * JIT.ring, Math.sin(th) * r, rand(), 0.36, ALPHA.ring, f, Role.RING, 6);
      i++;
    }

    // Satellites 18%: six Fibonacci shells on the ring.
    const nSat = Math.round((M * SHARE.sats) / C.sats);
    for (let k = 0; k < C.sats; k++) {
      const th = (k * Math.PI * 2) / C.sats;
      const cx = Math.cos(th) * C.ring;
      const cz = Math.sin(th) * C.ring;
      for (let i = 0; i < nSat; i++) {
        fibonacciSphere(i, nSat, v);
        const r = C.sat * (1 + gauss(rand) * 0.03);
        put(cx + v[0] * r, v[1] * r, cz + v[2] * r, rand(), RAMP.signal, ALPHA.sat, 0, Role.EDGE, k);
      }
    }

    // Spokes 24% (packets 1 in 10 of them): u exact on the byte grid, jitter
    // perpendicular to the spoke.
    const nSpokes = Math.round(M * SHARE.spokes);
    const nPackets = Math.round(nSpokes * PACKET_SHARE);
    const perSpoke = Math.floor((nSpokes - nPackets) / C.sats);
    const perPacket = Math.floor(nPackets / (C.sats * C.packets));
    const span = SPOKE_U1 - SPOKE_U0;
    const onGrid = (u: number) => Math.min(SPOKE_B1, Math.max(SPOKE_B0, Math.round(u * 255))) / 255;
    for (let k = 0; k < C.sats; k++) {
      const th = (k * Math.PI * 2) / C.sats;
      const dx = Math.cos(th);
      const dz = Math.sin(th);
      // Perpendiculars: model up, and the in-plane normal (−sin, 0, cos).
      const spokeAt = (u: number, j: number, key: number, ramp: number, alpha: number, role: Role) => {
        const a = gauss(rand) * j;
        const b = gauss(rand) * j;
        const r = u * C.ring;
        put(dx * r - dz * b, a, dz * r + dx * b, key, ramp, alpha, u, role, k);
      };
      for (let i = 0; i < perSpoke; i++) {
        const u = (SPOKE_B0 + Math.floor(((i + rand()) / perSpoke) * (SPOKE_B1 - SPOKE_B0 + 1))) / 255;
        spokeAt(Math.min(u, SPOKE_U1), JIT.spoke, 0.4 + 0.5 * u, 0.42, ALPHA.spoke, Role.FLOW);
      }
      for (let p = 0; p < C.packets; p++) {
        const vc = (PACKET_PHASE[k] + p / C.packets) % 1;
        for (let i = 0; i < perPacket; i++) {
          const u = onGrid(SPOKE_U0 + vc * span + gauss(rand) * C.packetSigma);
          spokeAt(u, JIT.packet, 0.4 + 0.5 * u, RAMP.ember + 0.05 * rand(), ALPHA.packet, Role.PACKET);
        }
      }
    }
    // Rounding leftovers of the spoke budget: more spoke particles.
    const spokeLeft = nSpokes - C.sats * (perSpoke + C.packets * perPacket);
    for (let i = 0; i < spokeLeft; i++) {
      const k = i % C.sats;
      const th = (k * Math.PI * 2) / C.sats;
      const u = (SPOKE_B0 + Math.floor(rand() * (SPOKE_B1 - SPOKE_B0 + 1))) / 255;
      const a = gauss(rand) * JIT.spoke;
      const b = gauss(rand) * JIT.spoke;
      const r = u * C.ring;
      put(Math.cos(th) * r - Math.sin(th) * b, a, Math.sin(th) * r + Math.cos(th) * b, 0.4 + 0.5 * u, 0.42, ALPHA.spoke, u, Role.FLOW, k);
    }

    // Chords 6%: satellite surface to satellite surface, faint.
    const nChord = Math.round((M * SHARE.chords) / C.sats);
    const trim = C.sat / C.ring; // chord length = R (hexagon side)
    for (let k = 0; k < C.sats; k++) {
      const a0 = (k * Math.PI * 2) / C.sats;
      const a1 = ((k + 1) * Math.PI * 2) / C.sats;
      const x0 = Math.cos(a0) * C.ring;
      const z0 = Math.sin(a0) * C.ring;
      const x1 = Math.cos(a1) * C.ring;
      const z1 = Math.sin(a1) * C.ring;
      const nx = -(z1 - z0) / C.ring;
      const nz = (x1 - x0) / C.ring;
      for (let i = 0; i < nChord; i++) {
        const f = trim + ((i + rand()) / nChord) * (1 - 2 * trim);
        const j = gauss(rand) * JIT.chord;
        put(x0 + (x1 - x0) * f + nx * j, gauss(rand) * JIT.chord, z0 + (z1 - z0) * f + nz * j, rand(), 0.3, ALPHA.chord, f, Role.FILL, k);
      }
    }

    // Halo (the rest, 38%): an oblate Fibonacci shell (see the header).
    const [eq, polar] = haloRadii(s, ctx.su(ctx.anchor.h) / 2);
    const nHalo = shape.remaining;
    for (let i = 0; i < nHalo; i++) {
      fibonacciSphere(i, nHalo, v);
      const r = 1 + gauss(rand) * 0.035;
      put(v[0] * eq * r, v[1] * polar * r, v[2] * eq * r, rand(), RAMP.noise, ALPHA.halo, 0, Role.HALO, 6);
    }

    // Sparks: the hub core (ember → core), a Gaussian inside the shell.
    while (!spark.full) {
      const x = gauss(rand) * 0.028;
      const y = gauss(rand) * 0.028;
      const z = gauss(rand) * 0.028;
      v[0] = x;
      v[1] = y;
      v[2] = z;
      tilt(v);
      const ramp = RAMP.ember + 0.25 * rand() ** 2;
      spark.push(v[0] * s, v[1] * s, v[2] * s, rand(), ramp, 0.35 + 0.55 * rand() ** 2, 0, Role.SPARK, 7);
    }
  },
};
