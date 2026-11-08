import { AlertTriangle, CircleAlert, Image as ImageIcon, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { ChatMessage } from '../../lib/useBot'
import { ASSISTANT } from './copy'

// Every piece of message text is rendered as plain React text: model output and pasted scam messages are
// untrusted, and links are deliberately never made clickable.

const VERDICTS: Record<string, { label: string; Icon: typeof ShieldAlert }> = {
  scam: { label: 'Looks like a scam', Icon: ShieldAlert },
  suspicious: { label: 'Some warning signs', Icon: AlertTriangle },
  likely_safe: { label: 'Likely safe', Icon: ShieldCheck },
}

const CHANNELS: Record<string, string> = {
  imessage: 'iMessage',
  sms: 'text message',
  whatsapp: 'WhatsApp',
  whatsapp_business: 'WhatsApp',
  telegram: 'Telegram',
  email: 'email',
  discord: 'Discord',
}

const time = (m: ChatMessage) =>
  new Date(Number(m.createdAt.microsSinceUnixEpoch / 1000n)).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

export function Message({ m }: { m: ChatMessage }) {
  const mine = m.role.tag === 'User'
  const verdict = mine ? undefined : VERDICTS[m.verdict]
  const via = m.channel && m.channel !== 'web' ? (CHANNELS[m.channel] ?? m.channel) : null
  const cls = ['bubble', 'chat-bubble', mine && 'mine', verdict && 'chat-answer', m.isError && 'chat-bubble-error']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls}>
      <span className="meta">
        {mine ? 'You' : ASSISTANT} · {time(m)}
        {via && ` · via ${via}`}
      </span>

      {mine && m.hadImage && (
        <div className="chat-shot">
          <span className="chat-shot-label">
            <ImageIcon size={16} strokeWidth={1.75} aria-hidden="true" /> Picture shared
          </span>
          {m.imageNote && (
            <details>
              <summary>What {ASSISTANT} read in it</summary>
              <p className="chat-text">{m.imageNote}</p>
            </details>
          )}
        </div>
      )}

      {verdict && (
        <span className={`chat-verdict chat-verdict-${m.verdict}`}>
          <verdict.Icon size={18} strokeWidth={1.75} aria-hidden="true" />
          {verdict.label}
        </span>
      )}

      {m.isError && (
        <span className="chat-error-label">
          <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" /> Something went wrong
        </span>
      )}

      {m.text && <p className="chat-text">{m.text}</p>}

      {verdict && m.redFlags.length > 0 && (
        <div className="chat-section">
          <h3>Signs to notice</h3>
          <ul>
            {m.redFlags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {verdict && m.nextSteps.length > 0 && (
        <div className="chat-section">
          <h3>What to do</h3>
          <ul>
            {m.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
