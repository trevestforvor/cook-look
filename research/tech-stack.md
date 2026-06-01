# Chroma — Optimal Tech Stack for a Premium, High-Performance OKLCH Design Tool

> Principal-architect technology review for `/Users/trevest/Developer/chroma/cook-look`.
> Goal: make the OKLCH color-design tool feel **premium** and run at **120fps / sub-millisecond** render, without churning the parts that already work.

## TL;DR

| Axis | Today | Recommendation | Verdict |
|---|---|---|---|
| 1. Gamut-field rendering | Canvas2D per-pixel via culori (~400ms @ 640²) | **WebGL2 GLSL fragment shader** (raw, thin custom hook) | **CHANGE — #1 priority** |
| 2. Engine color math | culori (JS), binary searches | **Keep culori as source of truth.** Add a *separate* GLSL approximation only for the *display* wheel | **WASM not worth it** |
| 3. Motion / interaction | none (imperative canvas + RAF throttle) | **Motion (`motion`, ex-Framer-Motion)** for marker drag + micro-interactions | CHANGE — additive |
| 4. App framework | Next.js 14.2 | **Keep Next.js** | DO NOT CHANGE |
| 5. State | Zustand 5 | **Keep Zustand** | DO NOT CHANGE |

The single highest-impact change is replacing the per-pixel Canvas2D wheel with a **WebGL2 fragment shader** that computes OKLCH→sRGB and the gamut-boundary test on the GPU, once per pixel per frame. This takes the wheel from ~400ms/pixelated to **<1ms at full retina/any-DPI, crisp and antialiased**, and unlocks live scrubbing of the lightness slider.

---

## Grounding: current implementation (read from source)

- **`apps/web/src/components/ColorWheel.tsx`** — `SIZE = 320`, `RES = 320` (a comment notes it was bumped from 160; memory log confirms 160→320). `MAX_C = 0.37` rim chroma. The disk is filled in a `useEffect` by looping pixels, calling `pointToOklch` then the engine's `displayRgb255`, writing to `ImageData`. Out-of-gamut pixels are dimmed. Redraw is gated to lightness changes and the marker drag is RAF-throttled (`use-raf-throttle`). The bottleneck: **per-pixel `culori` conversions in JS** — `RES²` calls, and it cannot afford retina (`devicePixelRatio` × 320)² ≈ 410k+ conversions.
- **`packages/engine/src/color.ts`** — the boundary to sRGB. Delegates *everything* to `culori`: `converter('oklch'|'rgb')`, `inGamut('rgb')`, `clampChroma(c,'oklch','rgb')`. `maxChroma(l,h)` is a **24-iteration binary search** calling `inGamut` each step. `displayRgb255` is the per-pixel fast path the wheel uses.
- **`packages/engine/src/ramps.ts`** — 11 fixed `LIGHTNESS_TARGETS` (50…950) × a `CHROMA_ENVELOPE`, each step gamut-mapped via `gamutCeiling` → `maxChroma`. So **~11 binary searches (≈264 `inGamut` calls) per ramp**, plus a few per palette role.
- **`packages/engine/src/palette.ts`** — role-based light/dark themes; APCA (`apcaLc`) + WCAG contrast selection. Pure, deterministic, **tested**.
- **Versions:** Next `^14.2.18`, React `^18.3.1`, React-DOM `^18.3.1`, Zustand `^5.0.2`, Tailwind `^3.4.15`, TypeScript `^5.7.2`; engine uses `culori`. ESM throughout, `.js` specifiers resolving to `.ts`.

**Critical architectural invariant (from `CLAUDE.md`):** the engine is the *source of truth for color values* and is fully tested. Any GPU/WASM work must not change the values the engine emits. The shader is a **display-only approximation**; the engine stays canonical.

---

## 1. Gamut-field rendering — WebGL2 GLSL fragment shader (RECOMMENDED)

### The three options

| Option | Render cost @ retina 640² | Crisp/AA | Browser support | Verdict |
|---|---|---|---|---|
| **Canvas2D per-pixel (today)** | ~400ms, pixelated, capped at 320² | No (it's a bitmap upload) | 100% | Bottleneck — replace |
| **WebGL2 GLSL fragment shader** | **<1ms**, runs once per pixel on GPU, naturally AA at the boundary | **Yes** | **95.07% global; Safari 15+ (2021), Chrome 56+, FF 51+, Edge 79+** [caniuse WebGL2] | **RECOMMENDED** |
| **WebGPU / WGSL** | <1ms (same class) | Yes | **82.76% global, but Firefox still behind a flag on every version, Safari only 26+ and *partial*** [caniuse WebGPU] | Premature for a primary path |

**Why WebGL2, not WebGPU:** the math is identical (it's a fragment/compute kernel either way), but WebGPU is **not yet shippable as the only path** — Firefox ships it disabled-by-default across all current versions and Safari is partial only from 26. WebGL2's gamut field is a textbook full-screen-quad fragment shader; there is zero capability we need from WebGPU here (no compute, no storage buffers, no MSAA tricks). Use WebGL2 now; WebGPU is a drop-in successor in 1–2 years when Firefox/Safari catch up — keep the shader logic in a shared GLSL/WGSL-portable string to ease that.

**Why not three.js / @react-three/fiber:** those are scene-graph/3D engines (hundreds of KB) for a problem that is one fullscreen quad + one fragment shader. Overkill, and they fight React reconciliation. **`regl`** (functional WebGL) is a reasonable ~30KB middle ground, but a **thin custom hook (~120 lines of raw WebGL2)** is leaner, has zero deps, and gives full control over the DPI-aware framebuffer. **Recommendation: raw WebGL2 in a custom `useGamutField` hook.** Reach for `regl` only if you later add many distinct color fields and want to dedupe boilerplate.

### The shader math (OKLCH → sRGB, per pixel)

Exact coefficients from Björn Ottosson's reference (public domain / MIT) [bottosson.github.io/posts/oklab]. These are the *same* matrices culori uses, so the display approximation matches the engine to float precision.

```glsl
#version 300 es
precision highp float;

in  vec2 v_uv;          // 0..1 across the quad
out vec4 outColor;

uniform float u_L;       // current OKLCH lightness (0..1)
uniform float u_maxC;    // rim chroma (MAX_C = 0.37)
uniform float u_dpr;     // device pixel ratio (for crisp AA scaling)

// OKLab (L,a,b) -> linear sRGB. Ottosson, public domain.
vec3 oklab_to_linear_srgb(vec3 lab) {
  float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  float l = l_*l_*l_, m = m_*m_*m_, s = s_*s_*s_;
  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

// linear -> gamma sRGB (IEC 61966-2-1)
float lin2srgb(float c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0/2.4) - 0.055;
}

void main() {
  // map quad uv -> centered disk coords
  vec2 p   = v_uv * 2.0 - 1.0;        // -1..1
  float r  = length(p);
  float ang = atan(-p.y, p.x);         // y-up to match the component

  // OKLCH at this pixel
  float C = clamp(r, 0.0, 1.0) * u_maxC;
  float a = C * cos(ang);
  float b = C * sin(ang);

  vec3 lin = oklab_to_linear_srgb(vec3(u_L, a, b));

  // --- smooth sRGB gamut boundary ---
  // out-of-gamut iff any linear channel < 0 or > 1.
  float over = max(max(-lin.r, -lin.g), -lin.b);        // amount below 0
  over = max(over, max(max(lin.r-1.0, lin.g-1.0), lin.b-1.0)); // amount above 1
  // antialiased dim mask: 1 inside gamut, fades to a dim factor just outside
  float gamut = smoothstep(0.0, 0.02, -over + 0.0);     // ~1 in-gamut, 0 out
  // (equivalently: 1.0 - smoothstep(0.0, 0.012, over))

  vec3 rgb = clamp(lin, 0.0, 1.0);
  rgb = vec3(lin2srgb(rgb.r), lin2srgb(rgb.g), lin2srgb(rgb.b));

  // dim out-of-gamut region instead of a hard edge -> crisp, smooth boundary
  float dim = mix(0.18, 1.0, gamut);
  rgb *= dim;

  // antialias the disk's outer rim against the background
  float edge = 1.0 - smoothstep(1.0 - 1.5/(160.0*u_dpr), 1.0, r);

  outColor = vec4(rgb, edge);
}
```

**Why this is crisp + smooth at the boundary:** the fragment shader runs *per output pixel at native framebuffer resolution* (set the canvas backing store to `cssSize * devicePixelRatio`), so there is no upscaled bitmap — it is sharp at any DPI. The gamut edge is computed analytically as "how far outside [0,1] is the worst linear channel" and fed through `smoothstep`, which the GPU evaluates with sub-pixel precision → a **smooth, antialiased gamut boundary** instead of the stair-stepped dimming you get from per-pixel JS. The disk rim uses the alpha `edge` term for free AA against the page.

**Boundary fidelity vs the engine:** the engine's `clampChroma` reduces chroma to the gamut edge; the shader's `over`/`smoothstep` test detects the *same* edge (same matrices, same [0,1] test). For the *picker*, the marker position still comes from the engine (see §3), so the authoritative value is never the shader's.

### The React hook shape (raw WebGL2, DPI-aware, no deps)

```ts
// apps/web/src/lib/useGamutField.ts
"use client";
import { useEffect, useRef } from "react";

export function useGamutField(opts: { L: number; maxC: number; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const uniforms = useRef<Record<string, WebGLUniformLocation | null>>({});

  // one-time GL setup: compile program, bind a fullscreen-quad VAO
  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl2", { antialias: true, premultipliedAlpha: true })!;
    glRef.current = gl;
    const prog = compileProgram(gl, VERT_SRC, FRAG_SRC); // helpers below
    progRef.current = prog;
    bindFullscreenQuad(gl, prog);
    uniforms.current = {
      L: gl.getUniformLocation(prog, "u_L"),
      maxC: gl.getUniformLocation(prog, "u_maxC"),
      dpr: gl.getUniformLocation(prog, "u_dpr"),
    };
    return () => { gl.deleteProgram(prog); };
  }, []);

  // redraw on L / size change (cheap: one draw call)
  useEffect(() => {
    const gl = glRef.current, prog = progRef.current;
    if (!gl || !prog) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(opts.size * dpr);
    const canvas = canvasRef.current!;
    if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
    gl.viewport(0, 0, px, px);
    gl.useProgram(prog);
    gl.uniform1f(uniforms.current.L!, opts.L);
    gl.uniform1f(uniforms.current.maxC!, opts.maxC);
    gl.uniform1f(uniforms.current.dpr!, dpr);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [opts.L, opts.maxC, opts.size]);

  return canvasRef; // <canvas ref={canvasRef} style={{ width: size, height: size }} />
}
```

`VERT_SRC` is a trivial pass-through emitting `v_uv`; `compileProgram`/`bindFullscreenQuad` are ~25 lines of boilerplate. Total hook ≈ 120 lines, **zero runtime deps**, and the wheel redraw becomes a **single `drawArrays`** that the lightness slider can drive live at 120fps.

**Migration cost:** ~1 file added + delete the pixel loop in `ColorWheel.tsx` (keep `pointToOklch`/`oklchToPoint` for hit-testing and marker placement). Low risk: the engine is untouched; if WebGL2 is unavailable (4.9% tail) fall back to the existing Canvas2D path behind a `gl === null` check.

---

## 2. Engine color-math performance — keep culori, do NOT go WASM (with one nuance)

**Verdict: WASM is NOT worth it for this engine.** Reasoning:

- **The hot per-pixel path is leaving JS entirely** (moving to the GPU, §1). That was the only place culori was called hundreds of thousands of times. Once the wheel is a shader, the engine's remaining culori calls are *tiny*: a palette build is ~7 ramp roles × 11 steps, each a 24-iteration `inGamut` binary search ≈ low thousands of conversions **once per palette generation**, not per frame. That is **sub-millisecond in JS already**; WASM would save microseconds a user never perceives.
- **Determinism risk is real and asymmetric.** The engine is tested for *identical values*. A Rust crate (`palette`, `oklab`) or hand-rolled WASM would use `f32`/`f64` and its own gamut-mapping algorithm; culori's `clampChroma` does a specific binary search with specific rounding (`round(...,4)`/`round(...,2)`). Matching culori **bit-for-bit** across `clampChroma`, `maxChroma`, hue normalization, and 4-decimal rounding is fiddly and a permanent maintenance tax for **zero user-visible speed gain**. The downside (a test suite that silently drifts, or worse, ships subtly different tokens) dwarfs the upside.
- **WASM bundle + glue cost** (loader, async init, SSR/Next interop) adds complexity to a path that isn't slow.

**When WASM *would* be worth it (not today):** if you added a feature that does **per-frame, full-image** engine-accurate work in JS — e.g. live recoloring a megapixel photo through the exact `clampChroma` algorithm, or a real-time accessibility heatmap over a large canvas using `apcaLc`. That is hundreds of thousands of *engine* ops per frame where culori-in-JS would stall. Then port **only that kernel** to Rust→WASM (or better, to a shader) and keep `culori` as the canonical token engine. Quantitative rule of thumb: WASM pays off above ~10⁵–10⁶ conversions per frame; the engine's real workloads are 10²–10³ per *user action*.

**Optional micro-win (no WASM, no determinism risk):** memoize `maxChroma(l,h)` results — ramps repeatedly probe a small set of (L,hue) pairs. A `Map` cache keyed on rounded `(l,h)` removes redundant binary searches with no change to output values. Low priority.

---

## 3. Premium interaction & motion — Motion (`motion`, ex-Framer-Motion) (RECOMMENDED)

| Lib | Fit for the wheel marker / micro-interactions | Note |
|---|---|---|
| **Motion (`motion`, motion.dev)** | **Best.** `useMotionValue` + `useSpring` for the marker; **hardware-accelerated transforms run on the GPU/compositor, staying at 60–120fps even when the main thread is busy** (e.g. mid palette-regen) [motion.dev/docs/gsap-vs-motion] | RECOMMENDED |
| Motion One (`motion` mini / WAAPI) | Great for fire-and-forget CSS-prop animations; thinner, but fewer gesture/spring ergonomics for a draggable picker | Use its primitives are already in `motion` |
| GSAP | Excellent timelines, **but its tweens run on the main thread** and will stutter under JS load [motion.dev/docs/gsap-vs-motion]; heavier license/footprint for UI micro-interactions | No |
| CSS-only | Fine for hovers/focus rings; cannot express spring-physics drag with momentum cleanly | Use for static transitions only |

**Recommended pattern for the marker (avoids React re-renders during drag):**

```tsx
import { motion, useMotionValue, useSpring } from "motion/react";

const dragX = useMotionValue(centerX);
const dragY = useMotionValue(centerY);
const x = useSpring(dragX, { stiffness: 700, damping: 40, mass: 0.6 }); // snappy, premium
const y = useSpring(dragY, { stiffness: 700, damping: 40, mass: 0.6 });

// during pointer move: write motion values directly (no setState) ->
// commit the OKLCH value to Zustand only on pointer-up (engine = source of truth)
<motion.div
  style={{ x, y }}                 // direct transform = hardware accelerated
  drag dragMomentum={false}
  onDrag={(_, info) => setBaseLive(pointToOklch(info.point.x, info.point.y, ...))}
  onDragEnd={() => setBase(...)}
/>
```

This keeps the **engine authoritative** (Zustand commit on release), uses the existing `setBaseLive`/`setBase` split, and renders the marker via a **GPU transform** so dragging never triggers React reconciliation. Hardware-acceleration guidance: animate only `transform`/`opacity`/`filter`/`clipPath`; set `style={{ x, y }}` (the compound transform) rather than `left/top`; add `will-change: transform` on the marker; keep the shader canvas a sibling, not re-rendered on drag.

**Migration cost:** add `motion` (~one dep), wrap the marker. The wheel disk itself does not animate via Motion — it's the shader; Motion is for the marker, swatch transitions, slider thumb, and panel reveals. Additive, low risk.

---

## 4. App framework — keep Next.js 14 (DO NOT CHANGE)

A primarily-client design tool with one API route (`/api/agent`) is exactly what **Next.js App Router handles well**: the route handler is the *only* server/network path (matching the repo's "agent provider calls are server-side only" rule), and everything else is `"use client"`. Switching to **Vite + React** would buy marginally faster cold dev start and a simpler config, but you'd then have to **hand-roll the `/api/agent` server** (Vite is client-only; you'd add a small server / serverless function), lose Next's first-class deploy story, and **churn for no user-facing gain**. The shader and Motion work is identical under either.

- **Keep Next.js.** The bottleneck was never the framework.
- Reasonable forward step (optional): Next 15 + React 19 for the improved compiler/`useOptimistic` ergonomics — but only as routine maintenance, not for this perf project. Not required.
- **Keep Zustand 5** (the imperative live/commit split is perfect for the marker pattern in §3) and **Tailwind 3.4** (Tailwind 4 is an optional later bump; not load-bearing here).

---

## 5. Recommended target architecture + phased migration

### Target stack (opinionated)

- **Framework:** Next.js 14 (App Router) — *unchanged*.
- **State:** Zustand 5 — *unchanged*; keep the `setBaseLive` (drag) / `setBase` (commit) split.
- **Color values (canonical):** `packages/engine` on **culori**, deterministic, tested — *unchanged*.
- **Gamut-field rendering:** **WebGL2 fragment shader** via a thin `useGamutField` custom hook (no three.js/r3f). DPI-aware framebuffer. Canvas2D path retained only as a `gl===null` fallback.
- **Interaction/motion:** **Motion (`motion`)** — marker drag (spring `useMotionValue`), swatch/slider/panel micro-interactions, GPU transforms only.
- **Styling:** Tailwind 3.4 — *unchanged*.
- **No WASM.** Optional `maxChroma` memoization if profiling ever shows palette-gen latency.

### Phased migration (max impact first)

1. **Phase 1 — WebGL2 wheel (highest impact, ~1 day).** Add `useGamutField` hook + shaders; swap the pixel loop in `ColorWheel.tsx`; keep `pointToOklch`/`oklchToPoint` for hit-testing and the engine-driven marker. Render at `devicePixelRatio` for crisp retina; drive `u_L` from the lightness slider live. Add Canvas2D fallback. **Outcome: <1ms, crisp, smooth gamut edge, live lightness scrub.**
2. **Phase 2 — Motion marker & micro-interactions (~half day).** Add `motion`; convert the marker to `useMotionValue`+`useSpring`, commit to Zustand on drag-end. Animate swatch reveals, slider thumb, harmony spokes.
3. **Phase 3 — polish & generalize (optional).** Reuse the shader for any other continuous fields (chroma/hue strips, gradient previews) by parameterizing the fragment. Consider extracting shader strings to be WGSL-portable for a future WebGPU swap. Optional `maxChroma` memo.

### Explicitly DO NOT change

- **The engine's values or its reliance on culori** — it's the tested source of truth; the shader is display-only.
- **Next.js / Zustand / Tailwind** — no framework churn.
- **The agent→engine separation** (agent never emits raw color values).
- **No WASM** unless a future per-frame, megapixel, engine-accurate feature demands it.

---

## Sources

- **OKLab matrices & transfer function** — Björn Ottosson, "A perceptual color space for image processing" (public domain / MIT reference code): `https://bottosson.github.io/posts/oklab/` (indexed: *Bjorn Ottosson OKLab reference matrices*).
- **WebGL2 browser support** — caniuse "WebGL 2.0" (95.07% global; Safari 15+, Chrome 56+, FF 51+, Edge 79+): `https://caniuse.com/webgl2` (indexed: *caniuse WebGL2 support*).
- **WebGPU browser support** — caniuse "WebGPU" (82.76% global; Firefox flagged on all versions, Safari 26+ partial): `https://caniuse.com/webgpu` (indexed: *caniuse WebGPU support*).
- **Motion (hardware-accelerated transforms, springs, drag controls, motion values)** — Context7 `/websites/motion_dev` (motion.dev docs: react-animation, spring-value, react-motion-value, gsap-vs-motion, react-use-drag-controls).
- **Framer Motion (alt ID)** — Context7 `/grx7/framer-motion`.
- **Codebase (read directly):** `apps/web/src/components/ColorWheel.tsx`, `packages/engine/src/color.ts`, `packages/engine/src/palette.ts`, `packages/engine/src/ramps.ts`, `apps/web/package.json`, root `package.json`.
