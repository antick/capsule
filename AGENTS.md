# Capsule

Project instructions for every agent working in this repository.

## Usage monitoring stays enabled; agent chat is suspended

The user clarified that only the added agent chat feature was to be disabled. Preserve the existing Claude, Codex, and Grok usage monitoring, percentage display, and refresh behavior. Do not interpret the chat suspension as authorization to disable usage monitoring. The chat source is TypeScript and was not ported; it is preserved in git history at the `electron-final` tag. Do not restore or run it, its setup commands, or live-provider chat tests. Passive activity notifications are additive and must not take over usage navigation. Do not claim the existing usage integrations carry a guarantee against account enforcement.

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

Capsule is a native macOS always-on-top AI usage dock, in Swift and AppKit. Specs and the current change live under `openspec/`. Visual source of truth for the HUD: `openspec/changes/init-capsule-desktop/references/hud-reference.jpg`.

## Stack

- Swift 6 with Swift Package Manager (`Package.swift` at the root). No third-party dependencies; any added one is pinned to an exact version published at least 7 days ago.
- AppKit for the dock panel, menus and windows; Core Animation for the dock's drawing and motion; SwiftUI only for the settings window and the card's contents.
- macOS 14 or newer, Apple silicon only.
- Modules: `CapsuleCore` (values, settings, placement, dates), `CapsuleUsage`, `CapsuleActivity`, `CapsuleHUD`, `CapsuleSystem` (the only module that touches the machine), `CapsuleDock`, `CapsuleSettingsUI`, `CapsuleShell`, `CapsuleApp`.
- Behaviour is pinned by the JSON corpus in `fixtures/`, read through `CapsuleFixtures`.

## Landing page

- `apps/landing` is the static site at capsule.potion.sh: Astro, plain CSS, pnpm, with its own `package.json` and lockfile. The repo is not a monorepo; there is no root `package.json`.
- Tools (node, pnpm, gitleaks, zizmor) are pinned in `mise.toml` with checksums in `mise.lock`. Use `mise run landing:dev`, `mise run landing:check` and `mise run security`.
- The page runs no JavaScript and inlines nothing; the CSP in `apps/landing/vercel.json` forbids it and `tests/site.test.mjs` checks it. Keep it that way.
- New dependencies are exact versions at least 7 days old, installed with `--ignore-scripts`; keep `pnpm-workspace.yaml`'s trust policy on and justify any exclusion there.
- Automatic deploys follow published releases (`.github/workflows/landing-deploy.yml`). Website-only updates may be deployed manually from main with `deploy_main: true`, through the same landing environment. Never enable Vercel's Git deployments.

## Workflows

- Every workflow has `permissions: {}` at the top and per-job permissions with a comment saying why. Checkouts use `persist-credentials: false`. Pin every action to a full commit SHA with its version in a comment.
- The repository only runs GitHub's own actions and those listed in Settings → Actions → General; a workflow using any other action fails to start. Add a new action's owner/name to that list (`gh api repos/antick/capsule/actions/permissions/selected-actions`) before using it.
- Never use `pull_request_target` or put `${{ }}` expressions inside `run:` scripts; pass them through `env:`.
- `mise run security:workflows` must report no findings.

## Conventions

- Conventional commits (see auto-commit above).
- No hard-coded values in app code — put them in `CapsuleCore`.
- Date and reset-time strings only through `CapsuleCore`'s formatters. Never format dates inline.
- Reuse components; do not duplicate HUD, date, or config logic.
- Source files stay at or under 500 lines; split when they would grow past that.
- Update `CHANGELOG.md` for every completed change.
- Add or update `openapi.json` only when an HTTP endpoint is added, changed, or removed. The app has no HTTP surface, so do not add OpenAPI until there is one.
- Prefer tests with the change: unit tests for usage, placement and date math; `CapsuleSnapshotTests` for anything drawn, compared against the reference.

## Heavy commands

- Run one test target at a time, in the background: `taskpolicy -b swift test --filter CapsuleDockTests`.
- `swift build` for the app product only when the change needs it: `taskpolicy -b scripts/bundle-macos.sh`.
- The whole `swift test` runs on CI.
