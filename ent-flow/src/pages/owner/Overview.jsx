// =========================================================
// Overview.jsx  (wireframe W11)
// Clinic owner: visits, revenue trend and stock alerts.
// =========================================================
import { Card, Tag, statusColor } from '../../components/ui.jsx'
import { BarChart } from '../../components/Charts.jsx'
import { revenueByMonth, stockAlerts } from '../../data.js'

export default function Overview() {
  return (
    <div className="col">
      <h1>Clinic overview</h1>
      <p className="muted">October 2026, month to date</p>

      <div className="grid-2">
        <Card tone="amber"><div className="small">Visits this month</div><div className="big-number">412 <Tag>+8 %</Tag></div></Card>
        <Card tone="sky"><div className="small">Revenue</div><div className="big-number">EGP 186k <Tag>+11 %</Tag></div></Card>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Card style={{ flex: 1 }}>
          <h3>Revenue, EGP thousands</h3>
          <div className="mt">
            <BarChart values={revenueByMonth.values} labels={revenueByMonth.labels} height={360} highlightLast />
          </div>
        </Card>

        <Card style={{ width: 380 }}>
          <h3 style={{ marginBottom: 10 }}>Stock alerts</h3>
          <div className="col" style={{ gap: 8 }}>
            {stockAlerts.map((s) => (
              <div key={s.item} className="list-item">
                <div className="grow"><b style={{ fontSize: 13 }}>{s.item}</b><div className="small">{s.detail}</div></div>
                <Tag color={statusColor(s.level)}>{s.level}</Tag>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
