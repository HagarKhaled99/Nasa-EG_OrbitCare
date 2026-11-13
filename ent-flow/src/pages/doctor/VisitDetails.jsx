// =========================================================
// VisitDetails.jsx  (wireframe D4)
// Visit summary, clinical test results, weight and vitals.
// =========================================================
import { Card, Tag, statusColor } from '../../components/ui.jsx'
import { BarChart } from '../../components/Charts.jsx'
import { PatientCard } from './PatientRecord.jsx'
import { previousDiagnoses } from '../../data.js'

// Hearing tests from today's visit
const TEST_RESULTS = [
  { name: 'Pure-tone average, right', value: '36 dB', meaning: 'Mild loss', status: 'Needs attention', reference: 'ref. 25 dB or less' },
  { name: 'Tympanometry, right', value: 'Type B', meaning: 'Flat trace', status: 'Needs attention', reference: 'ref. type A' },
  { name: 'Pure-tone average, left', value: '20 dB', meaning: 'Normal', status: 'Normal', reference: 'ref. 25 dB or less' },
]

const VITALS = [['Weight', '82', 'kg'], ['Height', '178', 'cm'], ['Blood pressure', '125/80', 'mmHg'], ['Pulse', '76', 'bpm']]

export default function VisitDetails() {
  return (
    <div className="col">
      <div className="row between center">
        <h1>Visit details</h1>
        <Tag color="blue">In progress, 09:04</Tag>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="col" style={{ width: 280 }}>
          <PatientCard />
          <Card>
            <h3 style={{ marginBottom: 8 }}>Previous diagnoses</h3>
            {previousDiagnoses.map((d) => (
              <div key={d.name} className="row between center" style={{ padding: '6px 0' }}>
                <span style={{ fontSize: 13 }}>{d.name}</span>
                <Tag color={statusColor(d.status)}>{d.status}</Tag>
              </div>
            ))}
          </Card>
        </div>

        <div className="col grow">
          <Card>
            <h2>Summary</h2>
            <div className="small mt">Complaint</div>
            <p>Right ear pain and fullness for 3 days, reduced hearing on the right. No discharge, no fever, no dizziness.</p>
            <div className="row wrap mt" style={{ gap: 6 }}>
              <Tag color="soft-blue">Ear pain</Tag>
              <Tag color="soft-blue">Ear fullness</Tag>
              <Tag color="soft-amber">Reduced hearing</Tag>
              <Tag>No discharge</Tag>
              <Tag>No fever</Tag>
            </div>
            <div className="small mt">Visit observation</div>
            <p>Right tympanic membrane retracted with a fluid level. Left ear normal. Nose: mild congestion. Throat normal.</p>
          </Card>

          <Card>
            <h2>Clinical test results</h2>
            <div className="grid-3 mt">
              {TEST_RESULTS.map((test) => (
                <div key={test.name} className="card inner">
                  <b style={{ fontSize: 12.5 }}>{test.name}</b>
                  <div className="card" style={{ textAlign: 'center', margin: '8px 0', padding: 10 }}>
                    <div className="big-number">{test.value}</div>
                    <div className="small">{test.meaning}</div>
                  </div>
                  <div className="row between center">
                    <Tag color={statusColor(test.status)}>{test.status}</Tag>
                    <span className="small">{test.reference}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card tone="sky" style={{ width: 300 }}>
          <h3>Weight and vitals</h3>
          <div className="mt">
            <BarChart values={[82, 81, 83, 82, 82]} labels={['03/24', '11/24', '06/25', '08/26', '10/26']} height={110} highlightLast />
          </div>
          <div className="grid-2 mt">
            {VITALS.map(([label, value, unit]) => (
              <div key={label} className="card" style={{ padding: 10 }}>
                <div className="small">{label}</div>
                <b style={{ fontSize: 17 }}>{value}</b> <span className="small">{unit}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
