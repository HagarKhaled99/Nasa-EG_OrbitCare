# ORBIT TWIN — web app

NASA Space Apps 2026 hackathon prototype. A tablet app that turns **simulated** wearable readings and manual
check-ins into a personal health twin for each astronaut. Runs fully on one laptop/tablet, no internet needed.
**Not a medical device. All data is SYNTHETIC_DEMO.**

```bash
npm install
npm run dev            # while coding: website http://localhost:5173 + crew server :4000 (one command)
npm run start          # for the judge demo: production build + offline service worker + crew server
npm test               # 67 checks: server (sign-in, privacy, data) + app logic (twin, Unknown, symptoms)
npm run build          # type-check + production build
npm run db             # print the database (astronauts, readings, audit log). Use a 2nd terminal
npm run data:generate  # rebuild the 31-day demo dataset (JSON + CSV + database)
npm run server         # crew server only        npm run dev:web   # website only (nobody can sign in)
```

Requires **Node 22.5+** (built-in `node:sqlite`; nothing extra to install).

**Demo sign-in:** any of the four sample crew, PIN **2026**. Admin PIN for removing profiles: **2026**.
(The member2 branch used separate PINs per person: 2468 / 1357 / 8642 / 9753. We kept the single demo PIN
shown on the sign-in screen. Change it with `ORBIT_DEMO_PIN` if the team prefers.)

Manual test scenarios with expected results: [`docs/TEST_SCENARIOS.md`](docs/TEST_SCENARIOS.md).

## Users and the two portals

ORBIT TWIN has two portals with the same crew server and database. Onboard decisions stay on board (the plan's
"your flight surgeon is 20 minutes away, your twin is right here"); Earth reviews, advises and decides fitness
for duty later, through the light-time delay.

| Portal | User | Role | Sees / does |
|---|---|---|---|
| **Astronaut portal** (`/login`) | Sara Haddad | Mission Specialist | own twin, check-in, actions, Crew Pulse, Inbox |
| | Ahmed Nasser | Flight Engineer | same |
| | Omar Rahimi | Commander | same |
| | Lena Fischer | **Crew Medical Officer** (onboard) | same + the crew's health data and medical-officer notifications, to act on board now |
| **Ground portal** (`/ground/login`) | Dr. Yasmin Farouk *(fictional)* | **Flight Surgeon** | full medical detail: body systems, symptoms, report packets; sends advice; decides fitness for duty (with a private medical note) |
| | Karim Mansour *(fictional)* | **Mission Director** ("management") | **fitness for duty and restrictions only** (ready / limited / not ready, e.g. "No EVA until cleared"). Never vitals, symptoms, reports or notes |

All demo PINs are **2026** (`ORBIT_DEMO_PIN`, `ORBIT_GROUND_PIN`). Privacy is enforced by the server, not only
hidden on screen: the director gets 403 on medical endpoints, ground staff cannot write astronaut data, and
**Crew Pulse never leaves the station**. Advice and report packets travel with the mission's one-way delay
(Mars ≈ 18 min, Moon 1.3 s, ISS 0.5 s): a message still crossing space shows when it will arrive but cannot be
read yet. The Demo controls can skip the delay. Simplification: fitness decisions show on board immediately.

## Judge demo script (2–3 min, plan §11)

Run `npm run start`, open the address it prints, and use the **Demo** button (bottom-right) when told.

1. **Sign in as Sara** (PIN 2026), Mars transit, mission day 214. Twin View: heart and brain are orange (Watch).
   Point out the live watch (sidebar dot) and "Colors compare today with your own pre-flight baseline".
2. **Demo → "Watch sends a worsening reading".** Heart rate jumps and sleep drops: heart and brain turn red
   without a refresh, and the full-screen emergency alert opens. Click **"I have read this"**.
3. **Open the heart** (tap it on the body): today vs normal, 30-day trend chart, the four plain-English answers,
   and where the science comes from.
4. **Sign out, sign in as Omar** (2026). Everything is green. **Demo → "Inject emergency (low SpO₂)"**: the
   full-screen alert names the reason and last valid values → **Open Action Center**: "Do this now", **Notify
   onboard medical officer**, **Medical Report Packet** (download or queue for Earth).
5. **Change the environment** in the top bar from Mars transit to ISS: the contact changes from the crew medical
   officer to a live call with the flight surgeon; the alert stays Act. Back on Mars, the Twin View warns of the
   solar-conjunction blackout in 6 days ("Demo: start the blackout now" shows Earth-independent mode).
6. **Future Slider:** move the day slider and toggle the exercise plan; point to "Illustration, not a prediction"
   and the assumptions list.
7. **Turn Wi-Fi off:** pages, the twin and the check-in keep working (everything runs on this laptop; the
   service worker keeps the app shell). Optional: show **Daily Check-in** with an urgent symptom (chest pain)
   turning a normal heart red.

8. **Ground portal (business view):** in a second browser window open `/ground/login`, sign in as the **Flight
   Surgeon** (2026): the crew overview shows Omar's report packet *in transit*. Click **"Demo: skip light delay"**,
   read the packet, send advice, set **Limited · No EVA until cleared**. Sign in as the **Mission Director**: only
   the readiness status is visible. Back on board, Omar's **Inbox** shows the advice and the top bar shows the
   fitness chip.

After a rehearsal, use **Demo → "Reset my demo data"** for each astronaut you changed.

## How the pieces link together

```
 /login, /signup  ──►  crew server (server/server.mjs)  ──►  SQLite  server/data/orbit-twin.db
   (Member 1)          checks PIN, sets signed httpOnly         astronauts · readings ·
                       session cookie (server/session.mjs)      pin_attempts · audit_log
        │                         │
        ▼                         ▼
 OrbitProvider (useOrbit)  ◄──  GET /api/auth/session, /api/astronauts, /api/readings
   session · crew · readings → health.ts (science engine) → twin.ts (Member 2 snapshot)
        │
        ▼
 Twin View  /  (Member 2)   ·   organ pages, check-in, actions, future, mission (Members 3–6)
```

- **Sign-in**: the server checks every PIN (sample crew too), locks after 5 wrong tries (60 s) and sets a
  signed, httpOnly session cookie (12 h). Page scripts cannot read or forge it.
- **Privacy** (Member 2's rule): you only ever see **your own** twin. No person switcher. The readings API
  returns 403 for anyone else's data, except for the crew medical officer. Opening `/login` signs the
  previous person out, so the tablet can be handed over safely.
- **Database → twin**: the signed-in astronaut's daily readings drive the twin's 30-day trends and today's
  values. A missing reading stays **Unknown**, never Normal.
- **Check-in → database**: `submitCheckIn(values)` updates the twin at once and saves a `MANUAL_CHECKIN` row.

## Who owns what

| Member | Routes | Status |
|---|---|---|
| 1 — Sign in / sign up (Hagar) | `/login`, `/signup`, `/manage-crew` | ✅ done |
| 2 — Twin View (Omar) | `/` | ✅ merged from `member2-twin-view` (incl. Earth-Independent Mode), linked to the database |
| 3 — Organ pages (Menna) | `/organ/:organId` (7 organs) | ✅ merged from `menna` |
| 4 — Check-in + data feed (Shahd) | `/check-in` | ✅ merged from `MEMBER4`, saves to the database |
| 5 — Action Center + Crew Pulse (Salma) | `/actions`, `/crew` | ✅ API merged from `member5-actions-crew`; pages added from the original project and linked to it |
| 6 — Future Slider + Mission (Marvey) | `/future`, `/mission` | ✅ merged from `member6-backend` (PR #2) |

Add your routes in `src/App.tsx` **inside** the `<RequireSession>` block, so they are only reachable when signed in.

## Shared state: `useOrbit()` (`src/components/orbit/orbit-provider.tsx`)

| Field | Meaning |
|---|---|
| `astronaut` | the signed-in person (always the session's owner) |
| `crew`, `profiles` | everyone who can sign in / astronauts stored in the database |
| `env`, `setEnvironmentId` | mission environment (ISS / Moon / Mars …) and Earth delay |
| `indicators`, `organs`, `alerts`, `readiness` | computed twin state (`src/lib/orbit/health.ts`) |
| `readings`, `readingsStatus` | the signed-in astronaut's database rows; `'database'` or `'built-in'` |
| `submitCheckIn(values)` | **Member 4**: e.g. `submitCheckIn({ heartRate: 70, systolic: 118 })` |
| `session`, `sessionStatus` | `{ astronautId, expiresAt }` · `'checking' / 'signed-in' / 'signed-out'` |
| `signIn(id, pin)`, `signOut()`, `createCrewProfile(input)`, `removeCrewMember(id, pin)` | auth (Member 1) |

Twin snapshot for any page (Member 2): `buildTwinSnapshot({ astronaut, env, indicators, organs, readiness,
checkedInToday })` from `src/lib/orbit/twin.ts` gives status per organ (`normal / watch / act / unknown`),
contact chain, environment effects, RIDGE hazards and data sources.

Organ IDs: `brain`, `eyes`, `heart`, `blood`, `muscles`, `bones`, `radiation`.
Measured indicators: `heartRate`, `spo2`, `systolic`, `diastolic`, `glucose`, `temperature`, `sleep`, `mood`,
`exercise`, `grip`, `vision`. Computed: `boneDensity`, `muscleMass`, `radiationDose`, `crewPulse`.

## Crew server API (`server/`)

| Endpoint | |
|---|---|
| `POST /api/auth/sign-in` | `{ astronautId, pin }` → 200 + cookie / 401 wrong PIN / 423 locked |
| `GET /api/auth/session` · `POST /api/auth/sign-out` | who is signed in · end the session |
| `GET /api/astronauts` · `POST /api/astronauts` | list · sign-up (validated; signs the new astronaut in) |
| `DELETE /api/astronauts/:id` | `{ pin }`: their own PIN or the admin PIN. Also deletes their readings |
| `GET/POST /api/action-steps` | ticked "do this now" steps and the alert acknowledgment (Member 5) |
| `GET/POST /api/medical-notifications` | notify the onboard medical officer; the CMO sees everyone's (Member 5) |
| `GET/POST /api/medical-reports` | Medical Report Packets queued for Earth; the CMO sees everyone's (Member 5) |
| `GET /api/ground/crew` · `GET/POST /api/ground/messages` · `GET/POST /api/ground/fitness` | Ground portal (surgeon: medical; director: readiness only) |
| `GET /api/inbox` · `POST /api/inbox/:id/read` · `POST /api/demo/fast-forward` | astronaut inbox; demo skip of the light delay |
| `GET/POST /api/crew-pulse` | daily private question. GET returns your answers, the **count** about you and who answered, never who flagged whom (Member 5) |
| `POST /api/astronauts/:id/reset-pin` | `{ adminPin, newPin }`: forgotten PIN (stored PINs cannot be read). Also lifts a lockout |
| `GET /api/readings?astronautId=` | your own readings (crew medical officer: anyone's). 401 / 403 otherwise |
| `POST /api/readings` | add a reading to **your own** twin (`MANUAL_CHECKIN` or `SIMULATED_WATCH`) |

Client: `src/lib/orbit/api/crew-api.ts` and `readings-api.ts`. Tables: `astronauts` (profile, baseline JSON,
scrypt PIN hash), `readings`, `pin_attempts`, `audit_log`. Open the `.db` with the VS Code "SQLite Viewer"
extension or run `npm run db`. Settings: `PORT`, `ORBIT_DB_PATH`, `ORBIT_DEMO_PIN`, `ORBIT_ADMIN_PIN`,
`ORBIT_SESSION_SECRET` (otherwise a random secret is stored in `server/data/`).

## Demo dataset (SYNTHETIC_DEMO)

**31 days × 4 sample crew = 124 records** (the plan's three demo cases: Sara's gradual change, Omar's low SpO₂, Lena's missing SpO₂; Ahmed healthy), mission days 184–214, plan §5 format, every record labelled
`SYNTHETIC_DEMO`. In the `readings` table (seeded automatically), and as `public/data/orbit_twin_demo.json`
/ `.csv`. Generator: `server/demo-data.mjs`.

**Recipe:** personal pre-flight baseline (same as `crew.ts`), plus an in-flight sleep offset of −0.2 h
(ISS actigraphy studies report shorter sleep in flight), plus day-to-day variation (HR SD 2.5 bpm, SpO₂ 0.7 %,
BP 5/3 mmHg, temperature 0.12 °C, sleep 0.3 h, exercise 6 min; truncated at ±2 SD), kept inside each person's
normal band (80 % of the app's watch threshold), plus radiation of 1.84 mSv/day ±10 % (Mars transit, Curiosity
RAD), plus the demo events below. Checked against the app's own alert rules: **0 unplanned alerts**.

| Astronaut | Demo event (day 214) | What the twin shows |
|---|---|---|
| Sara | HR 62 → 73 bpm, sleep → 6.2 h over 5 days | heart + brain **Watch** (trend) |
| Ahmed | healthy all month | all **Normal** |
| Lena (CMO) | healthy, but **SpO₂ missing** on day 214 (no signal) | heart **Unknown**, never Normal |
| Omar | starts **healthy**; the emergency (SpO₂ 87 %, good signal) is **injected live** with the Demo button | heart **Act** → full-screen alert / Action Center |

## Member 1: sign in and sign up

- `/login`: Sign in / Sign up tabs, recent astronauts first, crew search, PIN pad (touch + keyboard),
  server lockout with countdown, hand-over sign-out.
- `/signup`: 3 steps. (1) About you: name, role, date of birth (Day/Month/Year), mission with a "why this
  mission" card, body figure, PIN twice (weak PINs rejected). (2) Pair devices: watch and dosimeter
  (simulated), with an honest table of what each device measures. (3) Baseline: 30-night watch average
  (mean ± SD, synthetic) or manual entry, with input sanity limits and "confirm with your CMO" notes.
- `/manage-crew`: list and remove database astronauts (their PIN or the admin PIN).

## Member 2: Twin View (merged from `member2-twin-view`)

Omar's branch was written for Next.js (`app/api/*`, `next/link`, cookie sessions in route handlers). It was
merged into this Vite app as follows:

| From Omar's branch | In this app |
|---|---|
| `components/orbit/twin-view.tsx` | `src/components/orbit/twin-view.tsx` (react-router links, `<img>`, shared session) |
| `lib/orbit/twin.ts` | `src/lib/orbit/twin.ts` (+ SpO₂, glucose meter source) |
| top bar without person dropdown | `src/components/orbit/top-bar.tsx` |
| signed httpOnly session cookie, 5-try lockout, "only your own twin", hand-over sign-out | rebuilt in `server/session.mjs` + `server/server.mjs` on the shared SQLite database |
| `accounts-store.ts` (JSON file in `~/.orbit-twin`), `session-gate.tsx`, `auth-client.ts`, Next route handlers | replaced by the crew database, `RequireSession` and `crew-api.ts` (one sign-in system, not two) |
| `GET /api/twin`, `GET /api/environments` | the same data comes from `buildTwinSnapshot()` / `allEnvironmentEffects()` in `twin.ts`, computed in the app |

## Member 4: Daily Check-in (merged from `MEMBER4`)

Shahd's branch was a full copy of the original Next.js project (plus an unrelated `ent-flow` clinic app, not
merged). Her actual changes were `check-in-form.tsx` and `sensors.ts`; her design is kept: sensor readings
arrive automatically and are read-only, only readings the astronaut takes are typed in.

| Field | Source | In the form |
|---|---|---|
| Heart rate, SpO₂ | watch, **live every 5 s** (`src/lib/orbit/sensor-adapter.ts`) | read-only; packet time + signal quality; "wrist moving" packets are shown but not used; no good packet for 30 s → **Stale**; missing → **Unknown / no signal** |
| Sleep, exercise | watch (daily summary) | read-only, today's value from the database |
| Radiation | personal dosimeter (separate sensor) | read-only: today's dose + mission total (% of the 600 mSv limit) |
| Symptoms | you | checklist (`src/lib/orbit/symptoms.ts`); **urgent** ones (chest pain, breathless at rest, fainting, confusion, sudden vision loss) raise **Act** on that body system even when the numbers look normal (plan §7, demo criteria); others raise Watch. Stored in `readings.symptoms` |
| Blood pressure · temperature · blood sugar | cuff · thermometer · meter | typed in (the watch does not measure these, plan §3) |
| Grip, near vision, mood | you | typed / tapped |

Saving stores a `MANUAL_CHECKIN` row (manual values, mood, symptoms) and a `SIMULATED_WATCH` row with the live values seen at that moment.

Changes while porting: watch fields never show the person's normal value when no reading exists (plan §12),
BP/temperature/glucose are not labelled as watch readings, input sanity checks (e.g. systolic 60–250, top number
above bottom), the How & Why card uses the browser's `<dialog>`, and saving reports honestly whether it reached
the crew database or stayed on the tablet. Blood sugar, grip and vision are stored too (`glucose_mg_dl`,
`grip_kg`, `vision_lines`).

## Member 2 update: Earth-Independent Mode

On Mars missions the twin knows about **solar conjunction** (Sun between Earth and Mars, ~2 weeks without
reliable contact, as in NASA's Nov 11–25 2023 pause). Demo scenario: blackout from mission day 220 for 14 days,
so day 214 shows a 6-day warning; the Twin View has a demo button to start it now. During the blackout the
contact chain stays on board and reports are queued. Seriousness never changes.

## Member 3: Organ pages (merged from `menna`)

Menna's branch was a Next.js copy of the project; her own work is ported into `src/`: organ panel with
**today vs your normal**, 30-day **trend chart** with a plain-English trend sentence, the **four answers**
(what changed, why it matters, how serious, what to do), the rule behind each status, and NASA/CSA sources
(`src/lib/orbit/sources.ts`, all 16 NASA links checked). Missing data shows **Unknown**. Linked: the page
also reflects symptoms reported at check-in, and data sources name the real device (watch, cuff, thermometer,
meter, dosimeter). Her shared edits were adopted for the whole app: official NASA hazard names and
"approved onboard protocol here" placeholders instead of invented treatments or doses (plan §7).

## Member 5: Action Center + Crew Pulse (merged from `member5-actions-crew`)

Salma built the API (4 tables + endpoints). It was rebuilt on the signed-in session: identities in the request
body are ignored, so nobody can tick steps, notify or vote as someone else, and Crew Pulse only returns counts.
Her branch had no pages, so the Action Center and Crew Pulse pages from the original project were added and
linked to her API: alerts by urgency with saved steps, an **emergency banner** for Act (reason, last valid
values, "Do this now", notify the onboard medical officer, report packet, "I have read this" acknowledgment,
plan §7), and the report packet can be downloaded or queued for Earth. The Crew Pulse question is worded
gender-neutrally ("their usual self").

## Member 6: Future Slider + Mission & Routine (merged from PR #2)

Marvey's pages, with fixes: characters saved in Windows-1252 repaired; the Future Slider is labelled
**"Illustration, not a prediction"** and lists its assumptions (1.25 %/month bone loss, 1.5 % muscle, loss ×
(1 − g), plan prevents 75 %/80 %, 12 % shielding), as required by plan §6 and §12; the Mission page's exercise
and mood reminders now use real data. The Future Slider uses `recharts` (run `npm install`).

## Finishing pass: gaps closed

| Gap | Now |
|---|---|
| Missing data could look normal (new sign-ups got invented history; Action Center / Mission used the old status) | New astronauts never get invented data: systems without readings are **Unknown** until the first check-in; Action Center lists them under "Missing readings"; readiness counts Unknown (−6 each) |
| Emergency banner only inside the Action Center | **Full-screen emergency alert** on every page for unacknowledged Act alerts (reason, last valid values, Do this now, notify medical officer, acknowledge) |
| Judge demo steps 2 and 4 could not be shown live | **Demo** panel: worsening watch reading, inject emergency, reset; Omar starts healthy |
| Offline | Service worker in production (`npm run start`): app shell, images and demo dataset cached; API data never cached |
| Blood sugar, grip, vision only on the tablet | Stored in the database |
| Fixed streak; Crew Pulse teammate always Sara | Streak counted from real check-ins for signed-up astronauts; Crew Pulse teammate chosen per person |
| No sign-out on phones | Sign-out button in the top bar on small screens |
| Tests only on one laptop | `npm test` (105 checks) |

## Validation: do the alerts come at the right time? (`/validation`)
Open **http://localhost:5173/validation** (no sign-in; link on the sign-in page). Code: `src/lib/orbit/validation.ts`.

1,000 simulated astronauts are created **in memory only** (never in the database or the sign-in list), each with
their own normal and day-to-day noise (5 % of days have no watch signal). About 40 % get a hidden problem that slowly
worsens (heart rate, SpO₂, sleep, fever, blood pressure). The **real** `computeIndicators` runs on every simulated day.
"Serious" uses clinical cut-offs (SpO₂ ≤ 92 %, ≥ 38.0 °C, ≥ 140 mmHg, ≤ 5 h sleep, HR ≥ 25 % above own normal),
not our own thresholds. Seeded, so it is repeatable.

| Rule | Caught before serious | Missed | False Watch / healthy astronaut / month |
|---|---|---|---|
| Watch after 1 day off (old rule) | 96 % | 0 | 5.7 |
| Watch after 2 days off, all vitals | 85 % | 0 | 0.5 |
| **Ours: 2 days for heart rate + sleep, 1 day for the rest** | **96 %** | **0** | **1.9** |

Result: heart rate and sleep now need **2 days in a row** before Watch (`confirmDays` in `indicators.ts`); one odd
day shows "One day can be noise: Watch starts if it is still off tomorrow." **Act is never delayed.** False red
alerts: ~0.1 per healthy astronaut per month. Median warning: 4 days before serious. `npm test` checks these numbers.
Limits: simulated people, not clinical proof; blood pressure still gives ~1.5 false Watch days/month (next step:
average two cuff readings). Not AI: fixed, explainable rules; the test only measures them.

## Scientific notes / honest limits
- The twin compares readings with the person's **own** baseline. Reference ranges (AHA/ACC 2017 BP, AHA resting
  HR, ADA fasting glucose, AASM sleep ≥ 7 h, pulse-oximetry 95–100 %) only check what is typed at sign-up.
- SpO₂ thresholds are **DEMO criteria** (watch ≈ 3 % below baseline, act ≈ 5 % below or under 90 %) and need
  medical validation. Watch SpO₂ is a proposed device design.
- Bone/muscle values are illustrative model estimates, not scans. Distance changes who you contact, never
  how serious a reading is.
- A 4-digit PIN identifies crew on a shared tablet. It is not internet-grade security.

## References
Project plan §13: NASA HRP hazards, risks and ongoing research; CSA radiation monitoring (26 Feb 2026); CSA
science in space; NASA Standard Measures; NASA OSDR. Mars solar conjunction (Earth-Independent Mode, Member 2):
NASA "What is Mars solar conjunction?" and NASA JPL "Mars fleet lies low" (Nov 11–25, 2023).
