// =========================================================
// Schedule.jsx  (wireframe D2)
// Day and week views. Each appointment shows only the
// patient name and the time.
// =========================================================
import { useState } from 'react'
import { Segmented } from '../../components/ui.jsx'
import { week } from '../../data.js'

export default function Schedule() {
  // Which view is open: 'Day' or 'Week'
  const [view, setView] = useState('Week')

  // In Day view we only keep today; in Week view we keep all days.
  // .filter() returns a new list with only the items that pass the test.
  const daysToShow = view === 'Day' ? week.filter((d) => d.today) : week

  return (
    <div className="col">
      <div className="row between center">
        <h1>Stay up to date, Dr. Mohammed</h1>
        <button className="btn">+ Add appointment</button>
      </div>

      <div className="row between center">
        <span className="muted">Saturday 17/10 to Friday 23/10</span>
        <Segmented options={['Day', 'Week']} value={view} onChange={setView} />
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        {daysToShow.map((day) => (
          <div key={day.day} className="col grow" style={{ gap: 8 }}>
            <div className={'day-head' + (day.today ? ' today' : '')}>
              <div style={{ fontSize: 11 }}>{day.day}</div>
              <b>{day.date}</b>
            </div>

            {day.closed && <div className="small" style={{ textAlign: 'center', padding: 20 }}>Clinic closed</div>}

            {day.slots.map(([time, name], index) => (
              <div key={time} className={'slot' + (day.today && index === 0 ? ' current' : '')}>
                <b style={{ fontSize: 13 }}>{name}</b>
                <div className="small">{time}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
