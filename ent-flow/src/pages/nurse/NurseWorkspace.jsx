// =========================================================
// NurseWorkspace.jsx  (wireframe W5, merged with W4)
// Endoscopy pictures, the live room request, the turnover
// checklist, today's tasks and scanned documents.
// =========================================================
import { useState } from 'react'
import { Check, Plus, Send, Box, ArrowRight } from 'lucide-react'
import { Card, Tag, Placeholder, Segmented } from '../../components/ui.jsx'

const PICTURES = ['Right TM', 'Right TM', 'Ear canal', 'Fluid level', 'Right TM', 'Untagged']
const TRAY = ['Ear irrigation syringe', 'Warm saline 500 ml', 'Kidney dish and towel', 'Otoscope with speculum']
const TASKS = ['Upload endoscopy pictures, Youssef Adel', 'Vitals, Salma Ibrahim', 'Audiogram, Salma Ibrahim', 'Scan medicine box, Mariam Hassan', 'Help with intake, Omar Khaled']
const SCANS = [['Medicine box', 'Youssef Adel, 09:01', 'Review'], ['Referral letter', 'Omar Khaled, 08:45', 'Done'], ['Insurance card', 'Laila Mostafa, 08:30', 'Done']]

export default function NurseWorkspace({ onNavigate }) {
  // Pictures the nurse has selected (stored by their position number)
  const [selectedPictures, setSelectedPictures] = useState([0, 3])
  const [exam, setExam] = useState('Otoscopy')
  const [side, setSide] = useState('Right')
  const [onMyWay, setOnMyWay] = useState(false)

  // Turnover checklist: true = done
  const [checklist, setChecklist] = useState({
    'Change couch paper': true,
    'Wipe surfaces and headlight': true,
    'Empty sharps if over 3/4': false,
    'Restock ear specula': false,
    'Scope cleaned or swapped': false,
  })
  const allDone = Object.values(checklist).every((done) => done)

  // Add the picture if it is not selected, remove it if it is
  function togglePicture(index) {
    if (selectedPictures.includes(index)) {
      setSelectedPictures(selectedPictures.filter((i) => i !== index))
    } else {
      setSelectedPictures([...selectedPictures, index])
    }
  }

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col grow">
        <h1>Good morning, Nurse Amira</h1>
        <p className="muted">5 tasks today. 1 room request waiting.</p>

        <Card>
          <div className="row between center">
            <h2>Endoscopy pictures</h2>
            <button className="btn small outline"><Plus size={13} /> Add pictures</button>
          </div>

          <div className="row mt">
            <Card tone="amber" style={{ flex: 1 }}>
              <div className="row center">
                <Placeholder width={40} height={40} />
                <div className="grow"><b>Youssef Adel</b><div className="small">DOB 12/03/1992. Room 2. Visit 09:00</div></div>
                <Tag color="blue"><Check size={11} /> Name and DOB confirmed</Tag>
              </div>
            </Card>
            <div className="col" style={{ gap: 6 }}>
              <Segmented options={['Otoscopy', 'Nasal endoscopy', 'Laryngoscopy']} value={exam} onChange={setExam} />
              <Segmented options={['Right', 'Left', 'Both']} value={side} onChange={setSide} />
            </div>
          </div>

          <p className="small mt">Pictures only (JPG or PNG). Originals are kept untouched. Click a picture to select it.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginTop: 8 }}>
            {PICTURES.map((tag, index) => (
              <button
                key={index}
                className={'list-item' + (selectedPictures.includes(index) ? ' selected' : '')}
                style={{ flexDirection: 'column', alignItems: 'stretch', padding: 7 }}
                onClick={() => togglePicture(index)}
              >
                <Placeholder height={66} />
                <div className="row between center" style={{ marginTop: 5 }}>
                  <Tag color={tag === 'Untagged' ? '' : 'soft-blue'}>{tag}</Tag>
                  {selectedPictures.includes(index) && <Check size={13} />}
                </div>
              </button>
            ))}
          </div>
          <div className="row mt" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" disabled={selectedPictures.length === 0}>
              <Send size={13} /> Send {selectedPictures.length} selected to Dr. Mohammed
            </button>
          </div>
        </Card>

        <div className="row">
          <Card tone="sky" style={{ flex: 1 }}>
            <div className="row between center"><h2>New request, Room 2</h2><Tag color="blue">just now</Tag></div>
            <p style={{ margin: '8px 0' }}>Dr. Mohammed requested: <b>ear wash, right</b></p>
            {TRAY.map((item) => (
              <div key={item} className="list-item" style={{ marginBottom: 5 }}><Box size={14} /> {item}</div>
            ))}
            <div className="row mt">
              <button className="btn grow" onClick={() => setOnMyWay(true)}>{onMyWay ? 'On the way' : 'On my way'}</button>
              <button className="btn outline">Report missing item</button>
            </div>
          </Card>

          <Card style={{ flex: 1 }}>
            <div className="row between center"><h2>Turnover, Procedure room</h2><Tag color="soft-amber">6:12</Tag></div>
            {Object.keys(checklist).map((step) => (
              <label key={step} className="row center" style={{ padding: '8px 0', borderBottom: '1px solid #e5ebf3' }}>
                <input
                  type="checkbox"
                  checked={checklist[step]}
                  onChange={(e) => setChecklist({ ...checklist, [step]: e.target.checked })}
                />
                {step}
              </label>
            ))}
            {/* Only possible once every step is ticked */}
            <button className="btn full mt" disabled={!allDone}>Mark room ready</button>
          </Card>
        </div>
      </div>

      <div className="col" style={{ width: 320 }}>
        <h2>Today's tasks</h2>
        {TASKS.map((task, index) => (
          <div key={task} className={'list-item' + (index === 0 ? ' selected' : '')}>
            <span className="grow" style={{ fontSize: 12.5 }}>{task}</span>
            <ArrowRight size={14} />
          </div>
        ))}

        <Card>
          <h3>Scanned documents</h3>
          <p className="small" style={{ margin: '6px 0 10px' }}>Medicine box, outside prescription, referral letter, insurance card</p>
          <div className="col" style={{ gap: 6 }}>
            {SCANS.map(([type, who, status]) => (
              <button key={type} className="list-item" onClick={() => onNavigate('scan')}>
                <Placeholder width={36} height={36} />
                <div className="grow"><b style={{ fontSize: 12.5 }}>{type}</b><div className="small">{who}</div></div>
                <Tag color={status === 'Done' ? 'green' : 'soft-amber'}>{status}</Tag>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
