# ORBIT TWIN — web app

NASA Space Apps 2026 hackathon prototype. Offline-capable tablet app that turns **simulated** wearable
readings and manual check-ins into a personal health twin for each astronaut.
**Not a medical device. All data is SYNTHETIC_DEMO.**

```bash
npm install
npm run dev      # website http://localhost:5173 + crew database API http://localhost:4000 (one command)
npm run dev:web  # website only (sample crew still work; new sign-ups need the database)
npm run server   # database API only
npm run build    # type-check + production build
npm run db       # print the database (astronauts, readings, audit log) as tables. Use a 2nd terminal
npm run data:generate  # rebuild the 31-day demo dataset (JSON + CSV + database)
```

Requires **Node 22.5+** (uses the built-in `node:sqlite`; nothing extra to install).

Demo sign-in: pick any of the four sample crew, PIN **2026**.

## Stack

Vite + React 19 + TypeScript + Tailwind v4 + react-router 7, plus a small Node API with a SQLite
database (`server/`). Everything runs on the same laptop or tablet, so the demo works with no internet.

### Crew database (`server/`)

| | |
|---|---|
| File | `server/data/orbit-twin.db` (created automatically, git-ignored: every teammate has their own) |
| Tables | `astronauts` (profile + baseline JSON + scrypt PIN hash), `readings` (daily vitals), `sign_in_attempts` (lockout), `audit_log` (create / delete / sign-in events) |
| `GET /api/astronauts` | list (never returns PIN hashes) |
| `POST /api/astronauts` | sign-up, validated on the server (ranges, age, weak PINs, duplicate names → 409) |
| `POST /api/auth/sign-in` | `{ astronautId, pin }` → 200 ok / 401 wrong PIN / 423 locked (5 tries → 60 s) |
| `GET /api/readings?astronautId=sara` | daily vitals, oldest first |
| `POST /api/readings` | save one reading (`data_origin`: `MANUAL_CHECKIN` or `SIMULATED_WATCH`), validated |
| `DELETE /api/astronauts/:id` | `{ pin }`: the astronaut's own PIN or the admin PIN (`ORBIT_ADMIN_PIN`, default `2026`) |

Remove astronauts in the app at **/manage-crew** (link on the sign-in page). The 4 sample crew are built
into the code (`src/lib/orbit/crew.ts`). They are not in the database, so they always work for the demo.
To look inside the database, open the `.db` file with *DB Browser for SQLite* or the VS Code "SQLite Viewer" extension.

## Who owns what

| Member | Routes | Status |
|---|---|---|
| 1 — Sign in / sign up | `/login`, `/signup` | ✅ done (see below) |
| 2 — Twin View | `/` | base version in place |
| 3 — Organ pages | `/organ/:organId` (7 organs) | TODO, currently shows *ComingSoon* |
| 4 — Check-in + data feed | `/check-in` | TODO |
| 5 — Action Center + Crew Pulse | `/actions`, `/crew` | TODO |
| 6 — Future Slider + Mission | `/future`, `/mission` | TODO |

Add your routes in `src/App.tsx` **inside** the `<RequireSession>` block, so they are only reachable when signed in.

## Shared state: `useOrbit()` (`src/components/orbit/orbit-provider.tsx`)

| Field | Meaning |
|---|---|
| `astronaut`, `crew` | signed-in person and the whole crew (sample crew + profiles created at sign-up) |
| `env`, `setEnvironmentId` | mission environment (ISS / Moon / Mars …) and Earth delay |
| `indicators`, `organs`, `alerts`, `readiness` | computed twin state (`src/lib/orbit/health.ts`) |
| `submitCheckIn(values)` | **Member 4**: push new readings; Twin View updates without a refresh |
| `session` | `{ astronautId, signedInAt, expiresAt }` or `null` |
| `signIn(id, pin)`, `signOut()`, `createCrewProfile(input)` | auth (Member 1) |

Organ IDs (must match everywhere): `brain`, `eyes`, `heart`, `blood`, `muscles`, `bones`, `radiation`.

Measured indicator IDs: `heartRate`, `spo2`, `systolic`, `diastolic`, `glucose`, `temperature`, `sleep`,
`mood`, `exercise`, `grip`, `vision`. Computed: `boneDensity`, `muscleMass`, `radiationDose`, `crewPulse`.

## Demo dataset (SYNTHETIC_DEMO): for Members 3, 4, 5

**31 days × 4 sample crew = 124 records**, mission days 184–214, in the plan §5 record format. It is
**generated, not real astronaut data**, and every record is labelled `SYNTHETIC_DEMO`.

- In the database: the `readings` table, filled automatically the first time the server starts.
- As files: `public/data/orbit_twin_demo.json` (with a `metadata` block) and `.csv` (opens in Excel).
  The app can load the JSON offline at `/data/orbit_twin_demo.json`.
- Client: `src/lib/orbit/api/readings-api.ts` → `fetchReadings(id)`, `saveReading(reading)`, `fetchDemoDatasetFile()`.
- Generator: `server/demo-data.mjs`.

**Recipe:** personal pre-flight baseline (same as `crew.ts`), plus an in-flight sleep offset of −0.2 h
(ISS actigraphy studies report shorter sleep in flight), plus day-to-day variation (HR SD 2.5 bpm, SpO₂ 0.7 %,
BP 5/3 mmHg, temperature 0.12 °C, sleep 0.3 h, exercise 6 min; truncated at ±2 SD), kept inside each person's
normal band (80 % of the app's watch threshold), plus radiation of 1.84 mSv/day ±10 % (Mars transit, Curiosity
RAD), plus the demo events below. Checked against the app's own alert rules: **0 unplanned alerts**; only these
events raise Watch/Act:

| Astronaut | Demo event | What it tests |
|---|---|---|
| Sara | HR 62 → 73 bpm and sleep → 6.2 h over the last 5 days | trend / "watch" status |
| Ahmed | exercise down ~15 % over 6 days | countermeasure guidance |
| Lena | 37.9 °C (Act), HR +12 %, mood 3, **SpO₂ missing** on day 214 | missing data must show **UNKNOWN** |
| Omar | **SpO₂ 88 %** (good signal) on day 214 | emergency / Action Center |

> Integration note: the Twin View currently still uses its built-in history in `health.ts`. Member 4 can
> switch it to `fetchReadings()` in one adapter without changing the pages.

## Member 1 delivery: sign in and sign up

**Front end**
- `/login`: crew search (name or role; Enter opens the only match), crew list with watch status, 4-digit
  PIN pad (works with touch and keyboard), lockout countdown, demo-data notice.
- `/signup`: 3 steps.
  1. **About you**: name (duplicates rejected), role, date of birth (Day / Month / Year pickers, age 18–80),
     mission (ISS / Moon / Mars, with gravity, delay, radiation and a "why this mission" note; sets the
     twin's environment), body figure, PIN + confirmation (rejects `1111`, `1234`, …).
  2. **Pair devices**: simulated pairing of the watch and the personal dosimeter. A table states honestly
     what each device measures. Blood pressure comes from a cuff, temperature from a thermometer, and
     radiation from the dosimeter. The watch measures none of these. Watch SpO₂ is a proposed device design.
     You can continue without a watch.
  3. **Your baseline**: import a 30-night pre-flight watch average (mean ± SD, n = 30, synthetic) or
     type values in. Required: resting HR, SpO₂, sleep, BP systolic/diastolic, temperature. Optional: fasting
     glucose, grip, near vision. Every value records its source (`watch-preflight` / `manual` / `default` / `plan`).
- Space-themed auth layout (`auth-split.tsx`), route guard, working sign-out.

**Back end**: crew database API in `server/` (see above), plus the client-side pieces below
- `src/lib/orbit/auth/auth-service.ts`: salted, iterated SHA-256 PIN hashes (never stored in plain text),
  constant-time compare, 5 tries → 60 s lockout, 12 h sessions. Synchronous and storage-backed so it
  can later be swapped for a real API with the same function names.
- `src/lib/orbit/auth/sha256.ts`: pure-JS SHA-256. Works over plain `http://<LAN-IP>`, where `crypto.subtle`
  is unavailable. Verified against Node's crypto.
- `src/lib/orbit/api/crew-api.ts`: typed client for the database API.
- `src/lib/orbit/profiles.ts`: shared profile types, missions, mission → environment mapping.
- `auth-service.ts` / `sha256.ts`: used for the built-in sample crew (checked locally) and for sessions.
- `src/lib/orbit/baseline.ts`: baseline fields with input sanity limits (hard) and typical adult ranges
  (soft "confirm with your CMO" note only), a pulse-pressure cross-check, and the simulated watch import.

**Scientific notes / honest limits**
- The twin compares readings with the person's **own** baseline. The reference ranges (AHA/ACC 2017 BP,
  AHA resting HR, ADA fasting glucose, AASM sleep ≥ 7 h, pulse-oximetry 95–100 %) are only used to check
  what is typed in, never to diagnose. A fit astronaut with a resting HR of 45 bpm is accepted without a warning.
- SpO₂ was added as a shared indicator (heart organ). Its thresholds are **DEMO criteria**: watch below about
  3 % under baseline, act below about 5 % or under 90 %. They need medical validation.
- A 4-digit PIN identifies crew on a shared tablet. It is not internet-grade security.

## Data sources / references
See the project plan §13: NASA HRP hazards, risks and research pages, the CSA radiation-monitoring article,
NASA Standard Measures, and NASA OSDR.
