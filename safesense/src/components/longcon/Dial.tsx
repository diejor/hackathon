import { LOW_CRED } from '../../content/longCon'

function credWord(cred: number) {
  if (cred < LOW_CRED) return 'Doubtful'
  if (cred < 45) return 'Shaky'
  if (cred < 70) return 'Believable'
  return 'Convincing'
}

// Point on the dial's arc for a value 0..100 (0 = far left, 100 = far right).
const at = (v: number, r = 86) => {
  const a = Math.PI * (1 - v / 100)
  return `${(100 + r * Math.cos(a)).toFixed(1)} ${(100 - r * Math.sin(a)).toFixed(1)}`
}

/** "How believable it looks": a semicircle gauge with a needle, as in BadScam, in calm colors. */
export function Dial({ cred }: { cred: number }) {
  const low = cred < LOW_CRED
  return (
    <div className={`con-dial${low ? ' is-low' : ''}`}>
      <svg viewBox="0 0 200 112" aria-hidden="true" focusable="false">
        <path className="con-dial-track" d={`M14 100 A86 86 0 0 1 186 100`} />
        <path className="con-dial-low" d={`M14 100 A86 86 0 0 1 ${at(LOW_CRED)}`} />
        <path className="con-dial-fill" d={`M14 100 A86 86 0 0 1 ${at(Math.max(0.5, cred))}`} />
        <g className="con-dial-needle" style={{ transform: `rotate(${(cred / 100) * 180 - 90}deg)` }}>
          <polygon points="100,24 105,100 95,100" />
        </g>
        <circle className="con-dial-pin" cx="100" cy="100" r="7" />
      </svg>
      <span className="con-dial-word">{credWord(cred)}</span>
    </div>
  )
}
