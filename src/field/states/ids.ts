/**
 * Field state ids (SPEC §3.10, §9.1).
 *
 * A const object + union type instead of a TS `enum`: tsconfig has
 * `erasableSyntaxOnly`, so enums are not allowed. Usage is the same:
 * `StateId.CHART` is the number 2 and `StateId` is also the type.
 * This file must stay dependency-free: the generator worker imports it.
 */
export const StateId = {
  STATIC: 0,
  NAME: 1,
  CHART: 2,
  REDACTED: 3,
  PULSE: 4,
  LATTICE: 5,
  DECK: 6,
  CONSTELLATION: 7,
  STACK: 8,
  BEACON: 9,
  FLATLINE: 10,
} as const;

export type StateId = (typeof StateId)[keyof typeof StateId];

/** Total number of states (S0–S10). */
export const STATE_COUNT = 11;

/** The home film chain S0 → S9 (S10 FLATLINE is 404-only, generated lazily). */
export const HOME_STATES: readonly StateId[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Value of the `data-field-anchor` attribute for a state, e.g. "S2". */
export type StateKey = `S${StateId}`;
export const stateKey = (id: StateId): StateKey => `S${id}`;

/**
 * Lowercase names, used for CSS custom properties (`--anchor-chart-x`)
 * and debug readouts.
 */
export const STATE_NAME = {
  0: 'static',
  1: 'name',
  2: 'chart',
  3: 'redacted',
  4: 'pulse',
  5: 'lattice',
  6: 'deck',
  7: 'constellation',
  8: 'stack',
  9: 'beacon',
  10: 'flatline',
} as const satisfies Record<StateId, string>;

export type StateName = (typeof STATE_NAME)[StateId];
