/**
 * The field's THREE objects (SPEC §3.4 geometry + material, §3.5 uniforms,
 * §3.8 glow pass). Engine chunk only: imports three by name (tree-shaken).
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  FloatType,
  GLSL3,
  NearestFilter,
  Points,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  type IUniform,
} from 'three';
import vertSrc from './shaders/field.vert.glsl?raw';
import fragSrc from './shaders/field.frag.glsl?raw';
import noiseSrc from './shaders/noise.glsl?raw';
import liveSrc from './shaders/live.glsl?raw';
import { makeIndexPositions, makeParticleSeeds } from './states/common.ts';
import { FIELD_GAIN, LIMITS, PALETTE } from './uniforms.ts';

/** Strip comment-only lines and blank lines (smaller chunk, same program). */
function trimGlsl(src: string): string {
  return src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return t !== '' && !(t.startsWith('//') && !t.startsWith('// @include'));
    })
    .join('\n');
}

const VERTEX = trimGlsl(vertSrc)
  .replace('// @include noise', trimGlsl(noiseSrc))
  .replace('// @include live', trimGlsl(liveSrc));
const FRAGMENT = trimGlsl(fragSrc);

/** Palette ramp as sRGB floats (the output is not colour-managed: what we write is what shows). */
export function paletteFloats(): Float32Array {
  const out = new Float32Array(LIMITS.palette * 3);
  PALETTE.forEach((s, i) => {
    out[i * 3] = ((s.hex >> 16) & 255) / 255;
    out[i * 3 + 1] = ((s.hex >> 8) & 255) / 255;
    out[i * 3 + 2] = (s.hex & 255) / 255;
  });
  return out;
}

/** An empty 1-row texture bound while a state is missing (never shown: the director's ceiling). */
export function placeholderTextures(): { pos: DataTexture; meta: DataTexture } {
  return {
    pos: makePosTexture(new Float32Array(LIMITS.texW * 4), 1),
    meta: makeMetaTexture(new Uint8Array(LIMITS.texW * 4), 1),
  };
}

export function makePosTexture(data: Float32Array, texH: number): DataTexture {
  const t = new DataTexture(data, LIMITS.texW, texH, RGBAFormat, FloatType);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export function makeMetaTexture(data: Uint8Array, texH: number): DataTexture {
  const t = new DataTexture(data, LIMITS.texW, texH, RGBAFormat, UnsignedByteType);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** Every uniform of §3.5 (plus uTimeA/B, uMotion, uPxSu), typed. */
export interface FieldUniforms {
  [name: string]: IUniform;
  uPosA: IUniform<DataTexture>;
  uPosB: IUniform<DataTexture>;
  uMetaA: IUniform<DataTexture>;
  uMetaB: IUniform<DataTexture>;
  uTexW: IUniform<number>;
  uKindA: IUniform<number>;
  uKindB: IUniform<number>;
  uOffA: IUniform<Vector4>;
  uOffB: IUniform<Vector4>;
  uMix: IUniform<number>;
  uStagger: IUniform<number>;
  uTurb: IUniform<number>;
  uPath: IUniform<number>;
  uTime: IUniform<number>;
  uTimeA: IUniform<number>;
  uTimeB: IUniform<number>;
  uDt: IUniform<number>;
  uMotion: IUniform<number>;
  uAperture: IUniform<number>;
  uFocusZ: IUniform<number>;
  uBokehCap: IUniform<number>;
  uDpr: IUniform<number>;
  uSizeMin: IUniform<number>;
  uSizeMax: IUniform<number>;
  uDensityA: IUniform<number>;
  uDensityB: IUniform<number>;
  uIdleA: IUniform<Vector3>;
  uIdleB: IUniform<Vector3>;
  uMouse: IUniform<Vector3>;
  uMouseAmt: IUniform<number>;
  uMouseMode: IUniform<number>;
  uRipple: IUniform<Vector4>;
  uScrollPx: IUniform<number>;
  uVelocity: IUniform<number>;
  uSafe: IUniform<Float32Array>;
  uSafeCount: IUniform<number>;
  uGroupW: IUniform<Float32Array>;
  uFocusOn: IUniform<number>;
  uDisperse: IUniform<number>;
  uCharge: IUniform<number>;
  uNova: IUniform<number>;
  uBeat: IUniform<number>;
  uScanX: IUniform<number>;
  uPrinted: IUniform<number>;
  uBarPivot: IUniform<Float32Array>;
  uOpacity: IUniform<number>;
  uExposure: IUniform<number>;
  uPalette: IUniform<Float32Array>;
  uAspect: IUniform<number>;
  uViewport: IUniform<Vector2>;
  uPxSu: IUniform<number>;
}

export function createUniforms(placeholder: { pos: DataTexture; meta: DataTexture }): FieldUniforms {
  return {
    uPosA: { value: placeholder.pos },
    uPosB: { value: placeholder.pos },
    uMetaA: { value: placeholder.meta },
    uMetaB: { value: placeholder.meta },
    uTexW: { value: LIMITS.texW },
    uKindA: { value: 0 },
    uKindB: { value: 1 },
    uOffA: { value: new Vector4(0, 0, 1, 1) },
    uOffB: { value: new Vector4(0, 0, 1, 1) },
    uMix: { value: 0 },
    uStagger: { value: 0 },
    uTurb: { value: 0 },
    uPath: { value: 0 },
    uTime: { value: 0 },
    uTimeA: { value: 0 },
    uTimeB: { value: 0 },
    uDt: { value: 0 },
    uMotion: { value: 1 },
    uAperture: { value: 0.9 },
    uFocusZ: { value: 0 },
    uBokehCap: { value: 12 },
    uDpr: { value: 1 },
    uSizeMin: { value: 1.1 },
    uSizeMax: { value: 2.6 },
    uDensityA: { value: 1 },
    uDensityB: { value: 1 },
    uIdleA: { value: new Vector3() },
    uIdleB: { value: new Vector3() },
    uMouse: { value: new Vector3() },
    uMouseAmt: { value: 0 },
    uMouseMode: { value: 0 },
    uRipple: { value: new Vector4(0, 0, -1, 0) },
    uScrollPx: { value: 0 },
    uVelocity: { value: 0 },
    uSafe: { value: new Float32Array(LIMITS.safeRects * 4) },
    uSafeCount: { value: 0 },
    uGroupW: { value: new Float32Array(LIMITS.groups).fill(1) },
    uFocusOn: { value: 0 },
    uDisperse: { value: 0 },
    uCharge: { value: 0 },
    uNova: { value: 0 },
    uBeat: { value: 0 },
    uScanX: { value: -1e4 },
    uPrinted: { value: 0 },
    uBarPivot: { value: new Float32Array(LIMITS.barPivots * 2) },
    uOpacity: { value: 1 },
    uExposure: { value: 1 },
    uPalette: { value: paletteFloats() },
    uAspect: { value: 1 },
    uViewport: { value: new Vector2(1, 1) },
    uPxSu: { value: 0 },
  };
}

export interface FieldMeshes {
  readonly geometry: BufferGeometry;
  readonly glowGeometry: BufferGeometry;
  readonly material: ShaderMaterial;
  readonly glowMaterial: ShaderMaterial;
  readonly points: Points;
  readonly glow: Points;
}

/**
 * Geometry (position packs the particle index, aSeed per particle), the main
 * material and the glow clone (#define GLOW) sharing the same uniforms. The
 * glow Points draws [0, S): the sparks only (a second geometry shares the
 * attributes so each can keep its own drawRange).
 */
export function createMeshes(N: number, uniforms: FieldUniforms, opts: { lowTier: boolean }): FieldMeshes {
  const position = new BufferAttribute(makeIndexPositions(N), 3);
  const seed = new BufferAttribute(makeParticleSeeds(N), 4);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', position);
  geometry.setAttribute('aSeed', seed);
  const glowGeometry = new BufferGeometry();
  glowGeometry.setAttribute('position', position);
  glowGeometry.setAttribute('aSeed', seed);

  const defines: Record<string, string> = { FIELD_GAIN: FIELD_GAIN.toFixed(3) };
  if (opts.lowTier) {
    defines.IDLE_SIN = '';
    defines.TIER_LOW = '';
  }
  const base = {
    glslVersion: GLSL3,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  } as const;
  const material = new ShaderMaterial({ ...base, defines });
  const glowMaterial = new ShaderMaterial({ ...base, defines: { ...defines, GLOW: '' } });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 0;
  const glow = new Points(glowGeometry, glowMaterial);
  glow.frustumCulled = false;
  glow.renderOrder = 1;
  return { geometry, glowGeometry, material, glowMaterial, points, glow };
}
