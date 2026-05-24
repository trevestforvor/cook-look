/**
 * chroma — a composable, agent-friendly CLI over the Chroma color engine.
 *
 * Design follows agent-CLI conventions: a noun-verb command tree (so `--help`
 * is a clean exploration tree), structured `--json` output (default is
 * human-readable), commands that read/write the engine's Palette JSON on
 * stdin/stdout so they pipe together, and actionable error messages.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  adjustColor,
  auditPalette,
  fixContrast,
  generatePalette,
  nameColor,
  nameColors,
  parseToOklch,
  recolor,
  toCssVariables,
  toJSON,
  toTailwindConfig,
  type HarmonyType,
  type Palette,
  type Role,
} from "@chroma/engine";

const VERSION = "0.1.0";

const HARMONIES: HarmonyType[] = [
  "complementary",
  "split-complementary",
  "analogous",
  "monochromatic",
  "triadic",
  "tetradic",
  "square",
  "rectangular",
];

const ROLE_ORDER: Role[] = [
  "primary",
  "secondary",
  "accent",
  "neutral",
  "background",
  "surface",
  "foreground",
  "success",
  "warning",
  "danger",
];

/** An error whose message is safe and actionable to show the user. */
class CliError extends Error {}

function fail(message: string): never {
  process.stderr.write(`chroma: ${message}\n`);
  process.exit(1);
}

/* ----------------------------------------------------------------- helpers */

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A truecolor terminal swatch block, for human-readable output. */
function swatch(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[48;2;${r};${g};${b}m  \x1b[0m`;
}

function validateHarmony(value: string | undefined): HarmonyType {
  if (!value) return "complementary";
  if (!(HARMONIES as string[]).includes(value)) {
    throw new CliError(
      `unknown harmony "${value}". Valid harmonies: ${HARMONIES.join(", ")}.`,
    );
  }
  return value as HarmonyType;
}

interface CliValues {
  base?: string;
  harmony?: string;
  "analogous-span"?: string;
  chroma?: string;
  model?: string;
  use?: string;
  level?: string;
  lightness?: string;
  temperature?: string;
  saturation?: string;
  amount?: string;
  format?: string;
  file?: string;
  json?: boolean;
  help?: boolean;
  version?: boolean;
}

function num(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (Number.isNaN(n)) throw new CliError(`--${name} must be a number, got "${value}".`);
  return n;
}

/** Generate a palette from the generate-style flags (--base required). */
function generateFromFlags(values: CliValues): Palette {
  if (!values.base) {
    throw new CliError(
      "missing --base. Provide a base color, e.g. --base '#3b82f6' or --base 'oklch(62% 0.19 256)'.",
    );
  }
  const base = parseToOklch(values.base);
  if (!base) {
    throw new CliError(`could not parse --base "${values.base}". Use a hex, rgb(), oklch(), or CSS color name.`);
  }
  return generatePalette({
    baseColor: base,
    harmony: validateHarmony(values.harmony),
    options: {
      analogousSpan: num(values["analogous-span"], "analogous-span"),
      primaryChroma: num(values.chroma, "chroma"),
    },
  });
}

/** Resolve a Palette from stdin, --file, or (fallback) generate from --base. */
async function loadPalette(values: CliValues): Promise<Palette> {
  let raw: string | null = null;
  if (values.file) {
    try {
      raw = readFileSync(values.file, "utf8");
    } catch {
      throw new CliError(`could not read --file "${values.file}".`);
    }
  } else if (!process.stdin.isTTY) {
    const stdin = await readStdin();
    if (stdin.trim()) raw = stdin;
  }

  if (raw) {
    try {
      return JSON.parse(raw) as Palette;
    } catch {
      throw new CliError(
        "input is not valid palette JSON. Pipe one from `chroma palette generate --json`.",
      );
    }
  }

  if (values.base) return generateFromFlags(values);

  throw new CliError(
    "no palette input. Pipe one from `chroma palette generate --json`, pass --file <path>, or provide --base <color>.",
  );
}

/* -------------------------------------------------------------- renderers */

function out(text: string): void {
  process.stdout.write(text.endsWith("\n") ? text : text + "\n");
}

function renderPalette(palette: Palette): void {
  const names = nameColors({ palette });
  const audit = auditPalette({ palette });
  const lines: string[] = [];
  lines.push(
    `${palette.harmony} palette · base oklch(${Math.round(palette.baseColor.l * 100)}% ${palette.baseColor.c.toFixed(3)} ${Math.round(palette.baseColor.h)})`,
  );
  lines.push("");
  lines.push("  role         light            dark             name");
  for (const role of ROLE_ORDER) {
    const l = palette.light.roles[role];
    const d = palette.dark.roles[role];
    lines.push(
      `  ${role.padEnd(11)} ${swatch(l.hex)} ${l.hex}  ${swatch(d.hex)} ${d.hex}  ${names[role]}`,
    );
  }
  lines.push("");
  const clamped =
    audit.light.clamped.length + audit.dark.clamped.length;
  lines.push(
    `  accessibility: body text ${audit.passesBodyApca ? "PASS" : "FAIL"} (APCA Lc 75) · harmony ${audit.harmony.ok ? "verified" : "off-target"} · ${clamped} gamut-clamped`,
  );
  out(lines.join("\n"));
}

function renderAudit(palette: Palette): void {
  const audit = auditPalette({ palette });
  const lines: string[] = [];
  for (const mode of ["light", "dark"] as const) {
    lines.push(`${mode} mode:`);
    lines.push("  pairing                          APCA    WCAG   AA");
    for (const p of audit[mode].pairs) {
      const aa = p.wcag.AA.body ? "PASS" : "FAIL";
      const apcaFlag = p.apca.body ? " " : "!";
      lines.push(
        `  ${apcaFlag} ${p.label.padEnd(30)} ${String(p.apcaLc).padStart(6)}  ${p.wcagRatio.toFixed(2).padStart(5)}  ${aa}`,
      );
    }
    if (audit[mode].clamped.length > 0) {
      lines.push(`  gamut-clamped: ${audit[mode].clamped.join(", ")}`);
    }
    lines.push("");
  }
  lines.push(
    `harmony ${audit.harmony.harmony}: ${audit.harmony.ok ? "verified" : "off-target"} (expected offsets ${audit.harmony.expectedOffsets.join(", ")})`,
  );
  lines.push(`body text meets APCA Lc 75 in both modes: ${audit.passesBodyApca ? "yes" : "no"}`);
  out(lines.join("\n"));
}

/* ----------------------------------------------------------------- commands */

async function cmdPaletteGenerate(values: CliValues): Promise<void> {
  const palette = generateFromFlags(values);
  if (values.json) out(JSON.stringify(palette));
  else renderPalette(palette);
}

async function cmdPaletteAudit(values: CliValues): Promise<void> {
  const palette = await loadPalette(values);
  if (values.json) out(JSON.stringify(auditPalette({ palette })));
  else renderAudit(palette);
}

async function cmdPaletteFix(values: CliValues): Promise<void> {
  const palette = await loadPalette(values);
  const model = values.model === "wcag" ? "wcag" : "apca";
  const use =
    values.use === "large" || values.use === "nonText" ? values.use : "body";
  const level = values.level === "AAA" ? "AAA" : "AA";
  const { palette: fixed, changes, unreachable } = fixContrast({
    palette,
    target: { model, use, level },
  });
  if (values.json) {
    // Emit the bare palette (same shape as `generate --json`) so commands pipe.
    // Changes and unreachable targets go to stderr to stay out of the data stream.
    if (changes.length > 0) {
      process.stderr.write(`Applied ${changes.length} fix(es)\n`);
    }
    if (unreachable && unreachable.length > 0) {
      for (const u of unreachable) {
        process.stderr.write(
          `chroma: ${u.label}: could not reach target — best achievable ${model === "apca" ? "APCA Lc" : "WCAG"} ${u.best}\n`,
        );
      }
    }
    out(JSON.stringify(fixed));
  } else {
    if (changes.length === 0 && (!unreachable || unreachable.length === 0)) {
      out("No changes — palette already meets the target.");
    } else {
      if (changes.length > 0) {
        out(`Applied ${changes.length} fix(es):`);
        for (const c of changes) {
          out(`  ${c.label}: ${c.reason} (${c.before} → ${c.after})`);
        }
      }
      if (unreachable && unreachable.length > 0) {
        out(`Could not reach target for ${unreachable.length} pairing(s):`);
        for (const u of unreachable) {
          out(
            `  ${u.label}: best achievable ${model === "apca" ? "APCA Lc" : "WCAG"} ${u.best} (target ${u.target})`,
          );
        }
      }
      out("");
    }
    renderPalette(fixed);
  }
}

async function cmdPaletteRecolor(values: CliValues): Promise<void> {
  const palette = await loadPalette(values);
  let newBase;
  if (values.base) {
    const parsed = parseToOklch(values.base);
    if (!parsed) throw new CliError(`could not parse --base "${values.base}".`);
    newBase = parsed;
  }
  const newHarmony = values.harmony ? validateHarmony(values.harmony) : undefined;
  if (!newBase && !newHarmony) {
    throw new CliError("recolor needs --base <color> and/or --harmony <type>.");
  }
  const next = recolor({ palette, newBase, newHarmony });
  if (values.json) out(JSON.stringify(next));
  else renderPalette(next);
}

async function cmdPaletteAdjust(values: CliValues): Promise<void> {
  const palette = await loadPalette(values);
  const lightness =
    values.lightness === "lighter" || values.lightness === "darker"
      ? values.lightness
      : undefined;
  const temperature =
    values.temperature === "warmer" || values.temperature === "cooler"
      ? values.temperature
      : undefined;
  const saturation =
    values.saturation === "more" || values.saturation === "less"
      ? values.saturation
      : undefined;
  if (!lightness && !temperature && !saturation) {
    throw new CliError(
      "adjust needs at least one of --lightness lighter|darker, --temperature warmer|cooler, --saturation more|less.",
    );
  }
  const adjusted = adjustColor({
    color: palette.baseColor,
    intent: { lightness, temperature, saturation, amount: num(values.amount, "amount") },
  });
  const next = recolor({ palette, newBase: adjusted.after.oklch });
  if (values.json) out(JSON.stringify(next));
  else renderPalette(next);
}

async function cmdPaletteName(values: CliValues): Promise<void> {
  const palette = await loadPalette(values);
  const names = nameColors({ palette });
  if (values.json) out(JSON.stringify(names));
  else {
    for (const role of ROLE_ORDER) {
      out(`  ${role.padEnd(11)} ${swatch(palette.light.roles[role].hex)} ${names[role]}`);
    }
  }
}

async function cmdExport(values: CliValues): Promise<void> {
  const palette = await loadPalette(values);
  const format = values.format ?? "css";
  switch (format) {
    case "css":
      out(toCssVariables(palette));
      break;
    case "tailwind":
      out(toTailwindConfig(palette));
      break;
    case "json":
      out(toJSON(palette));
      break;
    default:
      throw new CliError(`unknown --format "${format}". Use css, tailwind, or json.`);
  }
}

function cmdColorAnalyze(values: CliValues, positionals: string[]): void {
  const color = positionals[2] ?? values.base;
  if (!color) {
    throw new CliError("usage: chroma color analyze <color>");
  }
  const o = parseToOklch(color);
  if (!o) throw new CliError(`could not parse "${color}".`);
  const result = {
    oklch: { l: Number(o.l.toFixed(3)), c: Number(o.c.toFixed(3)), h: Math.round(o.h) },
    family: nameColor(o),
  };
  if (values.json) out(JSON.stringify(result));
  else {
    out(
      `  ${nameColor(o)}  ·  oklch(${Math.round(o.l * 100)}% ${o.c.toFixed(3)} ${Math.round(o.h)})  ·  hue ${Math.round(o.h)}°`,
    );
  }
}

function cmdHarmonyList(values: CliValues): void {
  if (values.json) out(JSON.stringify(HARMONIES));
  else {
    out("Harmonies (computed in OKLCH hue space):");
    for (const h of HARMONIES) out(`  ${h}`);
  }
}

/* -------------------------------------------------------------------- help */

const HELP = `chroma — color-theory design engine CLI (OKLCH, APCA + WCAG)

USAGE
  chroma <noun> <verb> [options]

  Palette commands read a palette as JSON on stdin (or --file), so they pipe:
    chroma palette generate --base '#3b82f6' --harmony triadic --json \\
      | chroma palette audit

COMMANDS
  palette generate   Build a light+dark role palette from a base color.
      --base <color>          base color: hex, rgb(), oklch(), or CSS name (required)
      --harmony <type>        ${HARMONIES.join(" | ")}
      --analogous-span <deg>  span for analogous harmony (default 30)
      --chroma <0..0.37>      override the primary chroma
      --json                  emit the full Palette as JSON (for piping)

  palette audit      Full APCA + WCAG + harmony + gamut report.
  palette fix        Minimally nudge colors to meet a contrast target.
      --model apca|wcag       default apca
      --use body|large|nonText  default body
      --level AA|AAA          default AA (wcag only)
  palette recolor    Re-derive preserving roles: --base <color> and/or --harmony <type>.
  palette adjust     Perceptual shift: --lightness lighter|darker,
                     --temperature warmer|cooler, --saturation more|less, --amount <0..1>
  palette name       Deterministic descriptive names per role.

  export             Emit design tokens: --format css|tailwind|json
  color analyze <color>   Read a color into OKLCH hue/chroma/lightness + family.
  harmony list       List the supported harmonies.

INPUT FOR palette audit/fix/recolor/adjust/name and export
  Provide the palette one of three ways (checked in order):
    1) pipe palette JSON on stdin
    2) --file <path>
    3) --base <color> [--harmony <type>]   (generates one first)

GLOBAL
  --json        machine-readable output
  --help        show this help
  --version     print version

EXAMPLES
  chroma palette generate --base '#1f9d55' --harmony analogous
  chroma palette generate --base '#1f9d55' --harmony analogous --json | chroma palette fix
  chroma color analyze 'rebeccapurple'
  chroma export --format tailwind --base '#3b82f6' --harmony triadic`;

/* ---------------------------------------------------------------- dispatch */

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    strict: false,
    options: {
      base: { type: "string" },
      harmony: { type: "string" },
      "analogous-span": { type: "string" },
      chroma: { type: "string" },
      model: { type: "string" },
      use: { type: "string" },
      level: { type: "string" },
      lightness: { type: "string" },
      temperature: { type: "string" },
      saturation: { type: "string" },
      amount: { type: "string" },
      format: { type: "string" },
      file: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
    },
  });
  const v = values as CliValues;

  if (v.version) {
    out(VERSION);
    return;
  }

  const noun = positionals[0];
  const verb = positionals[1];

  if (!noun || noun === "help" || v.help) {
    out(HELP);
    return;
  }

  const key = `${noun} ${verb ?? ""}`.trim();
  switch (key) {
    case "palette generate":
      return cmdPaletteGenerate(v);
    case "palette audit":
      return cmdPaletteAudit(v);
    case "palette fix":
      return cmdPaletteFix(v);
    case "palette recolor":
      return cmdPaletteRecolor(v);
    case "palette adjust":
      return cmdPaletteAdjust(v);
    case "palette name":
      return cmdPaletteName(v);
    case "export":
      return cmdExport(v);
    case "color analyze":
      return cmdColorAnalyze(v, positionals);
    case "harmony list":
      return cmdHarmonyList(v);
    default:
      throw new CliError(
        `unknown command "${key}". Run \`chroma --help\` for the command list.`,
      );
  }
}

main().catch((err) => {
  if (err instanceof CliError) fail(err.message);
  fail(err instanceof Error ? err.message : String(err));
});
