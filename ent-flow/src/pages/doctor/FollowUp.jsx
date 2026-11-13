// =========================================================
// FollowUp.jsx  (wireframe W9)
// Patients in follow-up programs, most urgent first. Click a
// patient to see why the alert was raised and today's answers.
// =========================================================
import { useState } from 'react'
import { Phone } from 'lucide-react'
import { Card, Tag, statusColor } from '../../components/ui.jsx'
import { followUps } from '../../data.js'

export default function FollowUp() {
  const [selectedName, setSelectedName] = useState(followUps[0].name)
  const [acknowledged, setAcknowledged] = useState(false)

  // Find the full patient object for the selected name
  const selected = followUps.find((f) => f.name === selectedName)

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col" style={{ width: 400 }}>
        <h1>Follow-up</h1>
        <p className="muted">{followUps.length} patients need attention. Sorted by risk.</p>
        {followUps.map((f) => (
          <button
            key={f.name}
            className={'list-item' + (f.name === selectedName ? ' selected' : '') + (f.level === 'Red' ? ' alert' : '')}
            onClick={() => {
              setSelectedName(f.name)
              setAcknowledged(false)
            }}
          >
            <Tag color={statusColor(f.level)}>{f.level}</Tag>
            <div className="grow">
              <b style={{ fontSize: 13 }}>{f.name}</b>
              <div className="small">{f.program}</div>
              <div style={{ fontSize: 12 }}>{f.note}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="col grow">
        {/* A red alert fills the whole card in red */}
        <Card tone={selected.level === 'Red' ? 'red' : 'blue'}>
          <div className="row center">
            <Tag color={statusColor(selected.level)}>{selected.level} alert</Tag>
            <div className="grow">
              <b style={{ fontSize: 16 }}>{selected.name}</b>
              <div className="small">{selected.program}</div>
            </div>
            {!acknowledged && <div className="small">Escalates to backup in 04:12</div>}
          </div>
          <div className="row mt">
            <button className="btn white" onClick={() => setAcknowledged(true)}>
              {acknowledged ? 'Acknowledged' : 'Acknowledge'}
            </button>
            <button className="btn white"><Phone size={13} /> Call</button>
            <button className="btn white">Message</button>
            <button className="btn white">Book urgent visit</button>
          </div>
        </Card>

        <Card tone={selected.level === 'Red' ? 'red' : 'amber'}>
          <h3>Why this level</h3>
          <p style={{ marginTop: 6 }}>{selected.note}</p>
          <p className="small mt">Typed notes are checked for warning words. This check can only raise the alert level, never lower it.</p>
        </Card>

        <Card>
          <h3>Today's answers</h3>
          <div className="grid-4 mt">
            {[['Pain', '5 of 10'], ['Bleeding (tap)', 'None'], ['Fluids', 'With difficulty'], ['Temperature', '37.8 °C']].map(([q, a]) => (
              <div key={q} className="card inner">
                <div className="small">{q}</div>
                <b>{a}</b>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
