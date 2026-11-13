// =========================================================
// Referrals.jsx  (wireframe W17)
// Referrals coming in and going out, the letter preview and
// the export checklist.
// =========================================================
import { useState } from 'react'
import { Check, Download, Send } from 'lucide-react'
import { Card, Tag } from '../../components/ui.jsx'

const INCOMING = [
  { name: 'Omar Khaled', from: 'Dr. Sherif Kamal, family medicine', reason: 'Hoarseness over 4 weeks', status: 'Booked 10:00' },
  { name: 'Nour Salah', from: 'Al Salam polyclinic', reason: 'Nasal obstruction', status: 'Letter scanned' },
]
const OUTGOING = [
  { name: 'Youssef Adel', to: 'Audiology centre', reason: 'Full audiological assessment', status: 'Draft' },
  { name: 'Salma Ibrahim', to: 'Cochlear implant centre', reason: 'Profound loss, left', status: 'Appointment made' },
]

export default function Referrals() {
  const [selected, setSelected] = useState('Youssef Adel')
  const [sent, setSent] = useState(false)

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 340 }}>
        <h1>Referrals</h1>
        <h3>Incoming</h3>
        {INCOMING.map((r) => (
          <div key={r.name} className="list-item">
            <div className="grow">
              <b style={{ fontSize: 13 }}>{r.name}</b>
              <div className="small">{r.from}</div>
              <div style={{ fontSize: 12 }}>{r.reason}</div>
            </div>
            <Tag color="soft-blue">{r.status}</Tag>
          </div>
        ))}
        <h3>Outgoing</h3>
        {OUTGOING.map((r) => (
          <button key={r.name} className={'list-item' + (selected === r.name ? ' selected' : '')} onClick={() => setSelected(r.name)}>
            <div className="grow">
              <b style={{ fontSize: 13 }}>{r.name}</b>
              <div className="small">{r.to}</div>
              <div style={{ fontSize: 12 }}>{r.reason}</div>
            </div>
            <Tag color={r.status === 'Draft' ? '' : 'green'}>{r.status}</Tag>
          </button>
        ))}
      </div>

      <Card style={{ flex: 1, padding: 32, lineHeight: 1.6 }}>
        <div className="row between">
          <div className="logo" style={{ margin: 0, fontSize: 20 }}>ENT<span>Flow</span></div>
          <div className="small" style={{ textAlign: 'right' }}>18/10/2026<br />Ref ENT-RF-0142</div>
        </div>
        <hr style={{ border: 0, borderTop: '1px solid #e5ebf3', margin: '14px 0' }} />
        <p><b>To:</b> Audiology centre, Cairo</p>
        <p><b>Patient:</b> Youssef Adel, male, DOB 12/03/1992</p>
        <p style={{ margin: '12px 0' }}><b>Reason:</b> Full audiological assessment including tympanometry.</p>
        <div className="card inner">
          Right ear pain and reduced hearing for 3 days. Right tympanic membrane retracted with fluid level.
          Audiogram today: right mild loss (36 dB), left normal. Working diagnosis: otitis media with effusion, right.
        </div>
        <p className="mt"><b>Allergies:</b> penicillin (rash)</p>
        <p><b>Medicines:</b> cetirizine 10 mg at night</p>
        <p style={{ marginTop: 20 }}>Dr. Mohammed, ENT consultant</p>
      </Card>

      <div className="col" style={{ width: 280 }}>
        <Card tone="blue">
          <h3>Export for other systems (FHIR)</h3>
          <div className="col mt" style={{ gap: 6, fontSize: 12.5 }}>
            {['Patient', 'Encounter', 'Condition', 'Observation (audiogram)', 'AllergyIntolerance', 'DocumentReference (letter)'].map((item) => (
              <div key={item} className="row center"><Check size={13} /> {item}</div>
            ))}
          </div>
          <button className="btn white full mt"><Download size={13} /> Export bundle</button>
        </Card>
        <button className="btn outline">Edit letter</button>
        <button className="btn" onClick={() => setSent(true)}><Send size={13} /> {sent ? 'Letter sent' : 'Send letter'}</button>
      </div>
    </div>
  )
}
