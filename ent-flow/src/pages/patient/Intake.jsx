// =========================================================
// Intake.jsx  (wireframe W13)
// Before the visit, the patient answers history questions with
// three choices: Yes, No, Don't know. Medicines are picked from
// a list, never typed.
// =========================================================
import { useState } from 'react'
import { X } from 'lucide-react'

const TEXT = {
  en: {
    title: 'Before your visit', steps: ['Consent', 'Allergies', 'History', 'Medicines', 'Review'],
    question: 'Do you have any medical problems?', answers: ['Yes', 'No', "Don't know"],
    items: ['Recurrent ear infections', 'Ear, nose or throat surgery', 'Diabetes', 'High blood pressure', 'Asthma'],
    side: 'Which ear?', sides: ['Right', 'Left', 'Both'],
    medicines: 'Current medicines', pick: 'Pick from list', next: 'Next: medicines', saved: 'Saved automatically',
  },
  ar: {
    title: 'قبل زيارتك', steps: ['الموافقة', 'الحساسية', 'التاريخ المرضي', 'الأدوية', 'المراجعة'],
    question: 'هل لديك أي مشاكل صحية؟', answers: ['نعم', 'لا', 'لا أعرف'],
    items: ['التهابات أذن متكررة', 'جراحة سابقة في الأذن أو الأنف أو الحلق', 'السكري', 'ارتفاع ضغط الدم', 'الربو'],
    side: 'أي أذن؟', sides: ['اليمنى', 'اليسرى', 'الاثنتان'],
    medicines: 'الأدوية الحالية', pick: 'اختر من القائمة', next: 'التالي: الأدوية', saved: 'يتم الحفظ تلقائياً',
  },
}

const MEDICINE_LIST = ['Cetirizine 10 mg', 'Montelukast 10 mg', 'Saline nose drops', 'Ibuprofen 400 mg']

export default function Intake({ lang }) {
  const t = TEXT[lang]
  const currentStep = 2   // "History" is the step shown here

  // One answer per question (0 = Yes, 1 = No, 2 = Don't know)
  const [answers, setAnswers] = useState([0, 1, 1, 2, 1])
  const [earSide, setEarSide] = useState(0)
  const [medicines, setMedicines] = useState(['Cetirizine 10 mg'])

  function setAnswer(questionIndex, answerIndex) {
    const copy = [...answers]
    copy[questionIndex] = answerIndex
    setAnswers(copy)
  }

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row between center">
        <h1>{t.title}</h1>
        <span className="small">{t.saved}</span>
      </div>

      {/* Progress: blue bars for steps already reached */}
      <div className="card row" style={{ gap: 10 }}>
        {t.steps.map((step, i) => (
          <div key={step} className="grow">
            <div style={{ height: 6, borderRadius: 3, background: i <= currentStep ? '#2f74d6' : '#d6dfea' }} />
            <div style={{ fontSize: 12.5, marginTop: 6, color: i === currentStep ? '#1b2a41' : '#64748b', fontWeight: i === currentStep ? 600 : 400 }}>
              {i + 1}. {step}
            </div>
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 20, alignItems: 'flex-start' }}>
        <div className="card grow">
          <h2>{t.question}</h2>
          <div className="col mt" style={{ gap: 0 }}>
            {t.items.map((item, q) => (
              <div key={q} className="question-row">
                <div className="grow">
                  <div>{item}</div>
                  {/* Extra question only when the first item is answered "Yes" */}
                  {q === 0 && answers[0] === 0 && (
                    <div className="row center" style={{ gap: 6, marginTop: 8 }}>
                      <span className="small">{t.side}</span>
                      {t.sides.map((s, i) => (
                        <button key={i} className={'tag ' + (earSide === i ? 'blue' : '')} style={{ border: 0 }} onClick={() => setEarSide(i)}>{s}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="row" style={{ gap: 6, width: 330, flex: 'none' }}>
                  {t.answers.map((answer, a) => (
                    <button key={a} className={'choice' + (answers[q] === a ? ' on' : '')} onClick={() => setAnswer(q, a)}>
                      {answer}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card col" style={{ width: 340, flex: 'none' }}>
          <h2>{t.medicines}</h2>
          <select className="field" value="" onChange={(e) => e.target.value && setMedicines([...medicines, e.target.value])}>
            <option value="">+ {t.pick}</option>
            {MEDICINE_LIST.filter((m) => !medicines.includes(m)).map((m) => <option key={m}>{m}</option>)}
          </select>
          {medicines.map((m) => (
            <div key={m} className="list-item">
              <b className="grow" style={{ fontSize: 13 }} dir="ltr">{m}</b>
              <button className="icon-plain" onClick={() => setMedicines(medicines.filter((x) => x !== m))}><X size={15} /></button>
            </div>
          ))}
          <button className="btn full mt">{t.next}</button>
        </div>
      </div>
    </div>
  )
}
