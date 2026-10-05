# Contributing to SplitMate AI

Thanks for helping! Whether it's your first open-source pull request or your
hundredth, you're welcome here. This guide gets you from zero to a merged PR.

## Ways to help

- **Pick up an issue.** Issues labelled
  [`good first issue`](https://github.com/bdhamithkumara/splitmate-ai/labels/good%20first%20issue)
  are small and well-scoped. Comment on one to claim it before you start, so
  two people don't work on the same thing.
- **Report a bug** or **suggest a feature** with the issue templates.
- **Improve the parser.** Send us real-world (anonymised!) WhatsApp expense
  messages it gets wrong. These are some of the most valuable contributions.
- **Improve the docs.** If something in the setup confused you, fix it for the
  next person.

## Setup

Follow [Getting started in the README](README.md#getting-started). You need
your own free Supabase project. Never commit `.env.local`.

## Workflow

1. **Fork** the repo and clone your fork.
2. Create a branch from `main`:
   ```bash
   git switch -c feat/short-description    # or fix/..., docs/...
   ```
3. Make your change. Keep each PR focused on one thing.
4. Check it before pushing:
   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```
   If you touched parsing (`lib/ai/`), also run `npm run parser:test` and
   include the result in your PR.
5. Commit using [Conventional Commits](https://www.conventionalcommits.org):
   ```text
   feat(import): support WhatsApp exports with dotted dates
   fix(balances): round settlements to cents
   docs: clarify Ollama setup on Windows
   ```
6. Push and open a pull request against `main`. Fill in the PR template,
   including screenshots for UI changes.

## Project conventions

These keep the codebase consistent and secure. Reviewers will check for them.

### Next.js 16

This project uses **Next.js 16**, which differs from older tutorials: for
example, `middleware.ts` is now `proxy.ts`, and `cookies()`, `headers()`,
`params` and `searchParams` are async. When in doubt, read the docs bundled at
`node_modules/next/dist/docs/` (see [AGENTS.md](AGENTS.md)).

- Prefer **Server Components**. Add `"use client"` only for interactivity
  (forms with state, buttons with handlers).
- Use **Server Actions** for mutations, and validate all input with **Zod** on
  the server, even when the form also validates in the browser.

### Data and security

- **Supabase logic stays out of UI components.** Reads go in `lib/data/`
  (marked `server-only`); writes go in `lib/**/actions.ts`.
- **Every table has Row Level Security.** New tables need policies in the same
  migration that creates them. Membership checks use
  `private.is_group_member(group_id)`. Don't query `members` from inside a
  `members` policy, which causes infinite recursion.
- **Never use the service role key.** The app only uses the public key, and
  access is enforced by RLS.
- **Multi-step writes go in one Postgres function** (see `create_expense`), so
  they succeed or fail together. Prefer `security invoker` so RLS still
  applies; use `security definer` only when unavoidable, with
  `set search_path = ''` and explicit checks.
- Money is split in **integer cents** to avoid rounding drift.

### Database changes

Never change the schema by hand in the dashboard. Add a new file in
`supabase/migrations/` named `YYYYMMDDHHMMSS_short_name.sql`, wrapped in
`begin; … commit;` and safe to re-run where possible (`if not exists`,
`create or replace`, `drop policy if exists`). Mention it in your PR so the
maintainer knows to apply it.

### Style

- TypeScript strict mode, no `any` unless there's no alternative.
- Match the surrounding code's naming and comment density. Comments explain
  *why*, not *what*.
- Tailwind for styling; support dark mode (`dark:` variants) and mobile widths.

## Code of conduct

Be kind and respectful. We follow the
[Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
Harassment or abuse of any kind isn't tolerated. Report problems to the
maintainer via a private GitHub message.

## Hacktoberfest

PRs that are merged, approved, or labelled `hacktoberfest-accepted` count
toward Hacktoberfest. Spammy or low-effort PRs (whitespace changes, rewording
for its own sake) will be closed and labelled `spam`. Quality over quantity!
