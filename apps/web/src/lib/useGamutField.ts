"use client";

import { useEffect, useRef } from "react";
import { displayRgb255 } from "@chroma/engine";

/**
 * Renders the OKLCH gamut disk at a given lightness on a square canvas.
 *
 * The disk fills the canvas (radius = canvas/2), colored by OKLCH where the
 * angle is hue and the normalized radius is chroma × maxC. Out-of-gamut colors
 * are dimmed; the gamut boundary and the disk rim are antialiased.
 *
 * Primary path is a WebGL2 fragment shader: the OKLab→sRGB conversion and the
 * gamut-boundary test run once per output pixel on the GPU, so the disk is
 * crisp at native device resolution and redraws (e.g. on a lightness change)
 * in a single sub-millisecond draw call. Falls back to a CPU pixel loop (via
 * the engine's `displayRgb255`) when WebGL2 is unavailable.
 *
 * The engine remains the source of truth for color *values*; this is a
 * display-only approximation that uses the same OKLab matrices as culori.
 */
export function useGamutField(opts: {
  /** OKLCH lightness of the plane being shown (0…1). */
  L: number;
  /** Chroma at the rim (normalized radius 1.0). */
  maxC: number;
  /** CSS pixel size of the square canvas (disk diameter). */
  size: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const uniforms = useRef<Record<string, WebGLUniformLocation | null>>({});
  const fallbackRef = useRef(false);

  // One-time GL setup: compile the program and bind a fullscreen-quad VAO.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      premultipliedAlpha: false,
      alpha: true,
      // Keep the drawing buffer readable after compositing (image export,
      // reliable capture, and no blanking on some drivers). Cheap here since
      // we redraw only per interaction, not every frame.
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      fallbackRef.current = true;
      return;
    }
    const prog = compileProgram(gl, VERT_SRC, FRAG_SRC);
    if (!prog) {
      fallbackRef.current = true;
      return;
    }
    glRef.current = gl;
    progRef.current = prog;
    bindFullscreenQuad(gl, prog);
    uniforms.current = {
      L: gl.getUniformLocation(prog, "u_L"),
      maxC: gl.getUniformLocation(prog, "u_maxC"),
      aa: gl.getUniformLocation(prog, "u_aa"),
    };
    gl.clearColor(0, 0, 0, 0);
    return () => {
      gl.deleteProgram(prog);
      glRef.current = null;
      progRef.current = null;
    };
  }, []);

  // Redraw whenever L / size changes. WebGL path is a single draw call.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3);
    const px = Math.max(1, Math.round(opts.size * dpr));
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }

    const gl = glRef.current;
    const prog = progRef.current;
    if (gl && prog && !fallbackRef.current) {
      gl.viewport(0, 0, px, px);
      gl.useProgram(prog);
      gl.uniform1f(uniforms.current.L!, opts.L);
      gl.uniform1f(uniforms.current.maxC!, opts.maxC);
      // ~1.5 device px of rim antialiasing, in normalized (radius=1) units.
      gl.uniform1f(uniforms.current.aa!, 1.5 / (px / 2));
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return;
    }
    drawFallback(canvas, opts.L, opts.maxC);
  }, [opts.L, opts.maxC, opts.size]);

  return canvasRef;
}

const VERT_SRC = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  // y-flipped so v_uv matches screen space (origin top-left), keeping the
  // shader's hue angle consistent with the component's marker placement.
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform float u_L;     // OKLCH lightness (0..1)
uniform float u_maxC;  // chroma at the rim
uniform float u_aa;    // rim antialias width (normalized)

// OKLab (L,a,b) -> linear sRGB. Bjorn Ottosson, public domain.
vec3 oklab_to_linear_srgb(vec3 lab) {
  float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

// linear -> gamma sRGB (IEC 61966-2-1)
float lin2srgb(float c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

void main() {
  vec2 p = v_uv * 2.0 - 1.0;            // -1..1
  float r = length(p);
  float ang = atan(-p.y, p.x);          // y-up, hue 0 at +x

  float C = clamp(r, 0.0, 1.0) * u_maxC;
  float a = C * cos(ang);
  float b = C * sin(ang);

  vec3 lin = oklab_to_linear_srgb(vec3(u_L, a, b));

  // Out-of-gamut amount = worst channel distance outside [0,1].
  float over = max(
    max(max(-lin.r, -lin.g), -lin.b),
    max(max(lin.r - 1.0, lin.g - 1.0), lin.b - 1.0)
  );
  float gamut = 1.0 - smoothstep(0.0, 0.012, over);  // 1 in-gamut, 0 out

  vec3 rgb = clamp(lin, 0.0, 1.0);
  rgb = vec3(lin2srgb(rgb.r), lin2srgb(rgb.g), lin2srgb(rgb.b));
  rgb *= mix(0.18, 1.0, gamut);          // dim the unreachable region

  float edge = 1.0 - smoothstep(1.0 - u_aa, 1.0, r);  // AA the disk rim
  outColor = vec4(rgb, edge);
}`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[useGamutField] shader compile failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function compileProgram(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string,
): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vert);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("[useGamutField] program link failed:", gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

function bindFullscreenQuad(gl: WebGL2RenderingContext, prog: WebGLProgram) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  // Two triangles as a strip covering clip space.
  const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

/** CPU fallback (WebGL2 unavailable): the same disk via the engine's fast path. */
function drawFallback(canvas: HTMLCanvasElement, L: number, maxC: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const n = canvas.width;
  const img = ctx.createImageData(n, n);
  const c = n / 2;
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const dx = px - c;
      const dy = py - c;
      const r = Math.hypot(dx, dy) / c; // 0..1 at the disk edge
      const idx = (py * n + px) * 4;
      if (r > 1) {
        img.data[idx + 3] = 0;
        continue;
      }
      let hue = (Math.atan2(-dy, dx) * 180) / Math.PI;
      if (hue < 0) hue += 360;
      const { r: rr, g: gg, b: bb, inGamut } = displayRgb255({
        l: L,
        c: r * maxC,
        h: hue,
      });
      const f = inGamut ? 1 : 0.18;
      img.data[idx] = Math.round(rr * f);
      img.data[idx + 1] = Math.round(gg * f);
      img.data[idx + 2] = Math.round(bb * f);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
