# Repository Guidelines

## Project Structure & Module Organization

The package is an ESM plugin for DeepSeek Harness. `index.js` implements the host-side route and lifecycle; `client.js` provides the DSH UI integration. Reusable parsing, localization, and preference logic lives in `shared/`. The standalone Electron reader is under `runtime/`, with browser-facing files in `runtime/renderer/`. Translation catalogs are in `locale/`, user documentation and format examples are in `docs/`, and automated checks are in `tests/`. Keep host-only APIs out of renderer code and put cross-boundary logic in `shared/` when possible.

## Build, Test, and Development Commands

This repository has no compile step or third-party package dependencies.

- `node --test tests/parse.test.mjs` runs the fast parser, i18n, shortcut, and preference unit tests.
- `node tests/window-smoke.mjs` stages and drives the native reader window. It requires `/Applications/DeepSeek Harness.app` and macOS code signing tools. Set `FISHREAD_KEEP=1` to preserve `/tmp/fishread-smoke` for debugging.
- `ELECTRON_RUN_AS_NODE=1 "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" tests/host-e2e.mjs` exercises the host route and real Electron launch.
- `dsh plugin install /absolute/path/to/dsh-fishread` installs the local plugin into a DSH profile.

## Coding Style & Naming Conventions

Follow the existing JavaScript style: two-space indentation, single quotes, no semicolons, trailing commas in multiline literals, and `const` by default. Use `camelCase` for functions and variables, `PascalCase` for error classes, and kebab-case for Markdown or static asset filenames. Preserve native ESM imports and explicit `.js` extensions. There is no configured formatter or linter, so match nearby code and keep changes focused.

## Testing Guidelines

Tests use the built-in `node:test` runner and strict assertions. Name unit tests `*.test.mjs`; use descriptive behavior-focused test titles. Add unit coverage for changes in `shared/`, and run the platform smoke or end-to-end test when changing IPC, window lifecycle, runtime staging, or host routes. Tests must use temporary locations and must not modify a user's DSH data.

## Commit & Pull Request Guidelines

History currently contains only `init`, so no established commit syntax exists. Use short, imperative subjects such as `Fix chapter progress restoration`, and keep unrelated changes separate. Pull requests should explain user-visible behavior, list tests run, and note macOS/Windows impact. Link relevant issues and include screenshots or a short recording for reader-window or settings UI changes. Never commit imported novels, generated runtime bundles, credentials, or local application data.
