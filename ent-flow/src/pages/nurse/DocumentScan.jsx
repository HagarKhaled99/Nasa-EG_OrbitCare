// =========================================================
// DocumentScan.jsx  (wireframe W15)
// The scanned picture on the left, the fields the system read
// from it on the right. Each field is accepted or rejected by
// a person; nothing is saved automatically.
// =========================================================
import { useState } from 'react'
import { Check, X, Sparkles } from 'lucide-react'
import { Card, Tag, Placeholder, Segmented } from '../../components/ui.jsx'

const FIELDS = [
  { name: 'Brand', value: 'Cetro 10', confidence: 92 },
  { name: 'Generic', value: 'Cetirizine', confidence: 95 },
  { name: 'Strength', value: '10 mg', confidence: 88 },
  { name: 'Form', value: 'Film-coated tablet', confidence: 95 },
  { name: 'Expiry', value: '06/2027', confidence: 71 },
]

const MATCHES = [
  ['Cetro 10 mg tablets', 'Cetirizine 10 mg, film-coated tablet', '0.96'],
  ['Cetro 5 mg / 5 ml syrup', 'Cetirizine, oral solution', '0.61'],
  ['Zyrtec 10 mg tablets', 'Cetirizine 10 mg', '0.58'],
]

export default function DocumentScan() {
  const [docType, setDocType] = useState('Medicine box')
  // One decision per field: 'accepted', 'rejected' or undefined (not decided)
  const [decisions, setDecisions] = useState({})
  const [match, setMatch] = useState(0)

  function decide(fieldName, decision) {
    setDecisions({ ...decisions, [fieldName]: decision })
  }

  function acceptAll() {
    const all = {}
    FIELDS.forEach((f) => { all[f.name] = 'accepted' })
    setDecisions(all)
  }

  return (
    <div className="col">
      <div className="row between center">
        <div>
          <h1>Document scan review</h1>
          <p className="muted">Medicine box for Youssef Adel. Scanned by Nurse Amira, 09:01</p>
        </div>
        <Segmented options={['Medicine box', 'Prescription', 'Referral letter', 'Lab report', 'Insurance card']} value={docType} onChange={setDocType} />
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Card style={{ flex: 1 }}>
          <Placeholder height={460} />
          <p className="small mt">The scanned picture appears here with boxes around the text that was read.</p>
        </Card>

        <div className="col" style={{ width: 540 }}>
          <div className="row between center">
            <h2>Extracted fields</h2>
            <Tag color="ai"><Sparkles size={11} /> Suggestion, needs your check</Tag>
          </div>

          {FIELDS.map((field) => {
            const decision = decisions[field.name]
            const low = field.confidence < 80
            return (
              <Card key={field.name} style={{ padding: 10, borderColor: low ? '#f59e0b' : undefined }}>
                <div className="row center">
                  <span className="small" style={{ width: 64 }}>{field.name}</span>
                  <input className="field grow" defaultValue={field.value} />
                  <div style={{ width: 90 }}>
                    <div className="small">{field.confidence}% sure</div>
                    <div className="bar"><div style={{ width: field.confidence + '%', background: low ? '#f59e0b' : '#2f74d6' }} /></div>
                  </div>
                  <button className={'btn small ' + (decision === 'accepted' ? '' : 'outline')} onClick={() => decide(field.name, 'accepted')}><Check size={13} /></button>
                  <button className={'btn small ' + (decision === 'rejected' ? '' : 'outline')} onClick={() => decide(field.name, 'rejected')}><X size={13} /></button>
                </div>
              </Card>
            )
          })}

          <Card>
            <h3>Drug catalog match</h3>
            <div className="col mt" style={{ gap: 6 }}>
              {MATCHES.map(([name, detail, score], index) => (
                <button key={name} className={'list-item' + (index === match ? ' selected' : '')} onClick={() => setMatch(index)}>
                  <div className="grow"><b style={{ fontSize: 12.5 }}>{name}</b><div className="small">{detail}</div></div>
                  <b>{score}</b>
                </button>
              ))}
            </div>
          </Card>

          <div className="row center">
            <span className="small grow">Saved as "assistant-entered, source: scan" with the original picture. The doctor confirms it in the patient record.</span>
            <button className="btn" onClick={acceptAll}>Accept all</button>
          </div>
        </div>
      </div>
    </div>
  )
}
