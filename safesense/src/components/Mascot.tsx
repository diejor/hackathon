/* eslint-disable react-refresh/only-export-components -- stage helpers live beside the mascot they describe */
// SafeSense Mascot: a little cyborg companion that evolves with the player's points.
// Five stages, from an unplanted seed packet to a full Sentinel, in the SafeSense green palette.
// Sits on a light "badge" disc so the green cyborg reads on any background (incl. the green card).
// Idle: gentle float + blink. Evolution: ring burst + sparkles + spring morph when the stage changes.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import './Mascot.css'

export type MascotStage = 0 | 1 | 2 | 3 | 4

export const MASCOT_STAGES = [
  { stage: 0 as MascotStage, name: 'Seed Packet', min: 0, max: 0 },
  { stage: 1 as MascotStage, name: 'Sprout Bot', min: 1, max: 4 },
  { stage: 2 as MascotStage, name: 'Rookie', min: 5, max: 9 },
  { stage: 3 as MascotStage, name: 'Guardian', min: 10, max: 19 },
  { stage: 4 as MascotStage, name: 'Sentinel', min: 20, max: Infinity },
] as const

export function stageFor(points: number | null): MascotStage {
  if (points === null || points <= 0) return 0
  if (points < 5) return 1
  if (points < 10) return 2
  if (points < 20) return 3
  return 4
}

export function stageMeta(stage: MascotStage) {
  return MASCOT_STAGES[stage]
}

/** Next milestone: what the player needs to reach to evolve. Null at the final stage. */
export function nextMilestone(stage: MascotStage): { at: number; name: string } | null {
  if (stage >= 4) return null
  const next = MASCOT_STAGES[stage + 1]
  return { at: next.min, name: next.name }
}

// Colors tuned to SafeSense's --brand: deep green body, lighter mint for lit panels, cream highlights.
const COLORS = {
  shell: '#2d4f3f',
  shellLight: '#3f6b56',
  plate: '#f3f0e7',
  glow: '#7fd4a8',
  glowBright: '#a8f0c8',
  deep: '#1b3328',
  shadow: 'rgba(27, 51, 40, 0.18)',
}

/** Shared "eye" that blinks on a slow loop. */
function Eye({ cx, cy, rx, ry, delay = 0 }: { cx: number; cy: number; rx: number; ry: number; delay?: number }) {
  return (
    <motion.ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      fill={COLORS.glowBright}
      animate={{ scaleY: [1, 1, 0.08, 1, 1] }}
      transition={{ duration: 4.5, times: [0, 0.82, 0.86, 0.9, 1], repeat: Infinity, delay, ease: 'easeInOut' }}
      style={{ transformOrigin: `${cx}px ${cy}px`, filter: `drop-shadow(0 0 3px ${COLORS.glow})` }}
    />
  )
}

/** Light disc behind the creature so the green body separates from any background. */
function Backdrop() {
  return (
    <g>
      <defs>
        <radialGradient id="ssMascotBg" cx="50%" cy="40%" r="68%">
          <stop offset="0%" stopColor="#f6faf7" />
          <stop offset="100%" stopColor="#d9e9df" />
        </radialGradient>
      </defs>
      <circle cx={60} cy={60} r={58} fill="url(#ssMascotBg)" stroke="rgba(53, 94, 74, 0.16)" strokeWidth={1.5} />
    </g>
  )
}

// Crimped top edge of the seed packet: a zigzag from x=34 to x=86.
const CRIMP_TEETH = 8
const CRIMP = (() => {
  const step = 52 / CRIMP_TEETH
  const pts = ['34,30', '34,21']
  for (let i = 0; i < CRIMP_TEETH; i++) pts.push(`${34 + step * (i + 0.5)},16`, `${34 + step * (i + 1)},21`)
  pts.push('86,30')
  return pts.join(' ')
})()

/** Stage 0: Seed Packet. Nothing planted yet: a packet with a simple picture of the mascot's face on the label. */
function SeedPacket() {
  return (
    <g>
      <ellipse cx={60} cy={104} rx={26} ry={3.5} fill={COLORS.shadow} />
      <motion.g
        animate={{ rotate: [-2, 2, -2] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '60px 100px' }}
      >
        {/* Packet body and crimped top */}
        <rect x={34} y={24} width={52} height={76} rx={4} fill={COLORS.shellLight} />
        <polygon points={CRIMP} fill={COLORS.deep} />
        {/* Label with the face icon: head, visor, two glowing eyes, smile, a tiny antenna */}
        <rect x={40} y={36} width={40} height={42} rx={6} fill={COLORS.plate} />
        <line x1={60} y1={47} x2={60} y2={42.5} stroke={COLORS.shell} strokeWidth={1.6} strokeLinecap="round" />
        <circle cx={60} cy={41.5} r={2} fill={COLORS.glow} />
        <ellipse cx={60} cy={60} rx={14} ry={13} fill={COLORS.shell} />
        <ellipse cx={60} cy={57} rx={11} ry={7} fill={COLORS.deep} />
        <Eye cx={55.5} cy={57} rx={2.4} ry={2.4} />
        <Eye cx={64.5} cy={57} rx={2.4} ry={2.4} delay={0.08} />
        <path d="M56.5 66 Q60 68.5 63.5 66" stroke={COLORS.plate} strokeWidth={1.3} fill="none" strokeLinecap="round" />
        {/* Seeds along the bottom of the packet */}
        <ellipse cx={50} cy={89} rx={2.2} ry={3} fill={COLORS.plate} opacity={0.85} />
        <ellipse cx={60} cy={89} rx={2.2} ry={3} fill={COLORS.plate} opacity={0.85} />
        <ellipse cx={70} cy={89} rx={2.2} ry={3} fill={COLORS.plate} opacity={0.85} />
      </motion.g>
    </g>
  )
}

/** Stage 1: Sprout Bot. A small floating head with a tiny antenna. */
function SproutBot() {
  return (
    <g>
      <ellipse cx={60} cy={100} rx={22} ry={3.5} fill={COLORS.shadow} />
      <line x1={60} y1={30} x2={60} y2={18} stroke={COLORS.shell} strokeWidth={2} strokeLinecap="round" />
      <motion.circle
        cx={60}
        cy={15}
        r={3.5}
        fill={COLORS.glowBright}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ filter: `drop-shadow(0 0 4px ${COLORS.glow})` }}
      />
      <ellipse cx={60} cy={62} rx={30} ry={28} fill={COLORS.shell} />
      <ellipse cx={60} cy={56} rx={24} ry={16} fill={COLORS.deep} />
      <Eye cx={51} cy={56} rx={4.5} ry={4.5} />
      <Eye cx={69} cy={56} rx={4.5} ry={4.5} delay={0.08} />
      <path d="M54 74 Q60 78 66 74" stroke={COLORS.plate} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <circle cx={32} cy={66} r={4} fill={COLORS.shellLight} />
      <circle cx={88} cy={66} r={4} fill={COLORS.shellLight} />
    </g>
  )
}

/** Stage 2: Rookie. Head + torso + arms, floating, chest light on. */
function Rookie() {
  return (
    <g>
      <ellipse cx={60} cy={108} rx={26} ry={3.5} fill={COLORS.shadow} />
      <line x1={60} y1={22} x2={60} y2={12} stroke={COLORS.shell} strokeWidth={2} strokeLinecap="round" />
      <motion.circle
        cx={60}
        cy={9}
        r={3.5}
        fill={COLORS.glowBright}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ filter: `drop-shadow(0 0 5px ${COLORS.glow})` }}
      />
      <ellipse cx={60} cy={44} rx={24} ry={22} fill={COLORS.shell} />
      <ellipse cx={60} cy={40} rx={19} ry={13} fill={COLORS.deep} />
      <Eye cx={52} cy={40} rx={3.8} ry={3.8} />
      <Eye cx={68} cy={40} rx={3.8} ry={3.8} delay={0.08} />
      <path d="M55 54 Q60 57 65 54" stroke={COLORS.plate} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <path d="M40 68 L80 68 L84 98 L36 98 Z" fill={COLORS.shell} />
      <rect x={38} y={68} width={44} height={4} fill={COLORS.deep} />
      <motion.circle
        cx={60}
        cy={84}
        r={6}
        fill={COLORS.glow}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ filter: `drop-shadow(0 0 4px ${COLORS.glow})` }}
      />
      <motion.g
        animate={{ rotate: [-2, 2, -2] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '30px 76px' }}
      >
        <rect x={24} y={72} width={10} height={20} rx={5} fill={COLORS.shellLight} />
        <circle cx={29} cy={95} r={6} fill={COLORS.shell} />
      </motion.g>
      <motion.g
        animate={{ rotate: [2, -2, 2] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '90px 76px' }}
      >
        <rect x={86} y={72} width={10} height={20} rx={5} fill={COLORS.shellLight} />
        <circle cx={91} cy={95} r={6} fill={COLORS.shell} />
      </motion.g>
    </g>
  )
}

/** Stage 3: Guardian. Armored, shield on chest, legs appear, shoulder plates. */
function Guardian() {
  return (
    <g>
      <ellipse cx={60} cy={114} rx={30} ry={3.5} fill={COLORS.shadow} />
      <line x1={54} y1={18} x2={50} y2={8} stroke={COLORS.shell} strokeWidth={1.8} strokeLinecap="round" />
      <line x1={66} y1={18} x2={70} y2={8} stroke={COLORS.shell} strokeWidth={1.8} strokeLinecap="round" />
      <motion.circle
        cx={50}
        cy={6}
        r={2.8}
        fill={COLORS.glowBright}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx={70}
        cy={6}
        r={2.8}
        fill={COLORS.glowBright}
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <path d="M38 40 Q38 20 60 20 Q82 20 82 40 L82 50 L38 50 Z" fill={COLORS.shell} />
      <ellipse cx={60} cy={44} rx={24} ry={20} fill={COLORS.shell} />
      <ellipse cx={60} cy={40} rx={20} ry={11} fill={COLORS.deep} />
      <Eye cx={51} cy={40} rx={3.8} ry={3.8} />
      <Eye cx={69} cy={40} rx={3.8} ry={3.8} delay={0.08} />
      <path d="M54 54 Q60 58 66 54" stroke={COLORS.plate} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <path d="M28 68 L38 62 L46 68 L46 78 L28 78 Z" fill={COLORS.shellLight} />
      <path d="M74 68 L82 62 L92 68 L92 78 L74 78 Z" fill={COLORS.shellLight} />
      <path d="M38 66 L82 66 L82 100 L38 100 Z" fill={COLORS.shell} />
      <rect x={38} y={66} width={44} height={4} fill={COLORS.deep} />
      <motion.g
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '60px 84px' }}
      >
        <path d="M60 74 L72 78 L72 86 Q72 94 60 98 Q48 94 48 86 L48 78 Z" fill={COLORS.glow} />
        <path d="M55 85 L59 89 L66 81" stroke={COLORS.deep} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      <motion.g
        animate={{ rotate: [-3, 3, -3] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '30px 80px' }}
      >
        <rect x={22} y={76} width={12} height={22} rx={5} fill={COLORS.shell} />
        <circle cx={28} cy={102} r={7} fill={COLORS.shellLight} />
      </motion.g>
      <motion.g
        animate={{ rotate: [3, -3, 3] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '90px 80px' }}
      >
        <rect x={86} y={76} width={12} height={22} rx={5} fill={COLORS.shell} />
        <circle cx={92} cy={102} r={7} fill={COLORS.shellLight} />
      </motion.g>
      <rect x={46} y={100} width={10} height={14} rx={3} fill={COLORS.shell} />
      <rect x={64} y={100} width={10} height={14} rx={3} fill={COLORS.shell} />
    </g>
  )
}

/** Stage 4: Sentinel. Hero form. Aura rings, winged plates, bright shield-sprout emblem. */
function Sentinel() {
  return (
    <g>
      <motion.circle
        cx={60}
        cy={62}
        r={54}
        fill="none"
        stroke={COLORS.glow}
        strokeWidth={1}
        opacity={0.35}
        animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.08, 0.35] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeOut' }}
        style={{ transformOrigin: '60px 62px' }}
      />
      <motion.circle
        cx={60}
        cy={62}
        r={48}
        fill="none"
        stroke={COLORS.glow}
        strokeWidth={1}
        opacity={0.5}
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.15, 0.5] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
        style={{ transformOrigin: '60px 62px' }}
      />
      <ellipse cx={60} cy={114} rx={32} ry={3.5} fill={COLORS.shadow} />
      <path d="M20 60 L34 54 L34 78 L20 86 Z" fill={COLORS.shellLight} opacity={0.9} />
      <path d="M100 60 L86 54 L86 78 L100 86 Z" fill={COLORS.shellLight} opacity={0.9} />
      <line x1={60} y1={16} x2={60} y2={4} stroke={COLORS.shell} strokeWidth={2} strokeLinecap="round" />
      <line x1={46} y1={20} x2={40} y2={10} stroke={COLORS.shell} strokeWidth={1.6} strokeLinecap="round" />
      <line x1={74} y1={20} x2={80} y2={10} stroke={COLORS.shell} strokeWidth={1.6} strokeLinecap="round" />
      <motion.circle
        cx={60}
        cy={2}
        r={3.5}
        fill={COLORS.glowBright}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ filter: `drop-shadow(0 0 6px ${COLORS.glow})` }}
      />
      <circle cx={40} cy={8} r={2} fill={COLORS.glowBright} />
      <circle cx={80} cy={8} r={2} fill={COLORS.glowBright} />
      <path d="M36 40 Q36 18 60 18 Q84 18 84 40 L84 50 L36 50 Z" fill={COLORS.shell} />
      <ellipse cx={60} cy={44} rx={26} ry={22} fill={COLORS.shell} />
      <ellipse cx={60} cy={40} rx={22} ry={12} fill={COLORS.deep} />
      <Eye cx={51} cy={40} rx={4.2} ry={4.2} />
      <Eye cx={69} cy={40} rx={4.2} ry={4.2} delay={0.08} />
      <path d="M53 54 Q60 59 67 54" stroke={COLORS.plate} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <path d="M26 68 L36 60 L46 68 L46 80 L26 80 Z" fill={COLORS.plate} />
      <path d="M74 68 L84 60 L94 68 L94 80 L74 80 Z" fill={COLORS.plate} />
      <path d="M38 66 L82 66 L82 102 L38 102 Z" fill={COLORS.shell} />
      <rect x={38} y={66} width={44} height={4} fill={COLORS.deep} />
      <motion.g
        animate={{ scale: [1, 1.07, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '60px 86px' }}
      >
        <path d="M60 72 L74 76 L74 88 Q74 97 60 102 Q46 97 46 88 L46 76 Z" fill={COLORS.glowBright} />
        <path d="M60 94 L60 84" stroke={COLORS.deep} strokeWidth={2.2} strokeLinecap="round" />
        <path d="M60 86 Q52 82 52 76 Q58 76 60 82" fill={COLORS.deep} />
        <path d="M60 86 Q68 82 68 76 Q62 76 60 82" fill={COLORS.deep} />
      </motion.g>
      <motion.g
        animate={{ rotate: [-4, 4, -4] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '30px 82px' }}
      >
        <rect x={20} y={76} width={12} height={24} rx={5} fill={COLORS.shell} />
        <circle cx={26} cy={104} r={7} fill={COLORS.plate} />
      </motion.g>
      <motion.g
        animate={{ rotate: [4, -4, 4] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '90px 82px' }}
      >
        <rect x={88} y={76} width={12} height={24} rx={5} fill={COLORS.shell} />
        <circle cx={94} cy={104} r={7} fill={COLORS.plate} />
      </motion.g>
      <rect x={46} y={102} width={10} height={14} rx={3} fill={COLORS.shell} />
      <rect x={64} y={102} width={10} height={14} rx={3} fill={COLORS.shell} />
    </g>
  )
}

function Body({ stage }: { stage: MascotStage }) {
  switch (stage) {
    case 0:
      return <SeedPacket />
    case 1:
      return <SproutBot />
    case 2:
      return <Rookie />
    case 3:
      return <Guardian />
    case 4:
      return <Sentinel />
  }
}

/** The evolution burst: expanding rings + sparkle flash. `reach` scales it down for the small header. */
function EvolutionBurst({ onDone, reach = 1 }: { onDone: () => void; reach?: number }) {
  const sparkleCount = reach < 1 ? 7 : 10
  return (
    <motion.g
      aria-hidden="true"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1.1, ease: 'easeOut' }}
      onAnimationComplete={onDone}
    >
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={60}
          cy={62}
          r={20}
          fill="none"
          stroke={COLORS.glowBright}
          strokeWidth={2}
          initial={{ scale: 0.5, opacity: 0.9 }}
          animate={{ scale: (2.4 + i * 0.3) * reach, opacity: 0 }}
          transition={{ duration: 1, delay: i * 0.12, ease: 'easeOut' }}
          style={{ transformOrigin: '60px 62px' }}
        />
      ))}
      {Array.from({ length: sparkleCount }, (_, i) => {
        const angle = (i / sparkleCount) * Math.PI * 2
        const dist = 56 * reach
        const x = 60 + Math.cos(angle) * dist
        const y = 62 + Math.sin(angle) * dist
        return (
          <motion.circle
            key={`s${i}`}
            cx={x}
            cy={y}
            r={2.5}
            fill={COLORS.glowBright}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.9, delay: 0.15 + (i % 3) * 0.05, ease: 'easeOut' }}
          />
        )
      })}
    </motion.g>
  )
}

export type MascotProps = {
  points: number | null
  /** Pixel size (square). Defaults to 120. */
  size?: number
  /** Show the stage name + next milestone below the mascot. */
  showLabel?: boolean
  /** Tight header/badge variant: smaller float and a gentler burst. */
  compact?: boolean
  /** Light disc behind the creature (default on) so it reads on green/colored surfaces. */
  backdrop?: boolean
  className?: string
}

/**
 * The SafeSense mascot. Drop this anywhere the player's points can be read.
 * On a points change that crosses an evolution threshold, plays a one-shot burst
 * and morphs to the new stage. Decorative by default (parent should carry the label).
 * Respects prefers-reduced-motion.
 */
export function Mascot({
  points,
  size = 120,
  showLabel = false,
  compact = false,
  backdrop = true,
  className = '',
}: MascotProps) {
  const stage = stageFor(points)
  const meta = stageMeta(stage)
  const next = nextMilestone(stage)
  const reduced = useReducedMotion()
  const prevStage = useRef<MascotStage>(stage)
  const [burstId, setBurstId] = useState(0)

  useEffect(() => {
    if (prevStage.current !== stage) {
      prevStage.current = stage
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one burst per stage change, not a render loop
      if (!reduced) setBurstId((n) => n + 1)
    }
  }, [stage, reduced])

  const floatY = compact ? -2 : -4

  return (
    <div className={`mascot ${compact ? 'mascot-compact' : ''} ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        {backdrop && <Backdrop />}
        {/* The creature floats over the (static) disc. */}
        <motion.g
          animate={reduced ? undefined : { y: [0, floatY, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <AnimatePresence mode="wait">
            <motion.g
              key={stage}
              initial={{ scale: 0.72, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              style={{ transformOrigin: '60px 62px' }}
            >
              <Body stage={stage} />
            </motion.g>
          </AnimatePresence>
        </motion.g>
        <AnimatePresence>
          {burstId > 0 && (
            <EvolutionBurst key={burstId} reach={compact ? 0.72 : 1} onDone={() => setBurstId(0)} />
          )}
        </AnimatePresence>
      </svg>
      {showLabel && (
        <div className="mascot-label">
          <div className="mascot-name">{meta.name}</div>
          {next ? (
            <div className="mascot-next">Next evolution at {next.at} points</div>
          ) : (
            <div className="mascot-next mascot-max">Max form reached</div>
          )}
        </div>
      )}
    </div>
  )
}
