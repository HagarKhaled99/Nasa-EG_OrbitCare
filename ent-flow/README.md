# ENT Flow, React version of the wireframes

A clickable version of the ENT Flow wireframes (v5) built with React.
All data is fake and lives in `src/data.js`; nothing is saved to a server yet.

## How to run it from scratch

### 1. Install Node.js (one time per computer)

The only thing to install is **Node.js 18 or newer** (20 or 22 LTS recommended).
It comes with `npm`, which downloads everything else the project needs.

- **Windows / macOS:** download the "LTS" installer from https://nodejs.org and run it with the default options.
- **Ubuntu / Debian:**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

Close and reopen the terminal, then check it worked (both should print a version number):

```bash
node -v
npm -v
```

### 2. Unzip the project and open a terminal in it

Unzip `ent-flow.zip`, then open a terminal inside the `ent-flow` folder
(the one that contains `package.json`).

- **Windows:** open the folder in File Explorer, click the address bar, type `cmd` and press Enter.
- **macOS / Linux:** `cd` into the folder, for example `cd ~/Downloads/ent-flow`.

### 3. Install the project's packages (one time)

```bash
npm ci
```

This reads `package-lock.json` and installs the exact versions the project was tested with
into a `node_modules` folder (takes about a minute; needs an internet connection).
If `npm ci` fails, `npm install` works too.

### 4. Start the app

```bash
npm run dev
```

Open the address it prints (usually http://localhost:5173) in Chrome, Edge or Firefox.
Leave the terminal open while you use the app; press `Ctrl + C` in it to stop.

### Optional: build files for hosting

```bash
npm run build
npm run preview
```

`npm run build` creates a `dist` folder with plain HTML, CSS and JavaScript that any static
web host can serve. `npm run preview` shows that built version at http://localhost:4173.

### Using the app

To try a role, pick it on the login page and press **Sign in**. Any password works.
The **Clinic owner sign-in** button opens the owner screen.

### If something goes wrong

- `node` or `npm` "is not recognized": Node.js is not installed, or the terminal was opened
  before installing it. Reopen the terminal.
- "Port 5173 is in use": another copy is already running. Stop it, or use the other address Vite prints.
- Strange errors after copying the folder from another computer: delete `node_modules` and run `npm ci` again.

## How the code is organized

```
src/
  main.jsx            Starting point. Puts <App /> on the page.
  App.jsx             Remembers who is signed in and which page is open.
  menus.js            Sidebar links for each role.
  data.js             All the example data the screens show.
  styles.css          All colors and styles (plain CSS).
  components/         Pieces used by many pages
    ui.jsx            Card, Tag, Placeholder, Avatar, Segmented
    Charts.jsx        Bar chart, ring chart, audiogram
    Layout.jsx        Sidebar + top bar around staff pages
    Alerts.jsx        Red pop-up alerts (any page can raise one)
    ExamWorkspace.jsx Ear / nose / throat pictures the doctor marks, draws
                      and comments on during the consultation
  pages/              One file per screen
    Login.jsx                      L0  login and new patient profile
    doctor/Dashboard.jsx           D1
    doctor/Schedule.jsx            D2  day and week
    doctor/PatientRecord.jsx       D3
    doctor/VisitDetails.jsx        D4
    doctor/Consultation.jsx        W2  visit header, Examination / Note / Decision tabs
    doctor/HearingTools.jsx        W7
    doctor/FollowUp.jsx            W9
    doctor/Prescription.jsx        W12
    doctor/Referrals.jsx           W17
    reception/LiveQueue.jsx        W1
    nurse/NurseWorkspace.jsx       W5  (W4 + W5), the assistant
    nurse/DocumentScan.jsx         W15
    owner/Overview.jsx             W11
    patient/PatientApp.jsx         patient web app + English / Arabic switch
    patient/PatientHome.jsx        W10
    patient/DailyCheckin.jsx       W8
    patient/Intake.jsx             W13
public/icons/         ear, head and mouth icons
public/anatomy/       anatomy pictures used by the examination
```

## The four React ideas used everywhere

**1. Components.** A component is a function that returns the HTML for one part of the screen.
It is used like a tag: `<Card tone="sky">Hello</Card>`.

**2. Props.** The values written on the tag (`tone="sky"`) are passed into the function as an
object called `props`. This is how a page tells a component what to show.

**3. State (`useState`).** A value the screen remembers, for example which tab is open:

```jsx
const [view, setView] = useState('Week')   // start with "Week"
setView('Day')                             // change it; React redraws the screen
```

Whenever state changes, React redraws that part of the screen by itself.
Good examples: the safety checks in `Prescription.jsx` and the table filters in `LiveQueue.jsx`.

**4. Lists with `.map()`.** To show many rows, we loop over a list and return one element each:

```jsx
{medications.map((m) => <div key={m.name}>{m.name}</div>)}
```

`key` is a unique value React uses to keep track of each row.

## Short glossary

- **JSX**: the HTML-like code inside `.jsx` files. Differences from HTML: `className` instead of
  `class`, `style={{ color: 'red' }}` instead of `style="color:red"`, and `{ }` to insert a value.
- **`{condition && <div/>}`**: show the div only when the condition is true.
- **`onClick={() => ...}`**: the function to run when the element is clicked.
- **`...object` / `...list`**: makes a copy, so we can change the copy and give it to React.

## Next steps (not built yet)

- Connect `data.js` to the real backend API.
- Real login and roles checked on the server.
- Saving notes, prescriptions and check-ins.
- Real audio for the hearing simulator.
