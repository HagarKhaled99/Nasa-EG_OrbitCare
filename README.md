# ORBIT TWIN: Twin View + private accounts (Member 2)

Every astronaut has their own account and PIN, and nobody can open someone
else's twin. Environments change the numbers on the page, and the body matches
each person (female or male).

## Copy these 17 files (plus the optional test link) into the project (same paths)

New:
- lib/orbit/accounts.ts
- lib/orbit/server/accounts-store.ts
- lib/orbit/server/session.ts
- app/api/auth/login/route.ts
- app/api/auth/logout/route.ts
- app/api/auth/session/route.ts
- app/api/auth/signup/route.ts
- app/api/auth/crew/route.ts
- app/api/environments/route.ts
- components/orbit/session-gate.tsx
- lib/orbit/auth-client.ts (functions for Member 1's pages)

Updated (Member 2):
- components/orbit/twin-view.tsx
- lib/orbit/twin.ts
- app/api/twin/route.ts

Small changes to shared files:
- lib/orbit/crew.ts (registerAstronaut for new sign-ups)
- components/orbit/app-shell.tsx (wraps pages in the session gate)
- components/orbit/top-bar.tsx (no person dropdown; shows only your name)

The sign-in and sign-up pages stay Member 1's files and are not included.

## What Member 1 adds (one call each)

In `components/orbit/sign-in.tsx`, when the 4th PIN digit is entered:

```ts
import { signIn } from '@/lib/orbit/auth-client'

const result = await signIn(selected.id, next)
if (result.ok) router.push('/')
else setError(result.error) // "Wrong PIN. 4 tries left." or "locked"
```

In `components/orbit/sign-up.tsx`, on "Finish":

```ts
import { signUp } from '@/lib/orbit/auth-client'

const result = await signUp({ name: form.name, role: form.role, figure, mission: form.mission, pin: form.pin })
if (result.ok) router.push('/')
else setError(result.error)
```

Optional: `fetchCrew()` lists everyone who can sign in, including new sign-ups.
Until Member 1 adds `signIn`, typing a PIN cannot open any twin (that is the protection working).

## Temporary test link (optional)

`app/api/auth/dev-login/route.ts` lets you open a twin before Member 1 connects
sign-in, for example `/api/auth/dev-login?astronaut=sara&pin=2468`. It only
works in development (`pnpm dev`) and is off in production. Delete it once
Member 1's sign-in calls `signIn()`.

## Run

```
pnpm install
pnpm dev
```

Open http://localhost:3000. You go to sign in first.

## Demo PINs

| Astronaut | PIN |
|---|---|
| Sara Haddad | 2468 |
| Ahmed Nasser | 1357 |
| Lena Fischer (crew medical officer) | 8642 |
| Omar Rahimi | 9753 |

5 wrong PINs lock that account for 5 minutes.

## Where accounts are saved

`~/.orbit-twin/accounts.json` (your user folder), outside the project on purpose:
writing files inside the project, especially in OneDrive, makes the Next.js dev
server reload in a loop. Set `ORBIT_DATA_DIR` to choose another folder and
`ORBIT_SESSION_SECRET` for a fixed session key. PINs are stored only as scrypt
hashes, never as plain text.

## Backend

- `POST /api/auth/login` `{ astronautId, pin }`: 200, 401 wrong PIN, 423 locked
- `POST /api/auth/logout`, `GET /api/auth/session`, `GET /api/auth/crew`
- `POST /api/auth/signup` `{ name, role, figure, mission, pin }`
- `GET /api/twin`: your own twin (`?env=iss` to try another environment)
- `GET /api/twin?astronaut=other`: 403, you can only open your own twin
- `GET /api/twin?crew=1`: crew overview, crew medical officer only
- `GET /api/environments`: what every environment does to you

All values are synthetic demo data (`SYNTHETIC_DEMO`). Not a medical tool.
