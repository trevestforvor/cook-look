// apps/web/src/lib/roles.ts
import type { Role, RampRole } from "@chroma/engine";

/** Brand layer (top): the brand families + their container pairs. */
export const BRAND_ROLES: Role[] = [
  "primary",
  "secondary",
  "accent",
  "primary-container",
  "secondary-container",
  "accent-container",
];

/** Neutral & surface layer: neutrals, surfaces, outlines, foreground tiers. */
export const NEUTRAL_ROLES: Role[] = [
  "neutral",
  "background",
  "surface",
  "foreground",
  "surface-elevated",
  "background-elevated",
  "outline",
  "outline-variant",
  "foreground-secondary",
  "foreground-tertiary",
];

/** Semantic layer (below brand): status roles. */
export const SEMANTIC_ROLES: Role[] = ["success", "warning", "danger"];

/** The three display layers, in render order (semantics below brand). */
export const ROLE_LAYERS: { id: "brand" | "neutral" | "semantic"; label: string; roles: Role[] }[] = [
  { id: "brand", label: "Brand", roles: BRAND_ROLES },
  { id: "semantic", label: "Semantic", roles: SEMANTIC_ROLES },
  { id: "neutral", label: "Neutral & Surface", roles: NEUTRAL_ROLES },
];

/** Roles shown by default (today's 10). The remaining 9 are addable. */
export const DEFAULT_VISIBLE_ROLES: Role[] = [
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

/** Engine roles that carry a full tonal ramp. */
const RAMP_ROLE_SET = new Set<Role>([
  "primary",
  "secondary",
  "accent",
  "neutral",
  "success",
  "warning",
  "danger",
]);

export function isRampRole(role: Role): role is RampRole {
  return RAMP_ROLE_SET.has(role);
}

/** Every engine role, in layer order. */
export const ALL_ROLES: Role[] = ROLE_LAYERS.flatMap((l) => l.roles);
