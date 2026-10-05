# SplitMate AI

**Turn WhatsApp-style messages into shared expenses.** SplitMate AI helps
roommates and friends split dinners, groceries, parties and rides without a
spreadsheet: type the message you'd send to the group, or import the whole
WhatsApp chat, and it works out who owes whom.

```text
"Uber 1200 Kasun"                                        → Kasun paid LKR 1,200, split with the group
"3000 (Sidath,Dhamith)"                                  → LKR 3,000 split between Sidath and Dhamith
"Kasun paid 4500 LKR for dinner with Hasaru and Dhamith" → read by a local AI model
```

Built for [Hacktoberfest 2026](https://hacktoberfest.com). Contributions are
welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## Features

- **Natural-language expenses.** Common short formats are parsed instantly by
  rules; free-form messages go to a **local, open-source model** (Gemma 3 via
  Ollama), so no message leaves your machine for an AI API.
- **Review before saving.** Every parsed expense opens as an editable preview:
  amount, payer, and who shares it.
- **WhatsApp chat import.** Upload the `.zip`/`.txt` from *Export chat*, pick a
  date range, map senders to members, review, and import in bulk. The chat is
  read in your browser; only selected expenses are saved. Re-importing skips
  duplicates.
- **Exact equal splits.** Amounts are split in cents, so shares always add up
  (`1000 / 3 = 333.34 + 333.33 + 333.33`).
- **Balances and settle up.** Shows who owes whom in the fewest payments, and
  lets you record full or partial paybacks.
- **Groups and invite links.** Share one link in your WhatsApp group; friends
  sign up and claim their name.
- **Secure by default.** Supabase Auth plus Row Level Security on every table:
  you can only see and change groups you belong to.

## Tech stack

| Area | Tools |
| --- | --- |
| App | [Next.js 16](https://nextjs.org) (App Router, Server Components, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Data and auth | [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security), `@supabase/ssr` |
| AI | [Ollama](https://ollama.com) + `gemma3:4b`, with structured JSON output validated by [Zod](https://zod.dev) |
| Chat import | [fflate](https://github.com/101arrowz/fflate) for reading zips in the browser |

## Getting started

### Prerequisites

- Node.js 20 or newer
- A free [Supabase](https://supabase.com) project
- *(Optional)* [Ollama](https://ollama.com) for free-form messages. Without it,
  everything else works, including short formats and imports.

### 1. Clone and install

```bash
git clone https://github.com/bdhamithkumara/splitmate-ai.git
cd splitmate-ai
npm install
```

### 2. Set up the database

In your Supabase project, open **SQL Editor** and run each file in
[`supabase/migrations/`](supabase/migrations) **in filename order**, one at a
time (New query → paste the whole file → Run):

1. `20261003000000_initial_schema.sql`: tables
2. `20261004000000_fix_members_rls_recursion.sql`: access rules
3. `20261004010000_groups_and_members.sql`
4. `20261004020000_create_expense.sql`
5. `20261004030000_chat_import.sql`
6. `20261005000000_edit_delete_expenses.sql`
7. `20261005010000_group_invites.sql`
8. `20261005020000_settlements.sql`

Each should report *Success*. If you use the
[Supabase CLI](https://supabase.com/docs/guides/cli), `supabase link` followed
by `supabase db push` applies them all.

Then go to **Authentication → URL Configuration** and add
`http://localhost:3000/auth/callback` to **Redirect URLs**.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
from **Project Settings → API Keys**. Only public keys belong here. Never put
the service role / secret key in this project.

### 4. (Optional) Start the local AI model

```bash
ollama pull gemma3:4b
ollama serve   # if it isn't already running
```

On a CPU-only machine each free-form message can take up to a minute. Short
formats skip the model entirely.

### 5. Run it

```bash
npm run dev
```

Open <http://localhost:3000>, sign up, create a group, add members, and try
`Uber 1200 Kasun`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run the TypeScript compiler |
| `npm run parser:test` | Run sample messages through the parser (rules + Ollama) and report accuracy. Pass a message to try one: `npm run parser:test -- "Pizza 2400 Hasaru"` |

## Project structure

```text
app/
  (auth)/            login and signup pages
  (app)/             signed-in pages: dashboard, groups, chat import, invites
  auth/callback/     email confirmation / OAuth return route
lib/
  ai/                message parsing: quick rules, Ollama model, name matching
  chat/              WhatsApp export reader (runs in the browser)
  expenses/          server actions, validation, balances, payer resolution
  data/              server-only data access (queries go through RLS)
  supabase/          Supabase clients for browser, server and proxy
supabase/migrations/ database schema, policies and functions, in order
scripts/             developer tools (parser accuracy test)
proxy.ts             session refresh and route protection (Next.js 16 "proxy")
```

## How parsing works

1. **Quick rules** (`lib/ai/quick-parse.ts`) handle formats like
   `Uber 1200 Kasun` and `3000 (Sidath,Dhamith)` in under a millisecond.
2. Anything else goes to **Gemma 3 via Ollama** (`lib/ai/parse-expense.ts`),
   which is constrained to a JSON schema and validated with Zod.
3. Code-level guards drop names that don't appear in the message, so the model
   can't invent participants.
4. Names are matched to group members (case-insensitive, small typos allowed)
   and shown in a **preview you confirm** before anything is saved.

## Contributing

Bug reports, ideas and pull requests are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md) to get set up, and look for issues labelled
[`good first issue`](https://github.com/bdhamithkumara/splitmate-ai/labels/good%20first%20issue).

## License

[MIT](LICENSE)
