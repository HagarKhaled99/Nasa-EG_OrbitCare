// =========================================================
// PatientHome.jsx  (wireframe W10)
// Next appointment, today's tasks, tools and the urgent button.
//
// Every text has an English and an Arabic version. "t" holds the
// texts for the language that is selected now.
// =========================================================
import { useState } from 'react'
import { Pill, HeartPulse, Ear, FileText, AlertTriangle, Check, CalendarDays, Phone } from 'lucide-react'

const TEXT = {
  en: {
    hello: 'Hello, Youssef', sub: 'Here is what matters for your recovery today.', next: 'Next appointment', when: 'Sun 1 Nov, 10:30', doctor: 'Dr. Mohammed, review',
    today: 'Today', drops: 'Ear drops, right ear', dropsTime: '8:00 and 20:00', checkin: 'Daily check-in', checkinTime: 'Opens at 18:00',
    tools: 'Tools', hear: 'Hear what I hear', hearSub: 'Show the doctor how sounds reach you', reports: 'My reports', reportsSub: 'Audiograms, prescriptions and letters',
    urgent: 'Urgent: I suddenly lost hearing', urgentSub: 'Sudden hearing loss needs care within 72 hours. The clinic is alerted right away.', emergency: 'Emergency? Call 123',
    start: 'Start now', taken: 'Taken', tap: 'Mark as taken',
  },
  ar: {
    hello: 'مرحباً، يوسف', sub: 'هذا ما يهم لتعافيك اليوم.', next: 'موعدك القادم', when: 'الأحد 1 نوفمبر، 10:30 ص', doctor: 'د. محمد، متابعة',
    today: 'مهام اليوم', drops: 'قطرة الأذن، الأذن اليمنى', dropsTime: '8:00 ص و 8:00 م', checkin: 'المتابعة اليومية', checkinTime: 'تفتح الساعة 6:00 م',
    tools: 'أدوات', hear: 'اسمع ما أسمعه', hearSub: 'أرِ الطبيب كيف تصلك الأصوات', reports: 'تقاريري', reportsSub: 'تخطيط السمع والوصفات والخطابات',
    urgent: 'عاجل: فقدت السمع فجأة', urgentSub: 'فقدان السمع المفاجئ يحتاج رعاية خلال 72 ساعة. يتم تنبيه العيادة فوراً.', emergency: 'طوارئ؟ اتصل 123',
    start: 'ابدأ الآن', taken: 'تم', tap: 'تم أخذها',
  },
}

export default function PatientHome({ lang, onNavigate }) {
  const t = TEXT[lang]
  const [dropsTaken, setDropsTaken] = useState(false)

  return (
    <div className="col" style={{ gap: 18 }}>
      <div>
        <h1>{t.hello}</h1>
        <p className="muted" style={{ marginTop: 4 }}>{t.sub}</p>
      </div>

      <div className="patient-grid">
        <div className="card blue">
          <div className="row center">
            <CalendarDays size={22} />
            <div className="small">{t.next}</div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, margin: '14px 0 4px' }}>{t.when}</div>
          <div className="small">{t.doctor}</div>
        </div>

        {/* The urgent button is a full red card so it cannot be missed */}
        <div className="card red col">
          <div className="row center"><AlertTriangle size={20} /><h2>{t.urgent}</h2></div>
          <div className="small">{t.urgentSub}</div>
          <div className="row center">
            <button className="btn"><Phone size={14} /> {t.urgent}</button>
            <span className="small">{t.emergency}</span>
          </div>
        </div>
      </div>

      <div className="patient-grid">
        <div className="card col">
          <h2>{t.today}</h2>
          {/* Clicking the medicine marks today's dose as taken */}
          <button className={'list-item' + (dropsTaken ? ' selected' : '')} onClick={() => setDropsTaken(!dropsTaken)}>
            <Pill size={20} color="#2f74d6" />
            <div className="grow"><b>{t.drops}</b><div className="small">{t.dropsTime}</div></div>
            {dropsTaken ? <span className="tag blue"><Check size={12} /> {t.taken}</span> : <span className="small">{t.tap}</span>}
          </button>
          <button className="list-item" onClick={() => onNavigate('checkin')}>
            <HeartPulse size={20} color="#2f74d6" />
            <div className="grow"><b>{t.checkin}</b><div className="small">{t.checkinTime}</div></div>
            <span className="btn small">{t.start}</span>
          </button>
        </div>

        <div className="card col">
          <h2>{t.tools}</h2>
          <div className="grid-2">
            <div className="card sky"><Ear size={22} /><div style={{ marginTop: 12, fontWeight: 600 }}>{t.hear}</div><div className="small">{t.hearSub}</div></div>
            <div className="card amber"><FileText size={22} /><div style={{ marginTop: 12, fontWeight: 600 }}>{t.reports}</div><div className="small">{t.reportsSub}</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}
