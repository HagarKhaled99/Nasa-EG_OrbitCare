// =========================================================
// Dashboard.jsx  (wireframe D1)
// Doctor home: patients today, the next patient with the
// AI pre-visit brief, the calendar and follow-up alerts.
// =========================================================
import { AlertTriangle, Sparkles } from 'lucide-react'
import { Card, Tag, Placeholder } from '../../components/ui.jsx'
import { DonutChart } from '../../components/Charts.jsx'
import { currentPatient, followUpAlerts } from '../../data.js'

// "onNavigate" lets buttons on this page open other pages
export default function Dashboard({ onNavigate }) {
  return (
    <div className="row" style={{ gap: 20 }}>
      {/* Left side */}
      <div className="col grow">
        <div>
          <h1>Good morning, Dr. Mohammed</h1>
          <p className="muted">28 patients booked today, 3 urgent. 2 red follow-up alerts need you before the first visit.</p>
        </div>

        <Card>
          <h2>Patients today</h2>
          <div className="grid-3 mt">
            <div className="stat"><span className="small">Booked</span><b>28</b></div>
            <div className="stat urgent"><span className="small">Urgent</span><b>3</b></div>
            <div className="stat"><span className="small">Seen</span><b>17</b></div>
          </div>
        </Card>

        <NextPatient onStart={() => onNavigate('consultation')} />
      </div>

      {/* Right side */}
      <div className="col" style={{ width: 330 }}>
        <MiniCalendar />
        {/* Alerts are fully red so they cannot be missed */}
        <Card tone="red">
          <div className="row between center">
            <h2 className="row center" style={{ gap: 8 }}><AlertTriangle size={18} /> Follow-up alerts</h2>
            <Tag color="red">{followUpAlerts.red} act now</Tag>
          </div>
          <div className="row center mt" style={{ gap: 20 }}>
            <DonutChart
              centerText={followUpAlerts.red + followUpAlerts.amber + followUpAlerts.green}
              hole="#d93a40"
              parts={[
                { value: followUpAlerts.red, color: '#ffffff' },
                { value: followUpAlerts.amber, color: '#ffc9a8' },
                { value: followUpAlerts.green, color: '#ff8f92' },
              ]}
            />
            <div className="col" style={{ gap: 6 }}>
              <span><span className="dot" style={{ background: '#ffffff' }} /> {followUpAlerts.red} red, act now</span>
              <span><span className="dot" style={{ background: '#ffc9a8' }} /> {followUpAlerts.amber} amber</span>
              <span><span className="dot" style={{ background: '#ff8f92' }} /> {followUpAlerts.green} green</span>
              <button className="btn small" onClick={() => onNavigate('followup')}>Open alerts</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// The one next patient, with the AI brief underneath
function NextPatient({ onStart }) {
  const brief = [
    ['Complaint', 'Right ear pain and reduced hearing for 3 days. No discharge.'],
    ['Last visit', '12 Aug 2026: right otitis externa, resolved.'],
    ['Medicines', 'Cetirizine 10 mg at night.'],
    ['Intake', 'Completed by the patient. Waiting for your confirmation.'],
  ]

  return (
    <Card>
      <div className="row between center">
        <h2>Next patient</h2>
        <Tag color="blue">{currentPatient.visitTime}, {currentPatient.room}</Tag>
      </div>

      <div className="row center mt" style={{ gap: 16 }}>
        <Placeholder width={60} height={60} />
        <div className="grow">
          <div style={{ fontSize: 20, fontWeight: 600 }}>{currentPatient.name}</div>
          <div className="muted">{currentPatient.sex}, {currentPatient.age} y. {currentPatient.complaint}</div>
        </div>
        <Tag color="red"><AlertTriangle size={12} /> Allergy: penicillin</Tag>
        <button className="btn" onClick={onStart}>Start consultation</button>
      </div>

      <div className="row between center" style={{ marginTop: 18 }}>
        <h3>Pre-visit brief</h3>
        <Tag color="ai"><Sparkles size={11} /> AI summary</Tag>
      </div>
      <div className="grid-4 mt">
        {brief.map(([title, text]) => (
          <div key={title} className="card inner">
            <div className="small">{title}</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>{text}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// A month view for October 2026 (the 1st is a Thursday)
function MiniCalendar() {
  const dayNames = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  const emptyCellsBeforeDay1 = 3   // Monday, Tuesday, Wednesday are empty
  const today = 18

  // Build one list: 3 empty cells, then the numbers 1 to 31
  const cells = []
  for (let i = 0; i < emptyCellsBeforeDay1; i++) cells.push('')
  for (let day = 1; day <= 31; day++) cells.push(day)

  return (
    <Card>
      <div className="row between center" style={{ marginBottom: 10 }}>
        <h3>October 2026</h3>
        <button className="btn small outline">Add event</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
        {dayNames.map((d) => <div key={d} className="small">{d}</div>)}
        {cells.map((day, index) => (
          <div
            key={index}
            style={{
              padding: '6px 0',
              borderRadius: '50%',
              background: day === today ? '#2f74d6' : 'transparent',
              color: day === today ? '#fff' : 'inherit',
              fontWeight: day === today ? 700 : 400,
            }}
          >
            {day}
          </div>
        ))}
      </div>
    </Card>
  )
}
