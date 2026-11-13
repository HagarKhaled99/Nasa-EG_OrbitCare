# ORBIT TWIN – manual test scenarios

Use these to test the web app by hand (the automatic checks run with `npm test`).
Each scenario lists the steps and the **expected result**. If what you see is different, note the scenario ID.

## Before you start

1. Start the app: `npm run dev` → open **http://localhost:5173** in a **new tab**.
   (For scenario O1 – offline – use `npm run start` → http://localhost:4173.)
2. All PINs are **2026** (4 crew, 2 ground users, admin PIN).
3. Clean start: for every astronaut you tested before, sign in → **Demo** (bottom-right) → **Reset my demo data**.

Starting state of the demo crew (Mars transit, mission day 214):

| Astronaut | Twin at the start |
|---|---|
| Sara | heart + brain **Watch** (orange) |
| Ahmed | all **Normal** (green) |
| Lena | heart **Unknown** (grey, missing SpO₂) |
| Omar | all **Normal** (green) |

---

## A · Sign in and sessions

| ID | Steps | Expected result |
|---|---|---|
| A1 | Open the app in a new tab | “Who’s checking in?” sign-in page with the 4 crew. Space panel on the left (on a wide screen). |
| A2 | Type “eng” in the search box | Only **Ahmed Nasser · Flight Engineer** remains. Press Enter → his PIN screen. |
| A3 | Choose Sara → type **1111** | Dots shake; message “That PIN does not match. 4 tries left before a 60-second lock.” |
| A4 | Enter a wrong PIN 5 times | “Locked after 5 wrong tries. Try again in 60 s…” The PIN pad is disabled and counts down. |
| A5 | Choose Ahmed → **2026** | Opens the **Twin View** (never another page). Name and role in the top bar. |
| A6 | Press F5 (refresh) | Still signed in as the same person. |
| A7 | Open the app in a **new tab** | Goes to the sign-in page; the previous person is signed out (shared tablet). |
| A8 | Click **Sign out** (sidebar, or the door icon in the top bar on a phone) | Back to the sign-in page. Visiting http://localhost:5173/ again → sign-in page. |
| A9 | Sign in as Sara, then sign out, look at the list | Sara appears first under **Recent** with “signed in just now”. |

## B · Sign up (new astronaut)

| ID | Steps | Expected result |
|---|---|---|
| B1 | Sign up tab → leave everything empty → Continue | Errors: “Enter your full name.”, “Enter your date of birth.”, “Use exactly 4 digits.” |
| B2 | Name **Sara Haddad** | “A profile with this name already exists on this tablet.” |
| B3 | Birth year that makes the person 15 | Year list only offers ages 18–80 (impossible to pick 15). |
| B4 | PIN **1234** or **1111** | “Too easy to guess. Avoid repeated or sequential digits.” |
| B5 | PIN 4827, repeat 4828 | “The two PINs do not match.” |
| B6 | Choose mission **ISS** | Card shows Weightless · 0.5 s · 0.5 mSv/day and a “Why this mission” text. |
| B7 | Step 2 → Pair the watch | “Searching…” then “Paired (simulated)”. Continue works also without pairing. |
| B8 | Step 3 → Import 30-day average | Heart rate, SpO₂ and sleep filled; line “SYNTHETIC_DEMO · HR … ± … · n = 30”. |
| B9 | Heart rate **250** | “Must be between 35 and 120 bpm. Check the device and measure again.” |
| B10 | Heart rate **45** | Accepted, no warning (athlete). |
| B11 | Systolic **135** | Accepted with note “Outside the typical range (90–129 mmHg)… Confirm it with your CMO before launch.” |
| B12 | Systolic 100, diastolic 95 | “The top number should be at least 15 mmHg above the bottom one. Measure again with the cuff.” |
| B13 | Fill valid values → Create profile | Opens **their Twin View**. Note “Your twin is still learning your normal…”. Systems without readings show **Unknown**, not green. |
| B14 | `npm run db` in a 2nd terminal | The new astronaut is in the `astronauts` table; audit log shows “create”. PIN is not visible anywhere. |

## C · Twin View

| ID | Steps | Expected result |
|---|---|---|
| C1 | Sign in as **Sara** | Headline “2 systems are drifting from your normal.” Heart and brain orange; heart rate ≈ 73 bpm (▲ ≈ 18 %). |
| C2 | Sign in as **Ahmed** | “Everything is within your normal.” All points green. |
| C3 | Sign in as **Lena** | “1 system is missing data.” Heart point is grey/dashed (Unknown), never green. |
| C4 | Tap the heart point on the body | Opens the **Heart & circulation** organ page. |
| C5 | Watch the sidebar card | “Watch live” with a pulsing green dot. |
| C6 | Footer “Data from …” | Shows the sources and the **SYNTHETIC_DEMO** label. |

## D · Live watch and Daily Check-in

| ID | Steps | Expected result |
|---|---|---|
| D1 | Open **Daily Check-in** | “Live from your ORBIT watch · Streaming every 5 s”. Heart rate and SpO₂ update about every 5 s; **Read-only** label; no input box for them. |
| D2 | Wait ~1 minute | Sometimes “Wrist moving · reading not used (… )” in orange; the shown value does not jump. |
| D3 | Lena → Daily Check-in | SpO₂ card: **No signal** + **Unknown** + “Unknown, not normal…”. |
| D4 | Click **Pause stream** | “Paused”; values stop changing. Resume restarts. |
| D5 | Radiation card | “Radiation · personal dosimeter”, today’s dose and mission total (% of 600). No input. |
| D6 | Systolic **300** → Save | Red “Check the reading: must be 60–250 mmHg.” and “Fix the readings marked in red.” Nothing saved. |
| D7 | Systolic 118, diastolic 76, blood sugar 92, mood 4 → Save | “Check-in logged · Saved to the crew database.” Sidebar “Due” badge disappears. |
| D8 | Tick symptom **Headache** → Save → Twin View | Brain shows **Watch**. |
| D9 | As Ahmed: tick **Chest pain or pressure** | Red box “Tell the crew medical officer now…”. Save → full-screen red alert “Heart & circulation”, although his numbers are normal. |

## E · Organ pages

| ID | Steps | Expected result |
|---|---|---|
| E1 | Sara → Heart page | Tabs for 7 systems; four answers (What changed / Why it matters / How serious / What to do); 30-day chart with a sentence like “Your last 7 days average … higher than the 3 weeks before.” |
| E2 | Lena → Heart page | Banner “1 of 4 readings missing: Blood oxygen (SpO₂). Missing data shows as Unknown, never as Normal.” and button **Open Daily Check-in**. |
| E3 | Any organ → “Where this comes from” | Opens NASA/CSA links (they open in a new tab and load). |
| E4 | Any Act step | Says “(approved onboard protocol here)”; no medicine doses. |
| E5 | Open http://localhost:5173/organ/xyz | “Body system not found”. |

## F · Emergency, Action Center and report packet

| ID | Steps | Expected result |
|---|---|---|
| F1 | Omar → Demo → **Inject emergency (low SpO₂)** | Heart turns red; full-screen “Demo alert · Act now · Heart & circulation” with the reason, last valid values and “Do this now”. |
| F2 | In the alert: **Notify medical officer** | Button changes to “Medical officer notified”. |
| F3 | In the alert: **I have read this** | Alert closes and does not come back for this alert. |
| F4 | Action Center | Ranked alert card with steps; tick a step → refresh → still ticked. Acknowledged banner is one line. |
| F5 | **Medical Report Packet** → Download | A `.txt` file downloads with findings, last 7 days, symptoms, crew pulse. |
| F6 | **Queue for Earth** | “Queued in the crew database for the next comms window…”. |
| F7 | Sara → Demo → **Watch sends a worsening reading** | Heart and brain become red; full-screen alert (Brain or Heart first, “+1 more”). |
| F8 | Alert → **Not now** | Closes until a new alert appears; Action Center still shows it. |

## G · Mission environment and blackout

| ID | Steps | Expected result |
|---|---|---|
| G1 | Omar with an Act alert, top bar → **ISS** | Earth delay 0.5 s. Contact becomes “Flight surgeon (live)”. Status stays **Act**. |
| G2 | Back to **Mars transit** | Delay 18 min; contact “Crew medical officer + Earth (report packet)”. Status still **Act**. |
| G3 | Twin View on Mars, comms panel | “Blackout coming · Blackout in 6 days” (day 220–234). |
| G4 | **Demo: start the blackout now** | “No reliable contact with Earth · back in 14 days”; the help chain stays on board. |
| G5 | Switch to ISS and press the blackout demo | No blackout on the ISS (“Earth is in contact”). |

## H · Crew Pulse

| ID | Steps | Expected result |
|---|---|---|
| H1 | Sara → Crew Pulse | “Your crew said **2 / 3** noticed a change”. Question “Does Ahmed seem like their usual self today?”. |
| H2 | Answer **Not quite** | “Thank you. Your answer is private.”; Ahmed shows as **Answered** in participation. |
| H3 | Sign in as Ahmed → Crew Pulse | “Your crew said 1 / 3”. No name of who said it, anywhere. |

## I · Future Slider and Mission & Routine

| ID | Steps | Expected result |
|---|---|---|
| I1 | Future Slider | Label “Illustration, not a prediction”; assumptions list at the bottom. |
| I2 | Move the slider to day 900 | Bone/muscle/radiation values and status change; vertical line moves on the charts. |
| I3 | Tick **Follow countermeasure plan** | Values improve; the sentence about the action zone changes. |
| I4 | Mission & Routine (Lena) | Readiness breakdown shows heart “Unknown −6”. Reminders “Done/To do” follow real data. |

## J · Inbox and Ground portal

| ID | Steps | Expected result |
|---|---|---|
| J1 | Omar: queue a report packet (F6). 2nd window: http://localhost:5173/ground/login → **Dr. Yasmin Farouk** → 2026 | Ground crew overview. Omar: “+1 in transit”. Header badge “Medical access”. |
| J2 | Open Omar | Body systems (heart Act), symptoms, packet “crossing space · arrives in ~18 min” (not readable). |
| J3 | Header **Demo: skip light delay** → refresh | The packet becomes readable. |
| J4 | Send advice “Rest and re-measure in 10 min.” | Listed as “arrives in 18 min”. |
| J5 | Set **Limited**, restrictions “No EVA until cleared”, medical note “low SpO₂” → Save | “Saved…”; history shows the decision. |
| J6 | Omar’s window → **Inbox** | Message “on its way, arrives in …” (not readable). Fitness card “Limited duty · No EVA until cleared” + the surgeon’s note. Top bar chip under the name. |
| J7 | Omar: Demo → **Skip light delay** | The advice is readable, marked **New**; Inbox badge in the menu. **Mark as read** → badge disappears; surgeon sees “read …”. |
| J8 | Ground: sign out → **Karim Mansour** (Mission Director) | “Your role: Mission Director” explanation; readiness counts; no report counts. |
| J9 | Director → open Omar | “What this means for the mission” + “Free to take over” list. **No** vitals, symptoms, reports or note. |

## K · Privacy and security

| ID | Steps | Expected result |
|---|---|---|
| K1 | Signed in as Sara, open http://localhost:5173/api/readings?astronautId=omar | `{"error":"You can only open your own readings."}` |
| K2 | Signed in as the Mission Director, open http://localhost:5173/api/readings?astronautId=sara | `{"error":"You can only open your own readings."}` (403) |
| K3 | Signed in as the Flight Surgeon, open http://localhost:5173/api/crew-pulse?missionDay=214 | `{"error":"Crew members only."}` – Crew Pulse never leaves the station. |
| K4 | Signed out, open http://localhost:5173/api/inbox | `{"error":"Sign in first."}` |
| K5 | `npm run db` | No PINs or hashes are shown; audit log lists sign-ins, check-ins, notifications, fitness decisions. |

## L · Manage crew (admin)

| ID | Steps | Expected result |
|---|---|---|
| L1 | Sign-in page → **Manage crew database** | Lists signed-up astronauts and the 4 built-in crew (locked, cannot be removed). |
| L2 | Remove → PIN 1111 | “PIN not accepted. Use this astronaut’s own PIN or the admin PIN.” |
| L3 | Reset PIN → admin 2026, new 5830 twice | “… PIN was changed.” Sign in with 5830 works; the old PIN fails. |
| L4 | Remove → admin 2026 | The astronaut disappears from the list and the sign-in page. |

## M · Missing data never “normal”

| ID | Steps | Expected result |
|---|---|---|
| M1 | Lena: Twin View, Organ page, Action Center, Mission | Heart is **Unknown** in all of them; Action Center lists it under “Missing readings: status unknown”. |
| M2 | New astronaut from B13 | Systems without readings are Unknown; Crew Pulse “No Crew Pulse answers about you yet today.” |

## O · Offline (demo mode)

| ID | Steps | Expected result |
|---|---|---|
| O1 | `npm run start` → open http://localhost:4173, sign in, visit a few pages, then turn **Wi-Fi off** | Everything keeps working (it all runs on this laptop). Fonts may change to the system font. |
| O2 | Stop the server (Ctrl+C), reload http://localhost:4173/login | The page still opens (service worker). Signing in shows that the crew server is not reachable. |

## V · Validation (1,000 simulated astronauts)

| ID | Steps | Expected result |
|---|---|---|
| V1 | Sign-in page → **How we tested our alerts on 1,000 simulated astronauts** | `/validation` opens without a PIN. “Simulating 1,000 astronauts…” then results in about 1–3 s. |
| V2 | Read the result tiles (seed 2026) | Caught before serious **96%** (393 of 410), Missed **0**, Warning ahead **4 days**, Missing data shown Unknown **100%**, False Watch **1.9**, False Act **0.09**. |
| V3 | “What the validation changed” table | Old 1-day rule: 96% / 5.7 false Watch. 2-days-for-all: 85%. Ours (highlighted): 96% / 1.9. |
| V4 | **Run again with new astronauts** | New seed shown; numbers change slightly (about 93–96% early, 0 missed, ~1.9 false Watch). |
| V5 | Back to sign in → the sign-in list | Still only the real crew. No simulated astronaut appears; `npm run db` shows no new rows. |
| V6 | Ahmed: Check-in with heart rate **65** (normal 58) | The form marks this single reading Watch, but after saving the twin heart stays **Normal**, message “12% above your normal today. One day can be noise: Watch starts if it is still off tomorrow.” |
| V7 | Ahmed: Check-in with heart rate **75** | Heart **Act** at once (Act is never delayed). |
| V8 | Sign in as Sara and leave Twin View open for 5 minutes (no Demo buttons) | Heart stays **Watch** (orange, about 73–74 bpm). The red emergency screen must **not** appear by itself. |
| V9 | Sara → Daily Check-in, watch card | Shows “· averaging the first minute”, then “· twin uses the 1-min average of N good packets”. |

## Reset after testing

For each astronaut you changed: sign in → **Demo → Reset my demo data**. This removes their check-ins, injected readings, steps, notifications, reports, advice and fitness decisions. The 31-day demo data stays.
