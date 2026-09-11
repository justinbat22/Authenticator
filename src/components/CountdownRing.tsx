interface CountdownRingProps {
  progress: number // 0 (just started) to 1 (about to roll over)
  secondsLeft: number
  size?: number
}

export function CountdownRing({ progress, secondsLeft, size = 36 }: CountdownRingProps) {
  const strokeWidth = 3
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)
  const isUrgent = secondsLeft <= 5

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${secondsLeft} seconds until code refreshes`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isUrgent ? 'var(--color-warning)' : 'var(--color-accent)'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 250ms linear, stroke 200ms' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.32}
        fontFamily="var(--font-mono)"
        fill={isUrgent ? 'var(--color-warning)' : 'var(--color-text-secondary)'}
      >
        {secondsLeft}
      </text>
    </svg>
  )
}
