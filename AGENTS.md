# Repository Guidelines

## Project Structure & Module Organization

This repository is currently documentation-first. The only tracked content is [`docs/`](./docs), which holds the migration plan in `docs/ELECTRON_IMPLEMENTATION_PLAN.md`.

That plan defines the intended target layout for the Electron rewrite:

- `electron/src/main/` for app lifecycle, windows, menus, tray, and settings code
- `electron/src/preload/` for the minimal IPC bridge
- `electron/src/shared/` for shared types and config
- `electron/src/renderer/` for local renderer assets
- `electron/assets/` for icons and packaging assets

Until those directories exist, treat `docs/ELECTRON_IMPLEMENTATION_PLAN.md` as the source of truth for architecture and scope.

## Build, Test, and Development Commands

There are no runnable build or test commands committed yet. Before adding code, align new scripts with the planned Electron workflow in the design document.

Useful commands today:

- `ls docs` to inspect current repository contents
- `sed -n '1,200p' docs/ELECTRON_IMPLEMENTATION_PLAN.md` to review the implementation plan
- `git status` to confirm the workspace state before adding files

When the Electron app is introduced, keep developer commands explicit and scriptable, for example `npm run dev`, `npm run test`, and `npm run build`.

## Coding Style & Naming Conventions

Follow the conventions described in the migration plan:

- Use TypeScript for new Electron code
- Prefer small, single-purpose modules such as `window.ts`, `menu.ts`, and `navigation-policy.ts`
- Use kebab-case for file names and descriptive module names
- Keep preload APIs minimal and explicit

If linting or formatting tools are added, wire them into package scripts and document them here.

## Testing Guidelines

The planned stack calls for unit tests with `vitest` and end-to-end smoke coverage with Playwright. Place future tests beside the Electron implementation and keep names aligned with the module under test, such as `window.test.ts` or `session.spec.ts`.

Do not merge behavior changes without at least one reproducible verification step.

## Commit & Pull Request Guidelines

There is no commit history yet, so establish the convention now: use short, imperative commit subjects such as `Add Electron bootstrap` or `Document session persistence`.

Pull requests should include:

- a concise summary of the change
- references to the relevant section of `docs/ELECTRON_IMPLEMENTATION_PLAN.md`
- test or verification notes
- screenshots when UI, packaging, or desktop integration changes are involved
