export function ReadinessRing({ value, size = 56 }: { value: number; size?: number }) {
  const stroke = size / 9
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const color =
    value >= 85 ? 'var(--status-ok)' : value >= 65 ? 'var(--status-watch)' : 'var(--status-act)'

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Readiness score ${value} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono font-semibold"
        style={{ fontSize: size * 0.3 }}
      >
        {value}
      </span>
    </div>
  )
}
