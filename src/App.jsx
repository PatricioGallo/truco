import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '@api'
import { legalActions } from './engine/game.js'
import { useLocalMatch, savedLocalMatch } from './useLocalMatch.js'
import { displayName } from './api/shared.js'
import Table from './components/Table.jsx'
import Login from './components/Login.jsx'
import Friends from './components/Friends.jsx'
import NewOnline from './components/NewOnline.jsx'
import OnlineRoom from './components/OnlineRoom.jsx'
import Avatar from './components/Avatar.jsx'
import CpuSetup from './components/CpuSetup.jsx'
import OnlineHome from './components/OnlineHome.jsx'
import { RankingScreen, LevelPanel, HomeRanking } from './components/Ranking.jsx'
import PlayerProfile, { PlayerHeader, StatsGrid, usePlayerStats } from './components/PlayerProfile.jsx'
import { COUNTRIES, flagOf } from './countries.js'
import { useNotifications, Toast, Bell } from './components/Notifications.jsx'

const LOCAL_NAMES = { 2: ['Vos', 'La compu'], 4: ['Vos', 'Compu 1', 'Compañero', 'Compu 2'] }
const PROFILE_KEY = 'truco.profile'

export default function App() {
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    api.getSessionUser().then(setUser)
    return api.onAuthChange(setUser)
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    api
      .getProfile(user.id)
      .then((p) => {
        setProfile(p)
        try {
          localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
        } catch {
          /* nada */
        }
      })
      .catch(() => {
        // Sin conexión: el último perfil usado alcanza para jugar contra la compu
        try {
          const p = JSON.parse(localStorage.getItem(PROFILE_KEY))
          if (p?.id === user.id) setProfile(p)
        } catch {
          /* nada */
        }
      })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (user === undefined || (user && !profile)) return <Splash />
  if (!user) return <Login />
  return <Main profile={profile} setProfile={setProfile} />
}

function Splash() {
  return (
    <div className="screen splash">
      <h1 className="title">Truco</h1>
    </div>
  )
}

function Main({ profile, setProfile }) {
  const [screen, setScreen] = useState({ name: 'home' })
  const go = (name, extra = {}) => setScreen({ name, ...extra })
  const openPlayer = (userId) => setScreen((s) => ({ name: 'player', userId, back: s }))

  // Partida contra la compu (se guarda en el celular)
  const [initialLocal] = useState(() => savedLocalMatch()?.match ?? null)
  const local = useLocalMatch(initialLocal)

  // Amigos
  const [friends, setFriends] = useState({ friends: [], incoming: [], outgoing: [] })
  const reloadFriends = useCallback(() => api.friendsData(profile.id).then(setFriends).catch(() => {}), [profile.id])
  useEffect(() => {
    reloadFriends()
    const t = setInterval(reloadFriends, 20000)
    const unsub = api.subscribeFriendships(profile.id, () => reloadFriends())
    return () => {
      clearInterval(t)
      unsub()
    }
  }, [reloadFriends, profile.id])

  // Partidas online: lista inicial + cambios en tiempo real
  const [rooms, setRooms] = useState({})
  const [people, setPeople] = useState({ [profile.id]: profile })
  const upsertRoom = useCallback(
    (v) => v && setRooms((r) => (r[v.id] && r[v.id].version > v.version ? r : { ...r, [v.id]: v })),
    []
  )
  useEffect(() => {
    const upsert = upsertRoom
    api
      .myRooms(profile.id)
      .then((list) => setRooms(Object.fromEntries(list.map((v) => [v.id, v]))))
      .catch(() => {})
    return api.subscribeRooms(profile.id, upsert)
  }, [profile.id])

  // Nombres y fotos de quienes aparecen en las salas
  const roomUserIds = useMemo(
    () => [...new Set(Object.values(rooms).flatMap((r) => r.seats.filter((s) => s.userId).map((s) => s.userId)))],
    [rooms]
  )
  useEffect(() => {
    const missing = roomUserIds.filter((id) => !people[id])
    if (missing.length)
      api.profilesByIds(missing).then((ps) => setPeople((p) => ({ ...p, ...Object.fromEntries(ps.map((x) => [x.id, x])) })))
  }, [roomUserIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Notificaciones (aviso arriba + campanita)
  const notif = useNotifications({ profile, friends, rooms: Object.values(rooms), people })
  const notifHandlers = {
    onAcceptFriend: (id) => api.acceptFriend(id).then(reloadFriends).catch(() => {}),
    onRejectFriend: (id) => api.removeFriendship(id).then(reloadFriends).catch(() => {}),
    onOpenRoom: (id) => go('room', { roomId: id }),
  }
  const withToast = (node) => (
    <>
      {node}
      <Toast notif={notif} {...notifHandlers} />
    </>
  )

  const openRoom = (view) => {
    setRooms((r) => ({ ...r, [view.id]: view }))
    go('room', { roomId: view.id })
  }

  // ----- Pantallas -----
  if (screen.name === 'local' && local.match) {
    const n = local.match.config.players
    return withToast(
      <div className="screen">
        <Table
          view={local.view}
          me={local.me}
          actions={legalActions(local.match, local.me)}
          names={LOCAL_NAMES[n]}
          bubbles={local.bubbles}
          onAct={(a) => local.act(local.me, a)}
          onNextHand={local.nextHand}
          onRestart={() => local.restart(local.match.config)}
          onQuit={() => (local.quit(), go('home'))}
          onBack={() => go('home')}
          timer={local.timer}
        />
      </div>
    )
  }

  if (screen.name === 'room' && rooms[screen.roomId]) {
    return withToast(
      <div className="screen">
        <OnlineRoom
          room={rooms[screen.roomId]}
          profile={profile}
          people={people}
          onView={upsertRoom}
          onOpenPlayer={openPlayer}
          onBack={() => go('online')}
        />
      </div>
    )
  }

  if (screen.name === 'friends') {
    return withToast(
      <div className="screen">
        <Friends
          profile={profile}
          data={friends}
          reload={reloadFriends}
          onPlayWith={(p) => go('new', { preset: p })}
          onOpenPlayer={openPlayer}
          onBack={() => go('online')}
        />
      </div>
    )
  }

  if (screen.name === 'new') {
    return withToast(
      <div className="screen">
        <NewOnline
          friends={friends.friends}
          preset={screen.preset}
          onCreate={async (opts) => openRoom(await api.createRoom(opts))}
          onBack={() => go('online')}
        />
      </div>
    )
  }

  if (screen.name === 'cpu') {
    return withToast(
      <div className="screen">
        <CpuSetup
          saved={local.match && local.match.winner === null ? local.match : null}
          onResume={() => go('local')}
          onStart={(opts) => (local.restart(opts), go('local'))}
          onBack={() => go('home')}
        />
      </div>
    )
  }

  if (screen.name === 'online') {
    return withToast(
      <div className="screen">
        <OnlineHome
          profile={profile}
          friends={friends}
          rooms={Object.values(rooms)}
          onNew={() => go('new')}
          onFriends={() => go('friends')}
          onOpenRoom={(id) => go('room', { roomId: id })}
          onJoinCode={async (code) => openRoom(await api.joinRoom({ code }))}
          onJoinTable={async (roomId, partnerId) => openRoom(await api.joinRoom({ roomId, partnerId }))}
          onRanking={() => go('ranking', { from: 'online' })}
          onBack={() => go('home')}
        />
      </div>
    )
  }

  if (screen.name === 'player') {
    return withToast(
      <div className="screen">
        <PlayerProfile
          key={screen.userId}
          userId={screen.userId}
          me={profile}
          friends={friends}
          reloadFriends={reloadFriends}
          onPlayWith={(p) => go('new', { preset: p })}
          onBack={() => setScreen(screen.back ?? { name: 'home' })}
        />
      </div>
    )
  }

  if (screen.name === 'ranking') {
    return withToast(
      <div className="screen">
        <RankingScreen profile={profile} onOpenPlayer={openPlayer} onBack={() => go(screen.from ?? 'home')} />
      </div>
    )
  }

  if (screen.name === 'profile') {
    return withToast(
      <div className="screen">
        <Profile profile={profile} onChange={setProfile} onBack={() => go('home')} onRanking={() => go('ranking', { from: 'profile' })} />
      </div>
    )
  }

  return withToast(
    <div className="screen">
      <Home
        profile={profile}
        friends={friends}
        rooms={Object.values(rooms)}
        local={local}
        onCpu={() => go('cpu')}
        onOnline={() => go('online')}
        onRanking={() => go('ranking', { from: 'home' })}
        onOpenPlayer={openPlayer}
        onProfile={() => go('profile')}
        onOpenRoom={(id) => go('room', { roomId: id })}
        people={people}
        notif={notif}
        notifHandlers={notifHandlers}
      />
    </div>
  )
}

function Home({ profile, friends, rooms, local, onCpu, onOnline, onRanking, onOpenPlayer, onProfile, onOpenRoom, people, notif, notifHandlers }) {
  const invites = rooms.filter((r) => r.status === 'waiting' && r.seats[r.mySeat]?.type === 'user' && !r.seats[r.mySeat].joined)
  const playing = rooms.filter((r) => r.status === 'playing').length
  const hostName = (r) => {
    const p = people[r.seats[r.mySeat]?.invitedBy ?? r.hostId]
    return p ? displayName(p) : 'Un amigo'
  }
  const localOn = local.match && local.match.winner === null
  const onlineSub = playing
    ? `${playing} ${playing === 1 ? 'partida' : 'partidas'} en curso`
    : friends.incoming.length
      ? `${friends.incoming.length} ${friends.incoming.length === 1 ? 'pedido' : 'pedidos'} de amistad`
      : 'Mesas con otros jugadores. Suma al ranking'

  return (
    <main className="home">
      <header className="home-top">
        <h1 className="title title-small">Truco</h1>
        <span className="top-actions">
          <Bell notif={notif} {...notifHandlers} />
          <button className="me" onClick={onProfile} aria-label="Mi perfil">
            <Avatar profile={profile} size={40} />
          </button>
        </span>
      </header>
      <p className="greeting">Hola, {profile.first_name || profile.username}. ¿Una mano?</p>

      {invites.length > 0 && (
        <section className="panel invites">
          <h3>Te invitaron</h3>
          {invites.map((r) => (
            <button key={r.id} className="room-row is-invite" onClick={() => onOpenRoom(r.id)}>
              <span>
                <b>{hostName(r)}</b>{' '}
                {r.visibility === 'public'
                  ? 'te eligió de compañero en una mesa pública'
                  : `te invitó a ${r.players === 2 ? 'un mano a mano' : 'jugar de a cuatro'}`}
              </span>
              <span className="tag tag-gold">Ver</span>
            </button>
          ))}
        </section>
      )}

      <HomeRanking
        profile={profile}
        refresh={rooms.filter((r) => r.status === 'finished').length}
        onOpen={onRanking}
        onOpenPlayer={onOpenPlayer}
      />

      <nav className="categories">
        <button className="category" onClick={onCpu}>
          <span className="category-icon" aria-hidden="true">🤖</span>
          <span className="category-text">
            <span className="mode-title">Contra la máquina</span>
            <span className="mode-sub">
              {localOn
                ? `Partida empezada: ${local.match.score[0]} a ${local.match.score[1]}`
                : 'Mano a mano o de a cuatro, a tu ritmo'}
            </span>
          </span>
          <span className="category-arrow" aria-hidden="true">›</span>
        </button>
        <button className="category category-online" onClick={onOnline}>
          <span className="category-icon" aria-hidden="true">🌐</span>
          <span className="category-text">
            <span className="mode-title">
              Online
              {friends.incoming.length > 0 && <span className="badge">{friends.incoming.length}</span>}
            </span>
            <span className="mode-sub">{onlineSub}</span>
          </span>
          <span className="category-arrow" aria-hidden="true">›</span>
        </button>
        <button className="category category-ranked" disabled>
          <span className="category-icon" aria-hidden="true">🏆</span>
          <span className="category-text">
            <span className="mode-title">Competitivo</span>
            <span className="mode-sub">Mano a mano con gente de tu nivel</span>
          </span>
          <span className="tag">Pronto</span>
        </button>
      </nav>
    </main>
  )
}

function Profile({ profile, onChange, onBack, onRanking }) {
  const stats = usePlayerStats(profile.id)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setMsg('')
    try {
      onChange(await api.uploadAvatar(profile.id, file))
      setMsg('Foto actualizada.')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="profile">
      <button className="back" onClick={onBack}>
        ‹ Volver
      </button>
      <label className="photo-btn">
        <Avatar profile={profile} size={112} />
        <span className="photo-badge">{busy ? '…' : '📷'}</span>
        <input type="file" accept="image/*" hidden onChange={onPhoto} />
      </label>
      <PlayerHeader profile={profile} hideAvatar />
      {msg && <p className="muted center">{msg}</p>}
      <LevelPanel rating={stats} onOpenRanking={onRanking} />
      <StatsGrid stats={stats} />
      <EditProfile profile={profile} onChange={onChange} />
      <LoginEmail userId={profile.id} />
      <p className="muted small center">Es la misma cuenta que el Sudoku: la foto y el nombre se ven en los dos juegos.</p>
      <button className="btn btn-ghost" onClick={() => api.signOut()}>
        Cerrar sesión
      </button>
      <p className="credits">
        Naipes: dibujos de{' '}
        <a href="https://commons.wikimedia.org/wiki/User:Basquetteur" target="_blank" rel="noreferrer">
          Basquetteur
        </a>{' '}
        (Wikimedia Commons), con licencia{' '}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.es" target="_blank" rel="noreferrer">
          CC BY-SA 3.0
        </a>
        . Adaptados a imágenes livianas.
      </p>
    </main>
  )
}

// Nombre, apellido y nacionalidad (los mismos datos que usa el Sudoku)
function EditProfile({ profile, onChange }) {
  const [form, setForm] = useState({
    first_name: profile.first_name ?? '',
    last_name: profile.last_name ?? '',
    country: profile.country ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const changed =
    form.first_name.trim() !== (profile.first_name ?? '') ||
    form.last_name.trim() !== (profile.last_name ?? '') ||
    form.country !== (profile.country ?? '')
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      onChange(await api.updateMyProfile(profile.id, form))
      setMsg('Datos guardados.')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="login-form panel" onSubmit={submit}>
      <h3>Tus datos</h3>
      <div className="field-row">
        <label className="field">
          <span>Nombre</span>
          <input value={form.first_name} onChange={set('first_name')} maxLength={40} autoComplete="given-name" />
        </label>
        <label className="field">
          <span>Apellido</span>
          <input value={form.last_name} onChange={set('last_name')} maxLength={40} autoComplete="family-name" />
        </label>
      </div>
      <label className="field">
        <span>Nacionalidad</span>
        <select value={form.country} onChange={set('country')}>
          <option value="">Sin elegir</option>
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {flagOf(code)} {name}
            </option>
          ))}
        </select>
      </label>
      {msg && <p className="muted small center">{msg}</p>}
      {changed && (
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      )}
    </form>
  )
}

// Mail opcional para entrar escribiéndolo en vez del usuario
function LoginEmail({ userId }) {
  const [saved, setSaved] = useState(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    let alive = true
    api
      .getMyEmail(userId)
      .then((e) => alive && (setSaved(e), setEmail(e)))
      .catch(() => alive && setSaved(''))
    return () => {
      alive = false
    }
  }, [userId])
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const value = await api.setMyEmail(userId, email)
      setSaved(value)
      setEmail(value)
      setMsg(value ? 'Listo: ya podés entrar con este mail.' : 'Mail borrado.')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }
  if (saved === null) return null
  const changed = email.trim().toLowerCase() !== saved
  return (
    <form className="login-form" onSubmit={submit}>
      <label className="field">
        <span>Mail para entrar (opcional)</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck="false"
          placeholder="tu@mail.com"
        />
      </label>
      {msg && <p className="muted small center">{msg}</p>}
      {changed && (
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Guardando…' : email.trim() ? 'Guardar mail' : 'Borrar mail'}
        </button>
      )}
    </form>
  )
}
