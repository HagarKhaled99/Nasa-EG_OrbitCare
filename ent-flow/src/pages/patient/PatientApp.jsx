// =========================================================
// PatientApp.jsx
// The patient web app. It uses the same frame as the staff
// screens (sidebar, top bar, back / forward arrows) and adds a
// language switch: English or Arabic.
//
// Arabic is right-to-left: setting dir="rtl" on the frame flips
// the whole layout automatically.
// =========================================================
import { useState } from 'react'
import { Home, HeartPulse, ClipboardList } from 'lucide-react'
import AppShell from '../../components/Layout.jsx'
import { USERS } from '../../menus.js'
import PatientHome from './PatientHome.jsx'
import DailyCheckin from './DailyCheckin.jsx'
import Intake from './Intake.jsx'

const SCREENS = { home: PatientHome, checkin: DailyCheckin, intake: Intake }

// Sidebar links and texts in both languages
const MENU_TEXT = {
  en: { home: 'My health', checkin: 'Daily check-in', intake: 'Before your visit', promo: 'Your ENT care, in one place', logout: 'Log out', title: 'Patient' },
  ar: { home: 'صحتي', checkin: 'المتابعة اليومية', intake: 'قبل زيارتك', promo: 'رعاية الأنف والأذن والحنجرة في مكان واحد', logout: 'تسجيل الخروج', title: 'مريض' },
}
const MENU_ICONS = { home: Home, checkin: HeartPulse, intake: ClipboardList }

// - screen / onNavigate: which screen is open; App.jsx keeps it in the
//   browser history so the back and forward arrows work here too
// - navButtons: the back and forward arrows
export default function PatientApp({ screen, onNavigate, onLogout, navButtons }) {
  const [lang, setLang] = useState('en')   // 'en' or 'ar'
  const text = MENU_TEXT[lang]

  const current = SCREENS[screen] ? screen : 'home'
  const Screen = SCREENS[current]
  const menu = Object.keys(SCREENS).map((id) => ({ id, label: text[id], icon: MENU_ICONS[id] }))

  const languageSwitch = (
    <div className="seg">
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
      <button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>العربية</button>
    </div>
  )

  return (
    <AppShell
      role="patient"
      menu={menu}
      activePage={current}
      onNavigate={onNavigate}
      user={{ ...USERS.patient, title: text.title }}
      onLogout={onLogout}
      navButtons={navButtons}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      labels={text}
      topbarExtra={languageSwitch}
    >
      <Screen lang={lang} onNavigate={onNavigate} />
    </AppShell>
  )
}
