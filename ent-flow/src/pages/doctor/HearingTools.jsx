// =========================================================
// HearingTools.jsx  (wireframe W7, "Hear what I hear")
// Audiogram with simple results, and a simulator panel.
// Note: the simulator here only shows the controls; playing
// real sound would be added later with the Web Audio API.
// =========================================================
import { useState } from 'react'
import { Play, Pause, AlertTriangle } from 'lucide-react'
import { Card, Tag, Segmented } from '../../components/ui.jsx'
import { Audiogram } from '../../components/Charts.jsx'
import { audiogram } from '../../data.js'

// Average hearing level at 500, 1k, 2k and 4k Hz
function average(values) {
  const used = values.slice(1, 5)
  return Math.round(used.reduce((a, b) => a + b, 0) / used.length)
}

// Common severity words for an average hearing level
function severity(db) {
  if (db <= 25) return 'normal'
  if (db <= 40) return 'mild'
  if (db <= 60) return 'moderate'
  return 'severe'
}

export default function HearingTools() {
  const [sound, setSound] = useState('Arabic speech')
  const [ear, setEar] = useState('Right')
  const [playing, setPlaying] = useState(null)   // 'A', 'B' or null

  const rightAvg = average(audiogram.right)
  const leftAvg = average(audiogram.left)
  const difference = Math.abs(rightAvg - leftAvg)

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col grow">
        <h1>Hear what I hear</h1>
        <p className="muted">Youssef Adel. Audiogram 18/10/2026, entered by Nurse Amira</p>

        <Card>
          <div className="row between">
            <h3>Audiogram</h3>
            <span className="small"><span style={{ color: '#d2334a' }}>O right</span>, <span style={{ color: '#2f57c7' }}>X left</span></span>
          </div>
          <Audiogram data={audiogram} width={620} height={300} />
        </Card>

        <div className="grid-3">
          <Card tone="amber"><div className="small">Right ear average</div><div className="big-number">{rightAvg} dB, {severity(rightAvg)}</div></Card>
          <Card><div className="small">Left ear average</div><div className="big-number">{leftAvg} dB, {severity(leftAvg)}</div></Card>
          {/* Flag the doctor if the two ears differ by 15 dB or more */}
          <Card tone={difference >= 15 ? 'red' : ''}>
            <div className="small">Rule check</div>
            <b>{difference >= 15 ? `Difference ${difference} dB. Doctor to review` : 'Ears are similar'}</b>
          </Card>
        </div>
      </div>

      <div className="col" style={{ width: 360 }}>
        <Card tone="blue">
          <h2>Simulator</h2>
          <div className="small mt">Sound</div>
          <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
            {['Arabic speech', 'English speech', 'Child voice', 'TV'].map((s) => (
              <button key={s} className={'btn small ' + (s === sound ? 'white' : '')} onClick={() => setSound(s)}>{s}</button>
            ))}
          </div>
          <div className="small mt">Ear</div>
          <div style={{ marginTop: 6 }}><Segmented options={['Right', 'Left', 'Both']} value={ear} onChange={setEar} /></div>

          <div className="grid-2 mt">
            {['A', 'B'].map((version) => (
              <button
                key={version}
                className="card"
                style={{ textAlign: 'center', color: '#1b2a41' }}
                onClick={() => setPlaying(playing === version ? null : version)}
              >
                <div className="small">{version}</div>
                <b>{version === 'A' ? 'Normal hearing' : 'Your hearing'}</b>
                <div style={{ marginTop: 8 }}>{playing === version ? <Pause size={22} /> : <Play size={22} />}</div>
              </button>
            ))}
          </div>
          {playing && <p className="small mt">Playing "{sound}" for the {ear.toLowerCase()} ear, version {playing}.</p>}
        </Card>

        <Card tone="amber">
          <div className="row">
            <AlertTriangle size={16} />
            <span style={{ fontSize: 12.5 }}>This lowers loudness only. Real hearing loss can also blur sounds. Volume is capped before playback.</span>
          </div>
        </Card>
        <Tag color="soft-blue">Results stored with LOINC codes</Tag>
      </div>
    </div>
  )
}
