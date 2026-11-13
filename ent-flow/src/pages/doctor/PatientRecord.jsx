// =========================================================
// PatientRecord.jsx  (wireframe D3)
// Identity, previous diagnoses, medical history with allergies
// in red, medications, hearing chart and recent files.
// =========================================================
import { Pill } from 'lucide-react'
import { Card, Tag, Placeholder, statusColor } from '../../components/ui.jsx'
import { Audiogram } from '../../components/Charts.jsx'
import { currentPatient, allergies, medicalHistory, medications, previousDiagnoses, audiogram } from '../../data.js'

export default function PatientRecord({ onNavigate }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {/* Left column: who the patient is */}
      <div className="col" style={{ width: 280 }}>
        <PatientCard />
        <Card>
          <h3 style={{ marginBottom: 8 }}>Previous diagnoses</h3>
          <div className="col" style={{ gap: 6 }}>
            {previousDiagnoses.map((d) => (
              <div key={d.name} className="list-item">
                <div className="grow">
                  <b style={{ fontSize: 13 }}>{d.name}</b>
                  <div className="small">{d.date}</div>
                </div>
                <Tag color={statusColor(d.status)}>{d.status}</Tag>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Middle column: history and medicines */}
      <div className="col grow">
        <div className="row between center">
          <h2>Medical history and allergies</h2>
          <button className="btn small" onClick={() => onNavigate('consultation')}>Start consultation</button>
        </div>
        <Card>
          <table className="table">
            <thead>
              <tr><th>Item</th><th>Answer</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {/* Allergies first, with the red "allergy" row style */}
              {allergies.map((a) => (
                <tr key={a.name} className="allergy">
                  <td><b>Allergy, {a.type.toLowerCase()}</b></td>
                  <td><Tag color="red">{a.name}</Tag></td>
                  <td>{a.reaction}</td>
                </tr>
              ))}
              {medicalHistory.map((h) => (
                <tr key={h.item}>
                  <td>{h.item}</td>
                  <td><Tag color={h.answer === 'Yes' ? 'soft-blue' : h.answer === 'Unknown' ? 'soft-amber' : ''}>{h.answer}</Tag></td>
                  <td className="small">{h.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h3 style={{ marginBottom: 8 }}>Medications</h3>
          <div className="col" style={{ gap: 6 }}>
            {medications.map((m) => (
              <div key={m.name} className="list-item">
                <Pill size={16} color="#2f74d6" />
                <div className="grow">
                  <b style={{ fontSize: 13 }}>{m.name}</b>
                  <div className="small">{m.dose}</div>
                </div>
                <Tag color={statusColor(m.status)}>{m.status}</Tag>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Right column: hearing and files */}
      <div className="col" style={{ width: 340 }}>
        <Card tone="amber">
          <h3>Hearing, right vs left</h3>
          <Audiogram data={audiogram} width={300} height={180} />
          <div className="small"><span style={{ color: '#d2334a' }}>O right</span> and <span style={{ color: '#2f57c7' }}>X left</span></div>
        </Card>
        <Card>
          <h3 style={{ marginBottom: 8 }}>Recent files</h3>
          <div className="grid-2">
            {['Otoscopy, right', 'Otoscopy, left', 'Audiogram scan', 'Referral letter'].map((file) => (
              <div key={file}>
                <Placeholder height={80} />
                <div className="small" style={{ marginTop: 4 }}>{file}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// Reused on the Visit details page too, so it is exported
export function PatientCard() {
  const p = currentPatient
  const rows = [['Sex', p.sex], ['Date of birth', `${p.dateOfBirth} (${p.age} y)`], ['Phone', p.phone], ['Payer', p.payer], ['Language', p.language]]
  return (
    <Card tone="green">
      <div className="row center">
        <Placeholder width={56} height={56} />
        <div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{p.name}</div>
          <div className="small">ID {p.id}</div>
        </div>
      </div>
      <div className="col mt" style={{ gap: 5 }}>
        {rows.map(([label, value]) => (
          <div key={label} className="row between" style={{ fontSize: 12.5 }}>
            <span className="small">{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
