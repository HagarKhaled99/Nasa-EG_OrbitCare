// =========================================================
// Consultation.jsx  (wireframe W2)
// Visit header on top, then three tabs:
//   Examination      choose ear, nose or throat, annotate the
//                    pictures and add findings with comments
//   Conversation     transcript and the structured note
//   Decision support AI suggestions and safety checks
// =========================================================
import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Activity, Calendar } from 'lucide-react'
import { Card, Tag, Avatar } from '../../components/ui.jsx'
import ExamWorkspace from '../../components/ExamWorkspace.jsx'
import { useAlerts } from '../../components/Alerts.jsx'
import { currentPatient } from '../../data.js'

const TABS = ['Examination', 'Conversation & note', 'Decision support']

// Which note field each exam area writes into
const NOTE_FIELD_FOR_REGION = { ear: 'Ear exam', nose: 'Nose, throat', throat: 'Nose, throat' }

const DIAGNOSIS_CANDIDATES = [
  { name: 'Otitis media with effusion', chance: 72 },
  { name: 'Acute otitis media', chance: 18 },
  { name: 'Eustachian tube dysfunction', chance: 10 },
]

export default function Consultation() {
  const [tab, setTab] = useState(TABS[0])
  const { raise } = useAlerts()

  // The allergy pops up in red as soon as the consultation opens
  useEffect(() => {
    raise({ id: 'allergy-' + currentPatient.id, title: 'Allergy: penicillin', text: `${currentPatient.name} reacts to penicillin (rash, moderate). Avoid amoxicillin and co-amoxiclav.` })
  }, [])

  // The note is one object. Each field can be edited.
  const [note, setNote] = useState({
    Complaint: 'Right ear pain, 3 days. Reduced hearing.',
    History: 'No discharge. No fever. Otitis externa right 08/2026.',
    'Ear exam': 'Right TM retracted with fluid level. Left TM normal.',
    'Nose, throat': '',
    Assessment: 'Otitis media with effusion, right',
    Plan: 'Audiogram today. Review in 2 weeks.',
  })
  const [saved, setSaved] = useState(false)
  const [acceptedDiagnosis, setAcceptedDiagnosis] = useState(null)

  // Called when the doctor types in a note field.
  // We copy the old note (...note) and replace only the changed field.
  function updateField(fieldName, newText) {
    setNote({ ...note, [fieldName]: newText })
    setSaved(false)
  }

  // A finding added in the Examination tab is also written into the note
  function addExamFinding(regionId, text) {
    const field = NOTE_FIELD_FOR_REGION[regionId]
    setNote((old) => ({ ...old, [field]: old[field] ? old[field] + '\n' + text : text }))
    setSaved(false)
  }

  return (
    <div className="col" style={{ gap: 0 }}>
      {/* Visit header */}
      <div className="visit-header">
        <Avatar name={currentPatient.name} />
        <div>
          <div className="row center" style={{ gap: 10 }}>
            <span style={{ fontSize: 19, fontWeight: 600 }}>{currentPatient.name}</span>
            <Tag color="soft-blue">{currentPatient.room}</Tag>
            <Tag color="red"><AlertTriangle size={12} /> Allergy: penicillin</Tag>
          </div>
          <div className="small" style={{ marginTop: 3 }}>
            ID {currentPatient.id} &nbsp;|&nbsp; {currentPatient.age} years &nbsp;|&nbsp; {currentPatient.sex} &nbsp;|&nbsp; {currentPatient.complaint}
          </div>
        </div>
        <div className="grow" />
        <div className="visit-date">
          <Calendar size={18} color="#64748b" />
          <div>
            <div className="small">Visit date</div>
            <b>18 Oct 2026, {currentPatient.visitTime}</b>
          </div>
        </div>
        <button className="btn outline" onClick={() => setSaved(true)}>Save draft</button>
        <button className="btn" onClick={() => setSaved(true)}>{saved ? 'Saved' : 'Save'}</button>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* Tabs are hidden, not removed, so marks and typing are kept when switching */}
      <div style={{ display: tab === 'Examination' ? 'block' : 'none' }}>
        <ExamWorkspace onRecord={addExamFinding} />
      </div>

      <div className="row" style={{ alignItems: 'flex-start', display: tab === 'Conversation & note' ? 'flex' : 'none' }}>
        {/* Conversation and note */}
        <div className="col" style={{ width: 380 }}>
          <Card>
            <div className="small" style={{ textAlign: 'right' }}>Arabic and English</div>
            <p style={{ fontSize: 13, marginTop: 6 }}><b>Doctor</b> Any discharge from the ear?</p>
            <p dir="rtl" style={{ fontSize: 13 }}><b>المريض</b> لا مفيش إفرازات، بس الوجع في الودن اليمين من 3 أيام</p>
            <p style={{ fontSize: 13 }}><b>Doctor</b> The right tympanic membrane is retracted with a fluid level.</p>
          </Card>
        </div>

        <div className="col grow">
          <Card>
            <h3>Structured note</h3>
            <div className="col mt" style={{ gap: 8 }}>
              {/* Object.keys gives the list of field names in the note */}
              {Object.keys(note).map((field) => (
                <div key={field}>
                  <label className="label">{field}</label>
                  <textarea
                    className="field"
                    rows={field.includes('exam') || field === 'Nose, throat' ? 3 : 2}
                    value={note[field]}
                    placeholder="Not examined yet"
                    onChange={(e) => updateField(field, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <button className="btn full mt" onClick={() => setSaved(true)}>
              {saved ? 'Note saved' : 'Save note'}
            </button>
          </Card>
        </div>
      </div>

      <div className="row" style={{ alignItems: 'flex-start', display: tab === 'Decision support' ? 'flex' : 'none' }}>
        {/* Decision support */}
        <div className="col grow" style={{ maxWidth: 520 }}>
          <Card tone="blue">
            <div className="row between center">
              <h3>AI decision support</h3>
              <Tag>Suggests only</Tag>
            </div>
            <div className="small mt">Diagnosis candidates (ICD-11)</div>
            {DIAGNOSIS_CANDIDATES.map((d) => (
              <div key={d.name} className="row center" style={{ margin: '8px 0', fontSize: 12.5 }}>
                <span className="grow">{d.name}</span>
                <span>{d.chance}%</span>
                <button className="btn white small" onClick={() => setAcceptedDiagnosis(d.name)}>
                  {acceptedDiagnosis === d.name ? <Check size={13} /> : 'Accept'}
                </button>
              </div>
            ))}
          </Card>

          <Card tone="red">
            <div className="row center"><AlertTriangle size={18} /><h3>Penicillin allergy: avoid amoxicillin and co-amoxiclav</h3></div>
          </Card>

          <Card tone="amber">
            <h3>Checks</h3>
            <div className="col mt" style={{ gap: 6, fontSize: 12.5 }}>
              <div className="row"><Check size={14} /> No red-flag findings mentioned</div>
              <div className="row"><Activity size={14} /> No audiogram this year. Order one?</div>
            </div>
          </Card>

          <Card tone="sky">
            <h3>Guideline hint</h3>
            <p style={{ fontSize: 12.5, marginTop: 6 }}>Adult OME, one side: consider watchful waiting and audiometry.</p>
            <div className="small mt">Source: AAO-HNS OME guideline summary</div>
          </Card>
        </div>
      </div>
    </div>
  )
}
