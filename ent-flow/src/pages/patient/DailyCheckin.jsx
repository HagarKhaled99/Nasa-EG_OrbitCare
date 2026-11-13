// =========================================================
// DailyCheckin.jsx  (wireframe W8)
// Short daily questions after surgery. After "Send", a simple
// rule decides the result: fresh blood or "cannot drink" = red.
// (In the real system these rules come from the doctor and run
// on the server.)
// =========================================================
import { useState } from 'react'
import { AlertTriangle, Phone } from 'lucide-react'

const TEXT = {
  en: {
    day: 'Day 6 of 14', title: 'Daily check-in', sub: 'After tonsillectomy. About 1 minute.',
    pain: 'Pain today', bleeding: 'Any bleeding?', bleedOptions: ['None', 'Streaks', 'Fresh blood'],
    fluids: 'Can you drink fluids?', fluidOptions: ['Yes', 'With difficulty', 'Cannot'],
    temp: 'Temperature (°C)', note: 'Anything else? Type here', send: 'Send check-in',
    red: 'Call the clinic now', redSub: 'Dr. Mohammed has been alerted', green: 'Thank you. Your answers are within normal recovery.',
    emergency: 'Emergency: go to the nearest emergency department or call 123',
    progress: 'Your recovery', progressSub: '6 of 14 days done', waiting: 'Send your answers to see the result here.',
  },
  ar: {
    day: 'اليوم 6 من 14', title: 'المتابعة اليومية', sub: 'بعد استئصال اللوزتين. دقيقة واحدة تقريباً.',
    pain: 'مستوى الألم اليوم', bleeding: 'هل يوجد نزيف؟', bleedOptions: ['لا يوجد', 'خيوط دم', 'دم أحمر جديد'],
    fluids: 'هل يستطيع شرب السوائل؟', fluidOptions: ['نعم', 'بصعوبة', 'لا يستطيع'],
    temp: 'درجة الحرارة', note: 'أي شيء آخر؟ اكتب هنا', send: 'إرسال المتابعة',
    red: 'اتصل بالعيادة الآن', redSub: 'تم تنبيه د. محمد', green: 'شكراً. إجاباتك ضمن التعافي الطبيعي.',
    emergency: 'في حالة الطوارئ توجّه لأقرب قسم طوارئ أو اتصل بالإسعاف 123',
    progress: 'تعافيك', progressSub: 'اكتمل 6 من 14 يوماً', waiting: 'أرسل إجاباتك لترى النتيجة هنا.',
  },
}

export default function DailyCheckin({ lang }) {
  const t = TEXT[lang]

  // Answers are stored as numbers (position in the option list),
  // so they stay the same when the language changes.
  const [pain, setPain] = useState(5)
  const [bleeding, setBleeding] = useState(0)
  const [fluids, setFluids] = useState(1)
  const [temperature, setTemperature] = useState('37.8')
  const [result, setResult] = useState(null)   // null until "Send" is pressed

  function send() {
    const isRed = bleeding === 2 || fluids === 2 || Number(temperature) >= 38.5
    setResult(isRed ? 'red' : 'green')
  }

  return (
    <div className="row" style={{ gap: 20, alignItems: 'flex-start' }}>
      <div className="card col grow" style={{ maxWidth: 720, gap: 14 }}>
        <span className="tag blue" style={{ alignSelf: 'flex-start' }}>{t.day}</span>
        <div>
          <h1>{t.title}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{t.sub}</p>
        </div>

        <b>{t.pain}</b>
        <div className="row" style={{ gap: 6 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button key={n} className={'choice' + (n === pain ? ' on' : '')} onClick={() => setPain(n)}>{n}</button>
          ))}
        </div>

        <b>{t.bleeding}</b>
        <div className="row" style={{ gap: 8 }}>
          {t.bleedOptions.map((option, i) => (
            <button key={i} className={'choice' + (i === bleeding ? ' on' : '')} onClick={() => setBleeding(i)}>{option}</button>
          ))}
        </div>

        <b>{t.fluids}</b>
        <div className="row" style={{ gap: 8 }}>
          {t.fluidOptions.map((option, i) => (
            <button key={i} className={'choice' + (i === fluids ? ' on' : '')} onClick={() => setFluids(i)}>{option}</button>
          ))}
        </div>

        <div className="grid-2">
          <div>
            <label className="label">{t.temp}</label>
            <input className="field" value={temperature} onChange={(e) => setTemperature(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label className="label">&nbsp;</label>
            <textarea className="field" rows={1} placeholder={t.note} />
          </div>
        </div>

        <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={send}>{t.send}</button>
      </div>

      <div className="col" style={{ width: 340, flex: 'none' }}>
        <div className="card">
          <h3>{t.progress}</h3>
          <div className="bar mt"><div style={{ width: (6 / 14) * 100 + '%' }} /></div>
          <div className="small mt">{t.progressSub}</div>
        </div>

        {result === null && <div className="card inner muted">{t.waiting}</div>}
        {result === 'red' && (
          <div className="card red row center">
            <Phone size={20} />
            <div><b>{t.red}</b><div className="small">{t.redSub}</div></div>
          </div>
        )}
        {result === 'green' && <div className="card green">{t.green}</div>}

        <div className="emergency"><AlertTriangle size={16} /> {t.emergency}</div>
      </div>
    </div>
  )
}
