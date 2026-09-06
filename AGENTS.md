# Capsule

Project instructions for every agent working in this repository.

## Usage monitoring stays enabled; agent chat is suspended

The user clarified that only the added agent chat feature was to be disabled. Preserve the existing Claude, Codex, and Grok usage monitoring, percentage display, and refresh behavior. Do not interpret the chat suspension as authorization to disable usage monitoring. Keep chat source preserved but inactive; do not run its setup commands or live-provider chat tests. Passive activity notifications are additive and must not take over usage navigation. Do not claim the existing usage integrations carry a guarantee against account enforcement.

## Git: always auto-commit

After every completed task that produces file changes, **create a git commit yourself before ending the turn.** This is a standing instruction for this repo.

- Do **not** wait for the user to ask.
- Do **not** stop at a suggested commit message. Commit.
- This rule overrides any default habit of only proposing a commit.
- Stage **only** the files you changed for the current task. Leave unrelated dirty or staged files alone.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `build`, `ci`.
- Subject line: `type: imperative summary` — lowercase after the type, no trailing period, about 72 characters or less.
- Write the message with a HEREDOC (`git commit -m "$(cat <<'EOF' ... EOF)"`).
- Never update git config.
- Never force-push, never amend a commit that is not yours, never skip hooks unless the user asks.
- Never commit secrets, `.env`, credentials, keychains, or files that look like secrets.
- Do **not** `git push` unless the user explicitly asks.
- If there is nothing to commit, say so. If the commit fails, report the error and the `git status` output.

## Product

Capsule is a macOS always-on-top AI usage dock. Specs and the current change live under `openspec/`. Visual source of truth for the HUD: `openspec/changes/init-capsule-desktop/references/hud-reference.jpg`.

## Stack

- pnpm workspaces + Turborepo. Never use npm or yarn as the workspace package manager.
- Electron + Node (main), React + TanStack Router file-based (renderer).
- Tailwind CSS + shadcn/ui for settings; the HUD is custom.
- Biome for lint and format (no ESLint/Prettier).
- Pin dependency versions; do not add a package published less than 7 days ago.

## Conventions

- Conventional commits (see auto-commit above).
- No hard-coded values in app code — put them in the shared config package.
- Date and reset-time strings only through the shared date util. Never format dates inline.
- Reuse components; do not duplicate HUD, date, or config logic.
- Source files stay at or under 500 lines; split when they would grow past that.
- Update `CHANGELOG.md` for every completed change.
- Add or update `openapi.json` only when an HTTP endpoint is added, changed, or removed. v1 is Electron IPC, so do not add OpenAPI until there is an HTTP surface.
- Prefer tests with the change (unit tests for usage/placement/date math; HUD visual checks against the reference).
