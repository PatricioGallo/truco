import { displayName } from '../api/shared.js'

export default function Avatar({ profile, size = 36 }) {
  const name = displayName(profile) || '?'
  return (
    <span className="avatar" style={{ '--size': `${size}px` }} aria-hidden="true">
      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : name[0].toUpperCase()}
    </span>
  )
}
