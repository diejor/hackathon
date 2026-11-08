import { useState } from 'react'
import { MessageCircle, Pencil, UserRound } from 'lucide-react'
import { href } from '../../router'
import { useNickname } from '../../lib/profileStore'
import { ASK_LABEL } from '../chat/copy'
import { NameDialog } from '../NameDialog'

/** The display name (the same one as the dashboard, changed with the same popup) and the "saved privately" note. */
export function NicknamePanel() {
  const name = useNickname()
  const [editing, setEditing] = useState(false)

  return (
    <div className="panel nickname-panel">
      <UserRound size={28} strokeWidth={1.4} className="icon-muted" aria-hidden="true" />
      <div className="dash-greeting">
        <h2 className="h3">{name ? `Hi, ${name}` : 'Hi there'}</h2>
        <button
          className="name-edit"
          onClick={() => setEditing(true)}
          aria-label={name ? 'Change your display name' : 'Add your display name'}
          title={name ? 'Change your display name' : 'Add your display name'}
        >
          <Pencil size={20} strokeWidth={1.75} />
        </button>
      </div>
      <p>Your progress is saved privately on SafeSense’s server, linked to this browser. No account needed.</p>
      <a className="btn btn-secondary btn-block" href={href('chat')}>
        <MessageCircle size={20} /> <span>{ASK_LABEL} about your progress</span>
      </a>
      {editing && <NameDialog current={name} onClose={() => setEditing(false)} />}
    </div>
  )
}
