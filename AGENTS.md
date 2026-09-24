# Agent Instructions

This project's full context, architecture rules, and workflow live in
[`CLAUDE.md`](./CLAUDE.md). Read it before making any change.

Non-negotiable rules:

1. Respect the layer boundaries: `tests → services → pages → utils/config`.
   Never import `services` from `pages`, or anything from `tests`.
2. Build in order: data → page → service → spec.
3. Every commit message needs an `AP-123` or `#123` ticket reference.
4. Never commit directly to `master` or `stage`.
5. No `any`, no `@ts-ignore`, no `console.log` in committed code.
