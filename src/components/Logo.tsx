import { useId } from 'react'

interface LogoProps {
  size?: number
  /** Renders just the shield+clock mark with a transparent background, for placing on an existing surface (e.g. inside a colored badge). */
  bare?: boolean
  className?: string
}

/**
 * The app's single mark: a shield (encryption/vault) with a clock hand
 * (time-based codes) inside. This exact artwork is also what's rasterized
 * into the favicon and PWA icons (see design/icon-source.svg) — this
 * component exists so the same mark can render inline in the UI (gate
 * screen, docs page) instead of a generic placeholder icon.
 */
export function Logo({ size = 56, bare = false, className }: LogoProps) {
  const gradientId = useId()

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Web Authenticator logo"
      className={className}
    >
      {!bare ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#171b24" />
              <stop offset="1" stopColor="#10131a" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="112" fill={`url(#${gradientId})`} />
        </>
      ) : null}
      <path
        d="M256 96l124 44v96c0 92-53 168-124 196-71-28-124-104-124-196v-96l124-44z"
        fill="none"
        stroke="#2a3040"
        strokeWidth={14}
      />
      <path
        d="M256 96l124 44v96c0 92-53 168-124 196-71-28-124-104-124-196v-96l124-44z"
        fill="none"
        stroke="#4fd1c5"
        strokeWidth={14}
        strokeDasharray={620}
        strokeDashoffset={150}
        strokeLinecap="round"
      />
      <circle cx={256} cy={266} r={72} fill="none" stroke="#e9ecf1" strokeWidth={12} />
      <line x1={256} y1={266} x2={256} y2={218} stroke="#e9ecf1" strokeWidth={12} strokeLinecap="round" />
      <line x1={256} y1={266} x2={292} y2={266} stroke="#4fd1c5" strokeWidth={12} strokeLinecap="round" />
      <circle cx={256} cy={266} r={8} fill="#e9ecf1" />
    </svg>
  )
}
