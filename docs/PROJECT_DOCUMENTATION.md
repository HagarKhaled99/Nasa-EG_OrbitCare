# ORBIT TWIN — Project Documentation

NASA Space Apps Challenge 2026

## Team

| Member | Part of the app |
| --- | --- |
| Hagar Khaled Khalaf | Sign in and sign up, crew server and database, integration |
| Sara Khaled Khalaf | Twin View and Earth-Independent Mode |
| MennatAllah Ahmed Hussien | Organ pages |
| Shahd Raafat Ali | Daily Check-in and sensor feed |
| Salma Mohamed Abuhagar | Action Center and Crew Pulse |
| Marvey Adel Ramzy | Future Slider and Mission routine |

## Project description

ORBIT TWIN is a tablet web app that gives each astronaut a personal health "digital twin": a body map that turns wearable readings and daily check-ins into clear Normal, Watch, Act or Unknown statuses. It runs fully on board, with no internet, so the crew can act on a health problem now instead of waiting for Earth.

It is a NASA Space Apps Challenge 2026 prototype. It is not a medical device, and all data in it is synthetic demo data.

### How it works

1. **Readings come in.** A simulated smartwatch sends heart rate and SpO₂ every 5 seconds; sleep, exercise and a personal radiation dosimeter add daily values. The astronaut types the rest at a daily check-in: blood pressure, temperature, blood sugar, grip, near vision, mood and symptoms.
2. **The twin compares each value with the astronaut's own pre-flight baseline,** not a population average. Seven body systems (brain, eyes, heart, blood, muscles, bones, radiation) each get a status. A missing reading always shows Unknown, never Normal.
3. **The app explains and guides.** Tapping an organ shows today vs. normal, a 30-day trend, and four plain-English answers: what changed, why it matters, how serious it is, what to do. An Act status opens a full-screen alert with "do this now" steps and a button to notify the onboard Crew Medical Officer.
4. **Earth reviews later, through the light delay.** Medical report packets are queued for the flight surgeon on Earth and arrive after the one-way delay (Mars about 18 minutes, Moon 1.3 s, ISS 0.5 s). Advice and a fitness-for-duty decision travel back the same way.

### Two portals, one crew server

| Portal | Users | What they see and do |
| --- | --- | --- |
| Astronaut portal | Mission Specialist, Flight Engineer, Commander | Own twin only, daily check-in, Action Center, Crew Pulse, Inbox, Future Slider, Mission routine |
| Astronaut portal | Crew Medical Officer (on board) | Same, plus the whole crew's health data and medical notifications |
| Ground portal | Flight Surgeon (Earth) | Full medical detail and report packets; sends advice; decides fitness for duty |
| Ground portal | Mission Director (Earth) | Fitness for duty and restrictions only (e.g. "No EVA until cleared"); never vitals or symptoms |

Privacy is enforced by the server, not just hidden on screen: an astronaut cannot open another person's data, the Mission Director is refused medical endpoints, and Crew Pulse answers never leave the station.

### Main features

- **Twin View:** the body map with live statuses and the mission environment (ISS, Moon, Mars transit).
- **Organ pages:** today vs. normal, trend chart, the four answers and the NASA science behind each rule.
- **Daily Check-in:** read-only sensor values plus typed values; urgent symptoms such as chest pain raise Act even when the numbers look normal.
- **Action Center:** alerts by urgency, saved "do this now" steps, the medical report packet.
- **Inbox:** advice from Earth, and every packet sent to Earth with its status (On its way, Delivered, Answered) and times.
- **Crew Pulse:** a private daily question about crewmates' wellbeing; only counts are shown.
- **Earth-Independent Mode:** warns before a Mars solar-conjunction blackout (about 2 weeks without contact) and keeps every decision on board during it.
- **Future Slider:** an illustration (not a prediction) of bone, muscle and radiation trends with and without the exercise plan.
- **Validation page:** 1,000 simulated astronauts test whether alerts arrive in time.

## The problem and our solution

On deep-space missions the doctor is no longer one call away: a message to Mars takes up to about 20 minutes each way, and contact can stop entirely for two weeks. The crew needs to notice and act on health changes by themselves, on board.

### The problem

- **Light-time delay.** On the ISS a flight surgeon can talk to the crew live. On a Mars transit, one question and one answer can take 40 minutes or more.
- **Communication blackouts.** During Mars solar conjunction the Sun blocks the radio link; NASA paused commands to its Mars fleet from 11 to 25 November 2023.
- **Spaceflight changes the body.** NASA's Human Research Program lists hazards such as radiation, bone and muscle loss, vision changes, sleep loss and isolation. Problems often start slowly, so a single day's number hides the trend.
- **Raw numbers are hard to read.** Astronauts are not all doctors. A heart rate of 73 bpm means little unless you know that person's normal is 62.
- **Missing data looks safe.** A sensor with no signal can quietly look "fine" in many dashboards.

### Our solution

ORBIT TWIN keeps the first decision on board and sends the full picture to Earth later. As we put it in our plan: *"Your flight surgeon is 20 minutes away; your twin is right here."*

| Problem | How ORBIT TWIN answers it |
| --- | --- |
| Light-time delay | Runs fully on the spacecraft's own network; alerts, guidance and the Crew Medical Officer are available at once. Earth messages show when they will arrive. |
| Blackouts | Earth-Independent Mode warns 6 days ahead and keeps report packets queued until contact returns. |
| Slow health changes | Each value is compared with the astronaut's own baseline and its 30-day trend; heart rate and sleep must be off 2 days in a row before Watch, so one noisy day is not an alarm. |
| Hard-to-read numbers | Colours on a body map and four plain-English answers per organ. |
| Missing data | No reading means Unknown, never Normal. |
| Emergencies | Act is never delayed: a full-screen alert with the reason, the last valid values and "do this now" steps. |
| Medical privacy | The server enforces who sees what; management sees only fitness for duty. |

### How a message reaches the doctor on Earth

The web app is local on purpose: a spacecraft has no normal internet. In the prototype, the crew server stores each report packet with an arrival time based on the light delay, and the Ground portal shows it as "in transit" until then. On a real mission, the onboard server would hand the outbox to the spacecraft's radio, which sends it to mission control through NASA's Deep Space Network using store-and-forward networking. The flight surgeon's reply comes back to the astronaut's Inbox the same way.

In the demo, both sides run on one laptop and the delay is simulated; a "skip light delay" button speeds it up for judges.

## Technologies and tools

ORBIT TWIN is a React and TypeScript web app with a small Node.js crew server and a SQLite database, all running on one laptop or tablet with no internet and no cloud services.

| Layer | Technology | What we use it for |
| --- | --- | --- |
| Front end | React 19, TypeScript 5.7 | All pages: Twin View, organ pages, check-in, Action Center, Ground portal |
| Build tool | Vite 6 | Development server and production build |
| Routing | React Router 7 | Astronaut and Ground portal pages, sign-in protection |
| Styling | Tailwind CSS 4, clsx, tailwind-merge | Tablet-first layout, light and dark themes |
| Icons | Lucide React | Interface icons |
| Charts | Recharts 3 | 30-day trend charts and the Future Slider |
| Crew server | Node.js 22.5+ (built-in HTTP) | REST API: sign-in, readings, alerts, report packets, Ground portal, inbox |
| Database | SQLite through Node's built-in `node:sqlite` | Astronauts, readings, notifications, report packets, audit log |
| Security | scrypt PIN hashes, signed httpOnly session cookies | Sign-in, 5-try lockout, role-based privacy rules enforced by the server |
| Offline | Service worker | Keeps the app working with Wi-Fi off; health data is never cached |
| Testing | Custom Node test runner (`npm test`, 114 checks) | Sign-in, privacy, data rules, twin logic, alert-timing validation |
| Collaboration | Git and GitHub, VS Code | Six-member team, one branch per member, merged through pull requests |

The health logic is fixed, explainable rules, not AI: every status can be traced to a threshold, the person's baseline and a published source.

## Data sources, references and resources

All astronaut data in ORBIT TWIN is synthetic and labelled `SYNTHETIC_DEMO`; the rules that judge it come from published NASA, CSA and clinical sources.

### Demo dataset (synthetic)

We generated 31 days for 4 fictional crew members: 124 daily records, mission days 184 to 214. It is stored in the database and also published as [`public/data/orbit_twin_demo.json`](../public/data/orbit_twin_demo.json) and [`.csv`](../public/data/orbit_twin_demo.csv) in the repository.

- **Recipe:** each person's pre-flight baseline, plus a shorter in-flight sleep (−0.2 h, from ISS actigraphy studies), plus realistic day-to-day variation (e.g. heart rate SD 2.5 bpm, SpO₂ 0.7 %), plus radiation of 1.84 mSv/day ±10 % for Mars transit (measured by Curiosity's RAD instrument).
- **Built-in demo cases:** a gradual heart-rate and sleep change (Sara, Watch), a healthy astronaut (Ahmed), a missing SpO₂ reading (Lena, Unknown), and a low-SpO₂ emergency injected live (Omar, Act).
- **Validation set:** 1,000 simulated astronauts, kept in memory only, test alert timing. Our rule catches 96 % of problems before they become serious, misses none, and gives about 1.9 false Watch days per healthy astronaut per month.

### NASA and CSA references

Hazards and risks (NASA Human Research Program):

- [NASA HRP: Hazards](https://www.nasa.gov/hrp/hazards/) · [Risks](https://www.nasa.gov/hrp/risks/) · [Ongoing research](https://www.nasa.gov/hrp/ongoing-hrp-research/)
- Hazards: [Gravity fields](https://www.nasa.gov/hrp/hazard-gravity-fields/) · [Isolation and confinement](https://www.nasa.gov/hrp/hazard-isolation-and-confinement/) · [Hostile/closed environments](https://www.nasa.gov/hrp/hazard-hostile-closed-environments/) · [Space radiation](https://www.nasa.gov/hrp/hazard-space-radiation/) · [Distance from Earth](https://www.nasa.gov/hrp/hazard-distance-from-earth/)
- Brain and behaviour: [Behavioral conditions and psychiatric disorders](https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/) · [Inadequate sleep and irregular schedules](https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/) · [Inadequate teamwork](https://www.nasa.gov/reference/risk-of-inadequate-teamwork/)
- Eyes: [Spaceflight Associated Neuro-ocular Syndrome (SANS)](https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/)
- Heart: [Cardiovascular adaptations](https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/)
- Blood and immunity: [Altered immune system responses](https://www.nasa.gov/reference/risk-of-altered-immune-system-responses/) · [Host-microorganism interactions](https://www.nasa.gov/reference/risk-of-host-microorganism-interactions/) · [Inadequate food and nutrition](https://www.nasa.gov/reference/risk-of-inadequate-food-and-nutrition/)
- Muscles and bones: [Reduced cardiorespiratory and musculoskeletal fitness](https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/) · [Spaceflight-induced bone changes](https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/)
- Radiation: [Radiation-induced cancers](https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/) · [CSA: Monitoring radiation for astronaut health (26 Feb 2026)](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp)
- Mission context: [NASA: What is Mars solar conjunction?](https://www.nasa.gov/solar-system/whats-mars-solar-conjunction-and-why-does-it-matter/) · [NASA JPL: Mars fleet lies low (Nov 11–25, 2023)](https://www.jpl.nasa.gov/news/nasas-mars-fleet-will-still-conduct-science-while-lying-low/) · [CSA: Why we do science in space](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp)
- Also used for measurement design: NASA Standard Measures and NASA Open Science Data Repository (OSDR).

### Clinical reference ranges

Used only to sanity-check values typed at sign-up; the twin itself compares with each astronaut's own baseline.

| Measure | Reference |
| --- | --- |
| Blood pressure | AHA/ACC 2017 guideline |
| Resting heart rate | American Heart Association |
| Fasting blood sugar | American Diabetes Association |
| Sleep | AASM: at least 7 h |
| SpO₂ | Pulse oximetry normal 95–100 % |

SpO₂ alert thresholds are demo criteria and would need medical validation; bone and muscle values are illustrative model estimates, not scans.

## Links and supporting materials

| Material | Where |
| --- | --- |
| Source code | [github.com/HagarKhaled99/Nasa-EG_OrbitCare](https://github.com/HagarKhaled99/Nasa-EG_OrbitCare) |
| Developer guide and judge demo script | [README.md](../README.md) |
| Manual test scenarios with expected results | [docs/TEST_SCENARIOS.md](TEST_SCENARIOS.md) |
| Demo dataset | [orbit_twin_demo.json](../public/data/orbit_twin_demo.json) and [orbit_twin_demo.csv](../public/data/orbit_twin_demo.csv) |
| Alert-timing validation | `/validation` page in the running app |
| Demo video | To be added |
| Presentation slides | To be added |

### Run it yourself

Requires Node.js 22.5 or newer.

```bash
npm install
npm run start   # production build + offline mode + crew server
npm test        # 114 automated checks
```

Sign in with any sample astronaut, PIN **2026**. Open `/ground/login` in a second window for the Flight Surgeon or Mission Director (PIN 2026). The **Demo** button (bottom right) injects a worsening reading or an emergency, and can skip the light delay.
