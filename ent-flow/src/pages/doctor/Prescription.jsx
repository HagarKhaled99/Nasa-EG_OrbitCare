// =========================================================
// Prescription.jsx  (wireframe W12)
// Build a prescription from the drug catalog. The safety
// checks on the right update by themselves whenever a line
// changes. This is the main idea of React: change the data,
// and the screen follows.
// =========================================================
import { useState } from 'react'
import { Pill, X, Check, AlertTriangle } from 'lucide-react'
import { Card, Tag, Segmented } from '../../components/ui.jsx'
import { drugCatalog } from '../../data.js'

const FREQUENCIES = ['Every 6 hours', 'Every 8 hours', '3 times daily', 'Twice daily', 'At night']
const DURATIONS = ['3 days', '5 days', '7 days', '10 days']

export default function Prescription() {
  // Each line is one medicine. "dose" starts empty for the new line.
  const [lines, setLines] = useState([
    { drug: 'Ibuprofen suspension 100 mg / 5 ml', dose: '7.5 ml', frequency: 'Every 8 hours', duration: '5 days' },
    { drug: 'Paracetamol suspension 120 mg / 5 ml', dose: '9 ml', frequency: 'Every 6 hours', duration: '5 days' },
    { drug: 'Amoxicillin suspension 250 mg / 5 ml', dose: '', frequency: 'Twice daily', duration: '7 days' },
  ])
  const [saved, setSaved] = useState(false)
  const [medStatus, setMedStatus] = useState({ 'Montelukast 5 mg': 'Continue', 'Saline nose drops': 'Stopped' })

  // Change one value (dose, frequency or duration) in one line
  function updateLine(index, key, value) {
    const copy = [...lines]                  // copy the list
    copy[index] = { ...copy[index], [key]: value }   // copy and change one line
    setLines(copy)
    setSaved(false)
  }

  function removeLine(index) {
    setLines(lines.filter((_, i) => i !== index))
  }

  function addLine(drug) {
    if (!drug) return
    setLines([...lines, { drug, dose: '', frequency: 'Twice daily', duration: '5 days' }])
  }

  // ---- Safety checks, recalculated on every redraw ----
  const missingDose = lines.filter((l) => l.dose === '')
  const drugNames = lines.map((l) => l.drug)
  const hasDuplicate = drugNames.some((name, i) => drugNames.indexOf(name) !== i)
  const blocking = missingDose.length > 0 || hasDuplicate

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {/* Left: patient, history, current medicines */}
      <div className="col" style={{ width: 290 }}>
        <Card tone="sky">
          <div style={{ fontSize: 18, fontWeight: 600 }}>Mariam Hassan</div>
          <div className="small">Female, 7 y. Post-tonsillectomy</div>
          <label className="label mt">Weight (required for children)</label>
          <input className="field" defaultValue="22 kg" />
          <div className="mt"><Tag color="green">No known drug allergies</Tag></div>
        </Card>

        <Card>
          <h3>Medical history</h3>
          {[['Recurrent tonsillitis', 'Yes'], ['Asthma', 'No'], ['Bleeding disorder', 'No'], ['Kidney disease', 'Unknown']].map(([item, answer]) => (
            <div key={item} className="row between" style={{ padding: '5px 0', fontSize: 12.5 }}>
              <span>{item}</span><Tag color={answer === 'Yes' ? 'soft-blue' : answer === 'Unknown' ? 'soft-amber' : ''}>{answer}</Tag>
            </div>
          ))}
        </Card>

        <Card>
          <h3 style={{ marginBottom: 8 }}>Current medications</h3>
          {Object.keys(medStatus).map((med) => (
            <div key={med} className="col" style={{ gap: 4, marginBottom: 10 }}>
              <b style={{ fontSize: 12.5 }}>{med}</b>
              <Segmented
                options={['Continue', 'Changed', 'Stopped']}
                value={medStatus[med]}
                onChange={(value) => setMedStatus({ ...medStatus, [med]: value })}
              />
            </div>
          ))}
        </Card>
      </div>

      {/* Middle: the prescription lines */}
      <div className="col grow">
        <h1>Prescription</h1>
        <p className="muted">Built from the drug catalog. Nothing typed free.</p>

        <select className="field" value="" onChange={(e) => addLine(e.target.value)}>
          <option value="">+ Add medicine from the catalog</option>
          {Object.keys(drugCatalog).map((drug) => <option key={drug} value={drug}>{drug}</option>)}
        </select>

        {lines.map((line, index) => (
          <Card key={index} style={{ borderColor: line.dose === '' ? '#e5484d' : undefined }}>
            <div className="row center">
              <Pill size={16} color="#2f74d6" />
              <b className="grow">{line.drug}</b>
              {line.dose === '' && <Tag color="red">Select a dose</Tag>}
              <button className="nav-item" style={{ width: 'auto' }} onClick={() => removeLine(index)}><X size={15} /></button>
            </div>
            <div className="grid-3 mt">
              <select className="field" value={line.dose} onChange={(e) => updateLine(index, 'dose', e.target.value)}>
                <option value="">Dose</option>
                {drugCatalog[line.drug].map((d) => <option key={d}>{d}</option>)}
              </select>
              <select className="field" value={line.frequency} onChange={(e) => updateLine(index, 'frequency', e.target.value)}>
                {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
              </select>
              <select className="field" value={line.duration} onChange={(e) => updateLine(index, 'duration', e.target.value)}>
                {DURATIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </Card>
        ))}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn outline">Preview PDF</button>
          {/* The button is disabled while a blocking check fails */}
          <button className="btn" disabled={blocking} onClick={() => setSaved(true)}>
            {saved ? 'Saved' : 'Save prescription'}
          </button>
        </div>
      </div>

      {/* Right: safety checks */}
      <div className="col" style={{ width: 290 }}>
        <Card tone="blue">
          <div className="row between center">
            <h3>Safety checks</h3>
            {blocking ? <Tag color="red">Blocking</Tag> : <Tag color="green">All clear</Tag>}
          </div>
          <CheckRow ok label="Allergies" detail="None confirmed" />
          <CheckRow ok={!hasDuplicate} label="Duplicates" detail={hasDuplicate ? 'Same drug added twice' : 'No same drug or class'} />
          <CheckRow ok label="Interactions" detail="None found" />
          <CheckRow ok={missingDose.length === 0} label="Child dose" detail={missingDose.length ? `${missingDose.length} line(s) without a dose` : 'All doses fit 22 kg'} />
        </Card>
        <Card>
          <h3>Patient instructions</h3>
          <div className="row wrap mt" style={{ gap: 6 }}>
            <Tag>Cold soft food</Tag><Tag>Drink often</Tag><Tag>Bleeding: come in</Tag>
          </div>
        </Card>
      </div>
    </div>
  )
}

// One line in the safety panel: a check mark or a warning sign
function CheckRow({ ok, label, detail }) {
  return (
    <div className="row" style={{ padding: '9px 0', borderBottom: '1px solid #5a8bea', fontSize: 12.5 }}>
      {ok ? <Check size={15} /> : <AlertTriangle size={15} color="#ffd1d1" />}
      <div>
        {label}
        <div className="small">{detail}</div>
      </div>
    </div>
  )
}
