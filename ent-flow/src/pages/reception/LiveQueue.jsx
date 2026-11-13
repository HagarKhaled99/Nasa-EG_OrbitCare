// =========================================================
// LiveQueue.jsx  (wireframe W1)
// Today's patients for the receptionist. The tabs filter the
// table, which is a good example of "derived data": we never
// store the filtered list, we compute it from the full list.
// =========================================================
import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { Card, Tag, Segmented, statusColor } from '../../components/ui.jsx'
import { queue } from '../../data.js'

// One rule per tab: given a row, should it be shown?
const FILTERS = {
  All: () => true,
  Waiting: (row) => row.status === 'Waiting' || row.status === 'Checked in',
  Urgent: (row) => row.flag === 'Urgent',
  'Intake missing': (row) => row.intake !== 'Complete',
}

export default function LiveQueue() {
  const [tab, setTab] = useState('All')
  const [checkedIn, setCheckedIn] = useState([])   // names checked in on this screen

  const rows = queue.filter(FILTERS[tab])

  const waiting = queue.filter((r) => r.status === 'Waiting').length
  const inVisit = queue.filter((r) => r.status === 'In visit').length
  const intakeDone = queue.filter((r) => r.intake === 'Complete').length

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="col grow">
        <h1>Live queue</h1>
        <p className="muted">Sunday 18 October. Dr. Mohammed, rooms 1 and 2.</p>

        <div className="grid-3">
          <Card tone="amber"><div className="small">Waiting now</div><div className="big-number">{waiting}</div></Card>
          <Card tone="sky"><div className="small">In visit</div><div className="big-number">{inVisit}</div></Card>
          <Card tone="green"><div className="small">Intake complete</div><div className="big-number">{intakeDone} of {queue.length}</div></Card>
        </div>

        <Card>
          <Segmented options={Object.keys(FILTERS)} value={tab} onChange={setTab} />
          <table className="table mt">
            <thead>
              <tr><th>Time</th><th>Patient</th><th>Reason</th><th>Status</th><th>Room</th><th>Intake</th><th>Wait</th><th>Flags</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isCheckedIn = checkedIn.includes(row.name)
                return (
                  <tr key={row.name}>
                    <td><b>{row.time}</b></td>
                    <td><b>{row.name}</b></td>
                    <td>{row.reason}</td>
                    <td><Tag color={statusColor(isCheckedIn ? 'Checked in' : row.status)}>{isCheckedIn ? 'Checked in' : row.status}</Tag></td>
                    <td>{row.room || <span className="small">on check-in</span>}</td>
                    <td><Tag color={statusColor(row.intake)}>{row.intake}</Tag></td>
                    <td>{row.wait || '-'}</td>
                    <td>{row.flag && <Tag color={row.flag === 'Urgent' ? 'red' : ''}>{row.flag}</Tag>}</td>
                    <td>
                      {row.status === 'Booked' && !isCheckedIn && (
                        <button className="btn small" onClick={() => setCheckedIn([...checkedIn, row.name])}>Check in</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="col" style={{ width: 320 }}>
        <Card tone="blue">
          <h3>Check in</h3>
          <div className="search mt" style={{ border: 0 }}>
            <Search size={15} color="#64748b" />
            <input placeholder="Name, phone or national ID" />
          </div>
          <button className="btn white full mt">Check in patient</button>
        </Card>

        <Card tone="red">
          <div className="row between center"><h3>Urgent request</h3><Tag color="red">Fast-track</Tag></div>
          <p style={{ fontSize: 12.5, margin: '8px 0' }}>Phone call: sudden hearing loss in left ear since yesterday.</p>
          <div className="list-item"><span className="grow">Reserved urgent slot</span><b>12:10</b></div>
          <button className="btn full mt">Book and alert doctor</button>
        </Card>

        <Card>
          <div className="row between center"><h3>Ready for billing</h3><Tag color="blue">1</Tag></div>
          <div className="list-item mt">
            <div className="grow"><b>Ahmed Ezz</b><div className="small">Ear wash, consultation</div></div>
            <button className="btn small">Bill</button>
          </div>
        </Card>

        <button className="btn"><Plus size={14} /> New booking</button>
      </div>
    </div>
  )
}
