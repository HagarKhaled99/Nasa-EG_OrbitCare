// =========================================================
// App.jsx
// The "brain" of the app. It remembers two things:
//   1. who is signed in (their role), or nobody
//   2. which page is open
// and decides what to show based on them.
//
// There is no router library: opening a page simply means
// calling nav.go(role, 'schedule'). useNavigation.js also puts
// every step in the browser history, so Back and Forward work.
// =========================================================
import useNavigation from './useNavigation.js'
import Login from './pages/Login.jsx'
import AppShell from './components/Layout.jsx'
import { AlertProvider } from './components/Alerts.jsx'
import { MENUS, USERS } from './menus.js'
import { NavButtons } from './components/ui.jsx'

// Doctor pages
import Dashboard from './pages/doctor/Dashboard.jsx'
import Schedule from './pages/doctor/Schedule.jsx'
import PatientRecord from './pages/doctor/PatientRecord.jsx'
import VisitDetails from './pages/doctor/VisitDetails.jsx'
import Consultation from './pages/doctor/Consultation.jsx'
import Prescription from './pages/doctor/Prescription.jsx'
import FollowUp from './pages/doctor/FollowUp.jsx'
import HearingTools from './pages/doctor/HearingTools.jsx'
import Referrals from './pages/doctor/Referrals.jsx'
// Other roles
import NurseWorkspace from './pages/nurse/NurseWorkspace.jsx'
import DocumentScan from './pages/nurse/DocumentScan.jsx'
import LiveQueue from './pages/reception/LiveQueue.jsx'
import Overview from './pages/owner/Overview.jsx'
import PatientApp from './pages/patient/PatientApp.jsx'

// Page id (from menus.js) -> the component to show
const PAGES = {
  dashboard: Dashboard,
  schedule: Schedule,
  record: PatientRecord,
  visit: VisitDetails,
  consultation: Consultation,
  prescription: Prescription,
  followup: FollowUp,
  hearing: HearingTools,
  referrals: Referrals,
  nurse: NurseWorkspace,
  scan: DocumentScan,
  queue: LiveQueue,
  owner: Overview,
}

export default function App() {
  const nav = useNavigation()
  const { role } = nav

  // Called by the login page with the chosen role
  function signIn(chosenRole) {
    // Patients start on their home screen; staff open the first page of their menu
    nav.go(chosenRole, chosenRole === 'patient' ? 'home' : MENUS[chosenRole][0].id)
  }

  function signOut() {
    nav.go(null, null)
  }

  // Opens another page for the same signed-in role
  const openPage = (page) => nav.go(role, page)

  // Back and forward arrows shown on every screen
  const arrows = <NavButtons canBack={nav.canBack} canForward={nav.canForward} onBack={nav.back} onForward={nav.forward} />

  // 1. Nobody signed in: show the login page
  if (role === null) {
    return <Login onSignIn={signIn} navButtons={arrows} />
  }

  // 2. A patient: the patient web app (same frame as staff, in English or Arabic)
  if (role === 'patient') {
    return (
      <AlertProvider canOpen={() => false} onOpen={openPage}>
        <PatientApp screen={nav.page} onNavigate={openPage} onLogout={signOut} navButtons={arrows} />
      </AlertProvider>
    )
  }

  // 3. Staff: show the sidebar frame with the chosen page inside
  //    AlertProvider lets any page pop a red alert message.
  const menu = MENUS[role]
  // A page this role cannot open (for example an old link) falls back to its first page
  const page = PAGES[nav.page] ? nav.page : menu[0].id
  const Page = PAGES[page]
  return (
    <AlertProvider canOpen={(id) => menu.some((item) => item.id === id)} onOpen={openPage}>
      <AppShell role={role} menu={menu} activePage={page} onNavigate={openPage} user={USERS[role]} onLogout={signOut} navButtons={arrows}>
        <Page onNavigate={openPage} />
      </AppShell>
    </AlertProvider>
  )
}
