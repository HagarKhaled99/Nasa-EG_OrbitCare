// =========================================================
// Layout.jsx
// The frame around every staff page: sidebar on the left,
// top bar (search, alerts bell, signed-in user) and the page
// itself in the middle.
// =========================================================
import { useEffect } from 'react'
import { Search, Bell, LogOut, ChevronDown, Ear } from 'lucide-react'
import { Avatar } from './ui.jsx'
import { useAlerts } from './Alerts.jsx'
import { incomingAlerts } from '../data.js'

// How long after sign-in the example alert pops up
const ALERT_DELAY_MS = 2500

// Left menu. It receives:
// - menu: the list of pages for this role (from menus.js)
// - activePage: id of the page open now, so we can highlight it
// - onNavigate: function to call with a page id when a link is clicked
// - onLogout: function to call when "Log out" is clicked
// - labels: sidebar texts, so the patient app can show them in Arabic
function Sidebar({ menu, activePage, onNavigate, onLogout, labels }) {
  return (
    <aside className="sidebar">
      <div className="logo"><Ear size={26} /> ENT<span>Flow</span></div>

      {/* .map() repeats the button once for every item in the list */}
      {menu.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            className={'nav-item' + (item.id === activePage ? ' active' : '')}
            onClick={() => onNavigate(item.id)}
          >
            <Icon size={18} /> {item.label}
          </button>
        )
      })}

      <div className="sidebar-promo">
        {labels.promo}
        <img src="/icons/head.png" alt="" />
      </div>
      <button className="nav-item" onClick={onLogout}>
        <LogOut size={18} /> {labels.logout}
      </button>
    </aside>
  )
}

// Back / forward arrows, search bar, alerts bell and the signed-in user.
// "extra" is anything a role adds to the bar (the patient's language switch).
function TopBar({ user, navButtons, showSearch, extra }) {
  const { count, showAll } = useAlerts()
  return (
    <div className="topbar">
      {navButtons}
      {showSearch && (
        <div className="search">
          <Search size={16} color="#64748b" />
          <input placeholder="Search patients, drugs, codes" />
        </div>
      )}
      <div className="grow" />
      {extra}
      <button className="bell" title="Alerts" onClick={showAll}>
        <Bell size={19} />
        {count > 0 && <span className="bell-count">{count}</span>}
      </button>
      <div className="topbar-user">
        <Avatar name={user.name} />
        <div>
          <b>{user.name}</b>
          <div className="small">{user.title}</div>
        </div>
        <ChevronDown size={16} color="#64748b" />
      </div>
    </div>
  )
}

const STAFF_LABELS = { promo: 'Better care through smarter ENT technology', logout: 'Log out' }

// Puts everything together. "children" is the page that App.jsx
// places inside <AppShell> ... </AppShell>.
// The patient app also uses this frame and passes:
// - dir: 'rtl' for Arabic, which mirrors the whole layout
// - labels: translated sidebar texts
// - topbarExtra: the language switch
export default function AppShell({
  role, menu, activePage, onNavigate, user, onLogout, navButtons, children,
  dir = 'ltr', labels = STAFF_LABELS, topbarExtra = null,
}) {
  const { raise } = useAlerts()

  // Example: a new alert arrives shortly after sign-in and pops up in red
  useEffect(() => {
    const timer = setTimeout(() => {
      ;(incomingAlerts[role] || []).forEach(raise)
    }, ALERT_DELAY_MS)
    return () => clearTimeout(timer)   // cancel if the user signs out first
  }, [role])

  return (
    <div className="app" dir={dir}>
      <Sidebar menu={menu} activePage={activePage} onNavigate={onNavigate} onLogout={onLogout} labels={labels} />
      <div className="main-wrap">
        <TopBar user={user} navButtons={navButtons} showSearch={role !== 'patient'} extra={topbarExtra} />
        <main className="main">{children}</main>
      </div>
    </div>
  )
}
