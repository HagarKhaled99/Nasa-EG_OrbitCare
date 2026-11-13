// =========================================================
// Charts.jsx
// Very small charts drawn by hand, so there is no chart library
// to learn. Each one only needs a list of numbers.
// =========================================================

// Bar chart made from plain <div>s.
// Each bar's height is a percentage of the largest value.
export function BarChart({ values, labels, height = 140, highlightLast = false }) {
  const largest = Math.max(...values)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height }}>
      {values.map((value, index) => {
        const isLast = index === values.length - 1
        // When highlightLast is on, earlier bars are drawn lighter
        const color = highlightLast && !isLast ? '#d7e6ff' : '#2f74d6'
        return (
          <div key={index} style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                height: (value / largest) * (height - 20),
                background: color,
                borderRadius: 6,
              }}
            />
            <div className="small" style={{ marginTop: 4 }}>{labels[index]}</div>
          </div>
        )
      })}
    </div>
  )
}

// Ring chart using a CSS "conic-gradient": the circle is painted
// in slices whose sizes match the parts.
// parts example: [{ value: 2, color: 'red' }, { value: 5, color: 'orange' }]
// "hole" is the color of the middle, so the ring also works on colored cards
export function DonutChart({ parts, size = 110, centerText, hole = '#fff' }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0)

  // Build the slice list, for example "red 0% 5%, orange 5% 18%, ..."
  let start = 0
  const slices = parts.map((part) => {
    const end = start + (part.value / total) * 100
    const slice = `${part.color} ${start}% ${end}%`
    start = end
    return slice
  })

  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: `conic-gradient(${slices.join(', ')})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
      }}
    >
      {/* A white circle on top turns the pie into a ring */}
      <div
        style={{
          width: size - 32, height: size - 32, borderRadius: '50%', background: hole,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20,
        }}
      >
        {centerText}
      </div>
    </div>
  )
}

// Audiogram: hearing level per frequency for both ears.
// Standard style: right ear = red circles, left ear = blue crosses.
// Lower on the chart means worse hearing.
export function Audiogram({ data, width = 520, height = 260 }) {
  const left = 40   // space for the dB labels
  const top = 10
  const chartWidth = width - left - 10
  const chartHeight = height - top - 30

  // Turn a position (frequency index, dB value) into x / y pixels
  const x = (index) => left + (index * chartWidth) / (data.frequencies.length - 1)
  const y = (db) => top + (db / 100) * chartHeight

  const toPoints = (values) => values.map((db, i) => `${x(i)},${y(db)}`).join(' ')

  return (
    <svg width={width} height={height}>
      {/* Horizontal grid lines every 20 dB */}
      {[0, 20, 40, 60, 80, 100].map((db) => (
        <g key={db}>
          <line x1={left} x2={width - 10} y1={y(db)} y2={y(db)} stroke="#e5ebf3" />
          <text x={left - 8} y={y(db) + 4} fontSize="10" textAnchor="end" fill="#64748b">{db}</text>
        </g>
      ))}

      {/* Shaded band = mild hearing loss zone (26 to 40 dB) */}
      <rect x={left} y={y(26)} width={chartWidth} height={y(40) - y(26)} fill="#fdecec" />

      {/* Frequency labels at the bottom */}
      {data.frequencies.map((f, i) => (
        <text key={f} x={x(i)} y={height - 8} fontSize="10" textAnchor="middle" fill="#64748b">{f}</text>
      ))}

      {/* Right ear: red line with circles */}
      <polyline points={toPoints(data.right)} fill="none" stroke="#d2334a" strokeWidth="2" />
      {data.right.map((db, i) => (
        <circle key={i} cx={x(i)} cy={y(db)} r="5" fill="#fff" stroke="#d2334a" strokeWidth="2" />
      ))}

      {/* Left ear: blue dashed line with crosses */}
      <polyline points={toPoints(data.left)} fill="none" stroke="#2f57c7" strokeWidth="2" strokeDasharray="5 4" />
      {data.left.map((db, i) => (
        <path key={i} d={`M${x(i) - 5} ${y(db) - 5} l10 10 M${x(i) + 5} ${y(db) - 5} l-10 10`} stroke="#2f57c7" strokeWidth="2" />
      ))}
    </svg>
  )
}
