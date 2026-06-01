# Color Palette Fixer — reverse-engineered color math

Source: `/Users/trevest/Downloads/Color Palette Fixer – The Color Palette Studio_files/index-C4uXUs7L.js`
(1.27 MB, 607 minified lines). Beautified copy written to `.planning/fixer-beautified.js` (52,650 lines);
all line numbers below refer to the beautified copy. OBSERVED = read directly in code; INFERRED = deduced.

## TL;DR
- **Color space:** OKLCH/OKLab, via **chroma.js** (bundled) for conversions+contrast+deltaE, plus
  **culori** (also bundled) for the mode/`fromMode`/`toMode` machinery. Standard OKLab matrices, hand-rolled
  matrix mult, `Math.cbrt` forward / `**3` inverse. NOT hand-rolled color math — it's two libraries.
- **Contrast model:** **WCAG ratio only** in the actual app logic. chroma.js ships an APCA impl
  (`contrastAPCA`) but **the app never calls it** — dead code. UI standard toggles A/AA/AAA = 3 / 4.5 / 7.
- **Outlier metric:** robust per-channel **median + MAD** in OKLCH (L, C, H separately), NOT a single
  deltaE-to-centroid. Hue IS handled with **circular/wraparound math** (atan2 of summed sin/cos for the
  center; min(d,360−d) for spread/distance). deltaE (CIEDE2000) is used only for dedup of suggestions.
- **Fix algorithm:** moves the offending OKLCH channel(s) toward the palette median (full snap, or 60%
  blend when a locked color is present), clamps L∈[0.05,0.95], rebuilds hex via OKLCH→sRGB (gamut-mapped).
- **Client vs server:** 100% client-side compute. No fetch/XHR/axios/`/api`/LLM call anywhere in the
  color-analysis/suggest/fix code paths.

---

## 1. Color space & conversions — chroma.js (OKLab/OKLCH)

The bundle contains chroma.js. `we` is the `chroma` object. Helper `v1(matrix, vec)` does matrix×vector.

**sRGB → OKLab forward** (`ub` @ 17778, math in `yG` @ 17783). OBSERVED — note chroma.js's `yG` is the
LMS→sRGB *inverse* matrices reused; the forward path applies linear-sRGB, then the two OKLab matrices:

```js
// OKLab forward (linear sRGB -> LMS -> cbrt -> Lab) — standard Björn Ottosson matrices
M1 = [ [0.4122214708, 0.5363325363, 0.0514459929],   // (these specific numbers live in chroma's lrgb->lms)
       ... ]                                          // see vG inverse below for the exact bundled values
n = v1(M1, linearRGB);
return v1(M2, n.map(a => Math.cbrt(a)));              // cbrt is the OKLab nonlinearity (line 17795)
```

**OKLab → sRGB inverse** (`cb` @ 17758 → `vG` @ 17764). OBSERVED, exact bundled constants:

```js
function vG(e) {                       // OKLab {l,a,b} -> linear LMS -> linear sRGB
  var t = [   // LMS' -> linear sRGB
    [ 1.2268798758459243, -0.5578149944602171,  0.2813910456659647],
    [-0.0405757452148008,  1.1122868032803170, -0.0717110580655164],
    [-0.0763729366746601, -0.4214933324022432,  1.5869240198367816]];
  var r = [   // Lab -> LMS' (the "1, ±0.39.., ±0.21.." matrix)
    [1,  0.3963377773761749,  0.2158037573099136],
    [1, -0.1055613458156586, -0.0638541728258133],
    [1, -0.0894841775298119, -1.2914855480194092]];
  var n = v1(r, e);
  return v1(t, n.map(A => A ** 3));     // inverse nonlinearity = cube (line 17776)
}
```
These are the canonical OKLab matrices (matches Ottosson / culori / colorjs). So: **hand-rolled? No — it's
chroma.js**, with standard matrix constants. culori is ALSO present (separate `mode:"oklch"` converters,
e.g. circular-hue average `ys` @ 17386-area / 44386). The app's OKLCH conversions use the wrappers
`Vt` (hex→[L,C,H]) and `ft` ({l,c,h}→hex):

```js
function Vt(e){ const t=_M(e); return [t?.l||0, t?.c||0, t?.h||0]; }   // line 46531, _M is culori oklch converter
function ft(e){ const t={mode:"oklch",l:e.l,c:e.c,h:e.h||0};
  if(!eC("rgb")(t)){ const r=Bie(t,"rgb"); return ZS(r)||"#000000"; }   // out-of-gamut -> gamut map (Bie)
  return ZS(t)||"#000000"; }                                            // line 46571
```
`Vt` returns L in 0–1, C in OKLCH chroma units, H in degrees.

---

## 2. Contrast — WCAG used; APCA present but unused

**WCAG ratio.** chroma's `contrast` = `JG` (line 18267), and the app also defines its own `bie` (line 46495):

```js
const JG = (e,t) => { const r=e.luminance(), n=t.luminance();           // chroma.js, line 18267
  return r>n ? (r+.05)/(n+.05) : (n+.05)/(r+.05); };
function bie(e,t){ let r=e6(e), n=e6(t);                                 // app, line 46495
  return (Math.max(r,n)+.05)/(Math.min(r,n)+.05); }                     // standard (L1+.05)/(L2+.05)
```
chroma's relative luminance uses coeffs **0.2126 / 0.7152 / 0.0722** (standard sRGB; in `luminance()`).

**APCA** (chroma.js, `t$` @ 18292, with the documented Myndex constants). OBSERVED — all the magic numbers
the brief asked about are here:

```js
const $3=0.027, ZG=5e-4, e$=0.1, V3=1.14, Cp=0.022, W3=1.414;          // lines 18286-18291
const t$ = (e,t) => {                                                   // contrastAPCA
  const r=q3(...e.rgb()), n=q3(...t.rgb());                             // q3 = sRGB->Y (line 18304)
  const A = r>=Cp ? r : r+Math.pow(Cp-r, W3);                           // soft-clamp black, 0.022 / exp 1.414
  const o = n>=Cp ? n : n+Math.pow(Cp-n, W3);
  const i = Math.pow(o,0.56) - Math.pow(A,0.57);                        // normal-polarity exponents
  const s = Math.pow(o,0.65) - Math.pow(A,0.62);                        // reverse-polarity exponents
  const a = Math.abs(o-A)<ZG ? 0 : A<o ? i*V3 : s*V3;                   // scale 1.14
  return (Math.abs(a)<e$ ? 0 : a>0 ? a-$3 : a+$3) * 100;                // clamp 0.1, offset 0.027 -> Lc
};
function q3(e,t,r){ return 0.2126729*Math.pow(e/255,2.4)               // line 18304: APCA Y, exponent 2.4
                         + 0.7151522*Math.pow(t/255,2.4)
                         + 0.072175 *Math.pow(r/255,2.4); }
```
Registered as `we.contrastAPCA` (line 18684). **No app callsite found** — the analysis/suggest/fix code and
the contrast-testing UI use `we.contrast` (WCAG) exclusively. The 241 "Lc" hits in the raw bundle are mostly
the unrelated minified identifier `Lc` (a clamp helper, line 18523) and a WebP-decoder field, NOT APCA Lc.

**Thresholds the app targets** (WCAG ratios, line 20735 / 52109): A = **≥3**, AA = **≥4.5**, AAA = **≥7**.
Suggestion-acceptance uses `we.contrast(...) >= 4.5` (e.g. lines 47726, 47862, 49234, 49316) and the
outlier "contrastSafe" gate `Wc` (line 47380) requires ratio **≥3** against ≥40% of the palette:
```js
function Wc(e,t){ let r=0; t.forEach(n=>{ const A=bie(e,n.hex); if(A&&A>=3) r++; });
  return r >= Math.max(1, Math.floor(t.length*0.4)); }                  // line 47380
```
So **"fix" optimizes WCAG, not APCA.**

---

## 3. Harmony-outlier detection — `hi()` @ 46872 (THE feature)

Does NOT compute a single OKLab centroid or a deltaE-to-mean. Instead it builds robust **per-channel**
statistics over the non-neutral colors, in OKLCH:

```js
// i = non-neutral colors mapped to {color,l,c,h}; s=L[], a=C[], l=H[] (hue, only h>0)
c = di(s);                       // L median   (di = median, line 46565)
f = di(a);                       // C median
x = W1(s, c, 0.015);             // L MAD (median abs deviation, floor 0.015), line 46557
g = W1(a, f, 0.008);             // C MAD (floor 0.008)
w = l.length>0 ? Hh(l) : 0;      // hue CENTER = circular mean (line 46540)
C = l.length>1 ? UM(l, w) : 0;   // hue SPREAD = max circular distance from center (line 46548)
```

**Circular hue math — YES, fully wraparound (OBSERVED):**
```js
function Hh(e){                                  // circular mean hue (line 46540)
  const t = e.map(o => o*Math.PI/180);
  const r = t.reduce((o,i)=>o+Math.sin(i),0);
  const n = t.reduce((o,i)=>o+Math.cos(i),0);
  return (Math.atan2(r/e.length, n/e.length)*180/Math.PI + 360) % 360;
}
function UM(e,t){                                 // hue spread = max wrapped distance (line 46548)
  const r = e.map(n => { const A=Math.abs(n-t); return Math.min(A, 360-A); });
  return Math.max(...r);
}
function kM(e,t){                                 // signed shortest hue delta (line 47374)
  const r=e-t, n=r+(r>0?-360:360);
  return Math.abs(r)<Math.abs(n) ? r : n;
}
```
(culori's `ys` @ 44386 is an identical circular-mean used by its averaging machinery.)

**Per-color flagging** (loop @ 46937). Each color gets up to several issue categories; the THRESHOLDS:

- **Saturation outlier** (line 46945): `H=|C−Cmedian|`, threshold `O=max(2·chromaMAD, 0.025)`.
  Flag if `H>O` OR `C>0.25 && Cmedian<0.12` OR (`ae`: `C>0.3 && Cmedian<0.18`, a "lone saturated in a
  muted palette" rule). severity `= min(H/(MAD+0.01), 1)`.
- **Lightness outlier** (line 46967): `X=|L−Lmedian|`, threshold `ne=max(2·lightnessMAD, 0.05)`.
  Flag if `X>ne` (with neutral exemptions). Issue text: `L>Lmedian` → "Too bright…", else
  **"Too dark compared to palette"** (or "Too dark — brighten to match locked color" when a locked color
  exists). severity `= min(X/(MAD+0.02), 1)`. → this is the brief's "too dark" branch.
- **Visual dominance** (line 46988, INFERRED-named): if `L>0.82 && C>0.06 && L−Lmedian>0.18`, and
  especially if it's the only "warm"/"cool" tone (hue-bucketed), build a darken suggestion toward
  `V = L·0.35 + Lmedian·0.65`; only emitted if severity `z>0.65`.
- **Hue disharmony** (line 47014): only when `hueCount>2 && 30<hueSpread<90`. Distance
  `I=min(|H−Hcenter|, 360−|H−Hcenter|)` (wrapped); flag if `I > max(hueSpread, 60)`; suggested hue = the
  circular center `w`; severity `= min(I/140,1)*0.7`.

There is **no global deltaE outlier threshold**; deltaE (CIEDE2000) is used downstream only to *reject
near-duplicate suggestions* (thresholds 2,3,5,6,8,12 at various callsites, e.g. 47064, 49372, 50708).

---

## 4. The "fix" / suggested replacement — `hi()` tail @ 47038

When a color has issues, it picks the max-severity issue; if `severity>0.65` it computes a corrected OKLCH:

```js
let T=L, K=M /*C*/, D=R /*H*/;            // start from the color's own OKLCH
const z = 0.6;                            // blend factor when a locked color anchors the palette
k.forEach(Fe => {                         // k = the issues on this color
  if (Fe.category==="lightness") { const pe = Fe._suggestedLightness ?? y /*L target*/;
       T = (o && !S.locked) ? L + (pe - L)*z : pe; }          // 60% toward target, else full snap
  else if (Fe.category==="saturation") { K = (o && !S.locked) ? M + (p - M)*z : p; }  // p = C target
  else if (Fe.category==="hue") { D = w; }                    // snap hue to circular center
});
// extra nudges toward locked-color targets if not already corrected on that axis ...
let V = ft({ l: Math.max(0.05, Math.min(0.95, T)),           // clamp L to [0.05,0.95]
             c: Math.max(0.01, K),
             h: (D + 360) % 360 });                          // then dedup vs palette via deltaE<12 (Ae=12)
```
`y` = lightness target (= locked-colors' median L if any locked, else palette L median `c`).
`p` = chroma target (= locked-colors' median C if any, else palette C median `f`).
So: **moves L, C, and/or H** (whichever axis is the outlier) **toward the palette median** (or toward
the *locked* colors' median when the palette has locked anchors), full snap normally, 60% partial blend
when locking is active and the color is unlocked. L clamped to [0.05, 0.95]. Result gamut-mapped to hex.

The "add-companion" opportunity path (`Sie` @ 46755) instead *adds* a new color:
- saturation: `c = min(0.35, C·2.2)` (boost), keep L,H
- hue: `h = (H+30)%360` (warm shift +30°), `c = C·0.9`
- tone: push L by ±0.4 (away from median), `c = C·0.8`

Neutral temperature fix (`Nie` @ 46817): classifies palette warm/cool by hue buckets
(warm `h≤90 || h≥315`, cool `120≤h≤300`), and if a neutral's temperature mismatches, rebuilds it at the
palette hue center with `c = min(neutralC, 0.03)` (tinted neutral).

---

## 5. Variations / adjust — HSL-based harmony generators

`gx`/`mx`/`QM` (lines 46786–46815) generate analogous/triadic/tetradic companions, but in **HSL**
(`we.hsl`), NOT OKLCH: analogous steps `±30°` per step, triadic `+120/+240`, tetradic `+90/+180/+270`,
keeping S and L fixed. (INFERRED purpose from the rotations.) The primary OKLCH "fix" deltas are the
chroma×2.2, ±0.4 L, +30° H factors in `Sie` above. No explicit vibrant/muted/warmer/cooler slider→OKLCH
mapping beyond these; temperature is handled categorically (hue buckets), not as a continuous OKLCH delta.

---

## 6. Client vs server — 100% client-side

OBSERVED: across the entire color region (beautified lines 46500–51300), there are **0** occurrences of
`fetch(`, `XMLHttpRequest`, `axios`, `/api`, or any LLM endpoint (`supabase|openai|anthropic|gpt|/v1/`).
The ~74 raw `fetch` hits in the bundle are all in unrelated vendor code (analytics, Shopify, GTM, pixels).
All palette analysis, outlier detection, suggestion, and fix computation run synchronously in the browser
via the bundled chroma.js + culori. **No fix/suggest path touches the network.**

---

## Comparison notes vs an OKLCH+APCA engine
- They share OKLCH as the working space and the same OKLab matrices.
- Biggest divergence: **contrast is WCAG, not APCA** (APCA code is shipped-but-dead). An APCA-first engine
  is materially different / arguably more correct for UI text.
- Their outlier detector is **robust per-channel median+MAD with circular hue**, not a perceptual
  deltaE-to-centroid. Clean and explainable; misses correlated L/C/H outliers a deltaE2000 metric would catch.
  deltaE2000 IS available (`we.deltaE`) but used only for de-duping suggestions, not for "fit".
- Fixes are **median-snapping per axis** with locked-anchor 60% blends and an L-clamp [0.05,0.95];
  no contrast-aware optimization in the snap (contrast checked only as a pass/fail `≥3`/`≥4.5` gate after).
