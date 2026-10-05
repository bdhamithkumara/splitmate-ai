## What does this change?

<!-- A short summary. Link the issue it closes, e.g. "Closes #12". -->

## How did you test it?

<!-- Steps you followed. For UI changes, add before/after screenshots. -->

## Checklist

- [ ] `npm run lint`, `npm run typecheck` and `npm run build` pass
- [ ] Parser changes: `npm run parser:test` output is included below
- [ ] Database changes are in a **new** file in `supabase/migrations/`, with RLS policies for any new table
- [ ] No secrets, `.env.local`, or real chat data committed
- [ ] Works on a phone-sized screen and in dark mode (UI changes)
