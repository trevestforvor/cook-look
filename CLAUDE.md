# Chroma — repo guide for Claude

pnpm monorepo (strict TypeScript). Three packages + a Next.js app:
- `packages/engine` — deterministic OKLCH color engine (pure; no network/LLM/React). Source of truth for all color math.
- `packages/agent` — provider-agnostic AI design agent over the engine.
- `packages/cli` — the `chroma` CLI over the engine.
- `apps/web` — Next.js editor + `/api/agent` route.

## Commands
- `pnpm install` — install workspace deps.
- `pnpm test` — run engine + agent test suites (Vitest). Run after changing either package.
- `pnpm typecheck` — strict typecheck all packages. Run after code changes.
- `pnpm dev` — run the editor at http://localhost:3000.
- `pnpm build:cli` — build the `chroma` CLI to `packages/cli/dist/index.js`.

## Color work → use the `chroma` CLI
For any task involving color palettes, themes, contrast/accessibility fixes, or
design tokens, use the **chroma** skill (`.claude/skills/chroma/SKILL.md`) and
the CLI: build once with `pnpm build:cli`, then run
`node packages/cli/dist/index.js --help`. The engine owns all color values —
call the CLI rather than hand-writing hex or doing color math.

## Conventions
- The AI agent must never emit color values directly — only via engine tools. Keep that separation when editing `packages/agent`.
- Engine and CLI are deterministic and fully testable without network or API keys; the agent's provider calls are the only network path (server-side only).
- ESM throughout; engine/agent/cli use `.js` import specifiers that resolve to `.ts` source.
