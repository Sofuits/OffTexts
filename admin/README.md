# Offtexts Admin

The staff portal. A plain React app served as static files — no server, no
service-role key, no backend of its own.

```bash
cd admin
npm install
cp .env.example .env        # add the anon key from the Supabase dashboard
npm run dev                 # http://localhost:5173
```

---

## How it shares code with the phone app

`vite.config.ts` points `@` at the app's `src/`, so this imports the entities,
the repository interfaces and the Supabase repositories **verbatim** — the same
files the phone runs, not a copy.

That works because `domain/` and `data/` have no React Native dependency, which
`src/__tests__/architecture.test.ts` asserts rather than assumes. If someone
adds `import { env }` to a repository, that test fails long before this build
does, and with a far more useful message.

What is **not** shared is the UI. An admin table and a profile card have nothing
in common, and building one out of the other's components serves neither. The
design tokens do cross over — `src/lib/theme.ts` turns the app's palette,
spacing scale and type sizes into CSS custom properties, so the two products
stay visually related without sharing a single component.

| Layer                  | Shared?                                              |
| ---------------------- | ---------------------------------------------------- |
| `domain/`              | Yes — identical files                                |
| `data/`                | Yes — identical files                                |
| `shared/theme` tokens  | Yes — colours, spacing, radii, type sizes            |
| `shared/theme/shadows` | **No** — Android elevation has no CSS equivalent     |
| `infrastructure/`      | No — browser versions live in `src/lib/container.ts` |
| `presentation/`        | No — this app has its own                            |

---

## Who can get in

Two separate questions, and only one of them is this app's to answer.

**Are you signed in?** Email and password, through the same `SignIn` use case
the phone app uses.

**Are you staff?** The app asks the database — `public.is_staff()` from
migration 0003 — rather than reading a role out of the session. Anything the
browser holds can be edited by whoever holds it.

And the answer here only decides what the screen says. **The RLS policies are
the actual control.** Force `isStaff` to true in devtools and every query still
returns nothing, because the policies test staff membership on the server for
every single row. This app cannot grant itself access; delete all of it and the
database is exactly as safe.

### Adding a colleague

There is no screen for this, deliberately — a portal that can grant portal
access is one compromised account away from being wide open. In the Supabase
SQL editor:

```sql
insert into public.staff (id, role, note)
select id, 'admin', 'Prashant — engineering'
from auth.users where email = 'prashant@example.com';
```

They need a Supabase Auth user first (Authentication → Users → Add user).

---

## The sections

| Section      | State                                                  |
| ------------ | ------------------------------------------------------ |
| Overview     | Live counts                                            |
| Members      | Live. Verify / unverify is "add to the discovery feed" |
| Reservations | Live, from `meets`                                     |
| Reviews      | Live                                                   |
| Cafés        | **No table yet.** The page says what it needs          |
| Safety cases | **No table yet.** The page says what it needs          |

The two unbuilt sections show what has to exist and which product decisions are
outstanding, rather than a table of invented rows. A mock that looks finished is
worse than an honest gap — someone eventually relies on it.

### Verification is the discovery feed

There is no separate "featured" flag. `profiles: read own or verified` already
hides unverified members from everyone else, so moving somebody into the feed
**is** setting `verification` to `verified`. A second column would be a second
source of truth for one question, and the two would eventually disagree.

---

## Deploying

Static output, so it goes anywhere. Cloudflare Pages, next to the marketing
site:

```bash
npm run build      # → admin/dist
```

Build command `npm run build`, output directory `dist`, and set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Pages environment
variables.

**Put it on its own subdomain and leave it out of search.** `index.html` already
carries `noindex, nofollow`. The anon key in the bundle is public by design and
grants nothing without a staff session — but a staff portal that turns up in a
search result invites people to try.

---

## Not done yet

- **No linting.** `eslint.config.js` at the root ignores `admin/` because that
  config targets React Native. This app needs its own flat config.
- **No tests.** The interesting logic lives in `data/`, which is covered by the
  app's suite, but the staff gate and the verify action deserve their own.
- **No pagination in the UI.** `listMembers` returns a cursor and the table
  ignores it. Fine at fifty members, not at five hundred.
