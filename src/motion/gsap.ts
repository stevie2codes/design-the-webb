/**
 * The one place GSAP plugins are registered (SPEC §2.7, §9.1). Import gsap,
 * ScrollTrigger, SplitText and useGSAP from here, never from 'gsap' directly,
 * so registration and the custom eases always exist first.
 * SplitText and CustomEase ship free with gsap ≥ 3.13.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase, useGSAP);

// Motion tokens (§2.7), matching the --ease-* CSS tokens.
CustomEase.create('cine', 'M0,0 C0.7,0 0.2,1 1,1');
CustomEase.create('out-expo', 'M0,0 C0.16,1 0.3,1 1,1');
CustomEase.create('in-expo', 'M0,0 C0.7,0 0.84,0 1,1');
CustomEase.create('ui', 'M0,0 C0.22,1 0.36,1 1,1');

// Mobile URL-bar show/hide must not trigger refreshes (§4.2, §9.7).
ScrollTrigger.config({ ignoreMobileResize: true });

/** Ease names. Every scrubbed tween uses 'none' (Lenis + the field damp smooth it). */
export const EASE = {
  cine: 'cine',
  outExpo: 'out-expo',
  inExpo: 'in-expo',
  inOutExpo: 'expo.inOut',
  ui: 'ui',
  none: 'none',
} as const;

/** Durations in seconds (§2.7). */
export const DUR = {
  micro: 0.18,
  ui: 0.24,
  reveal: 0.7,
  revealStagger: 0.09,
  groupFocus: 0.5,
  morph: 1.1,
  scan: 0.9,
  cutOut: 0.25,
  cutIn: 0.4,
  rewind: 2.4,
} as const;

/** Loop periods in seconds (§2.7). */
export const LOOP = {
  caret: 1.06,
  pulse: 2.4,
  writeHeadSweep: 3.2,
  writeHeadHold: 0.8,
  beaconBreath: 5,
} as const;

export { gsap, ScrollTrigger, SplitText, CustomEase, useGSAP };
