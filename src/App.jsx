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

  // Partida contra la compu (se guarda en el celular)
  const [initialLocal] = useState(() => savedLocalMatch()?.match ?? null)
  const local = useLocalMatch(initialLocal)
  const [flor, setFlor] = useState(true)

  // Amigos
  const [friends, setFriends] = useState({ friends: [], incoming: [], outgoing: [] })
  const reloadFriends = useCallback(() => api.friendsData(profile.id).then(setFriends).catch(() => {}), [profile.id])
  useEffect(() => {
    reloadFriends()
    const t = setInterval(reloadFriends, 20000)
    return () => clearInterval(t)
  }, [reloadFriends])

  // Partidas online: lista inicial + cambios en tiempo real
  const [rooms, setRooms] = useState({})
  const [people, setPeople] = useState({ [profile.id]: profile })
  useEffect(() => {
    const upsert = (v) => setRooms((r) => (r[v.id] && r[v.id].version > v.version ? r : { ...r, [v.id]: v }))
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

  const openRoom = (view) => {
    setRooms((r) => ({ ...r, [view.id]: view }))
    go('room', { roomId: view.id })
  }

  // ----- Pantallas -----
  if (screen.name === 'local' && local.match) {
    const n = local.match.config.players
    return (
      <div className="screen">
        <Table
          view={local.view}
          me={local.me}
          actions={legalActions(local.match, local.me)}
          names={LOCAL_NAMES[n]}
          bubbles={local.bubbles}
          onAct={(a) => local.act(local.me, a)}
          onNextHand={local.nextHand}
          onRestart={() => local.restart(n, local.match.config.flor)}
          onQuit={() => (local.quit(), go('home'))}
          onBack={() => go('home')}
        />
      </div>
    )
  }

  if (screen.name === 'room' && rooms[screen.roomId]) {
    return (
      <div className="screen">
        <OnlineRoom room={rooms[screen.roomId]} profile={profile} people={people} onBack={() => go('home')} />
      </div>
    )
  }

  if (screen.name === 'friends') {
    return (
      <div className="screen">
        <Friends
          profile={profile}
          data={friends}
          reload={reloadFriends}
          onPlayWith={(p) => go('new', { preset: p })}
          onBack={() => go('home')}
        />
      </div>
    )
  }

  if (screen.name === 'new') {
    return (
      <div className="screen">
        <NewOnline
          friends={friends.friends}
          preset={screen.preset}
          onCreate={async (opts) => openRoom(await api.createRoom(opts))}
          onBack={() => go('home')}
        />
      </div>
    )
  }

  if (screen.name === 'profile') {
    return (
      <div className="screen">
        <Profile profile={profile} onChange={setProfile} onBack={() => go('home')} />
      </div>
    )
  }

  return (
    <div className="screen">
      <Home
        profile={profile}
        friends={friends}
        rooms={Object.values(rooms)}
        local={local}
        flor={flor}
        setFlor={setFlor}
        onLocal={(players) => (local.restart(players, flor), go('local'))}
        onResumeLocal={() => go('local')}
        onFriends={() => go('friends')}
        onNew={() => go('new')}
        onProfile={() => go('profile')}
        onOpenRoom={(id) => go('room', { roomId: id })}
        onJoinCode={async (code) => openRoom(await api.joinRoom({ code }))}
        people={people}
      />
    </div>
  )
}

function Home({ profile, friends, rooms, local, flor, setFlor, onLocal, onResumeLocal, onFriends, onNew, onProfile, onOpenRoom, onJoinCode, people }) {
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const invites = rooms.filter((r) => r.status === 'waiting' && r.seats[r.mySeat]?.type === 'user' && !r.seats[r.mySeat].joined)
  const active = rooms.filter((r) => !invites.includes(r) && ['waiting', 'playing'].includes(r.status))
  const finished = rooms.filter((r) => r.status === 'finished').slice(0, 3)
  const hostName = (r) => {
    const p = people[r.hostId]
    return p ? displayName(p) : 'Un amigo'
  }
  const localOn = local.match && local.match.winner === null

  return (
    <main className="home">
      <header className="home-top">
        <h1 className="title title-small">Truco</h1>
        <button className="me" onClick={onProfile} aria-label="Mi perfil">
          <Avatar profile={profile} size={40} />
        </button>
      </header>
      <p className="greeting">Hola, {profile.first_name || profile.username}. ¿Una mano?</p>

      {invites.length > 0 && (
        <section className="panel invites">
          <h3>Te invitaron</h3>
          {invites.map((r) => (
            <button key={r.id} className="room-row is-invite" onClick={() => onOpenRoom(r.id)}>
              <span>
                <b>{hostName(r)}</b> te invitó a {r.players === 2 ? 'un mano a mano' : 'jugar de a cuatro'}
              </span>
              <span className="tag tag-gold">Ver</span>
            </button>
          ))}
        </section>
      )}

      <section className="block">
        <h2>Con amigos</h2>
        <div className="mode-grid">
          <button className="mode mode-friends" onClick={onNew}>
            <span className="mode-title">Nueva partida</span>
            <span className="mode-sub">Invitá amigos o compartí el código</span>
          </button>
          <button className="mode mode-friends" onClick={onFriends}>
            <span className="mode-title">
              Amigos{friends.incoming.length > 0 && <span className="badge">{friends.incoming.length}</span>}
            </span>
            <span className="mode-sub">
              {friends.friends.length ? `${friends.friends.length} agregados` : 'Buscá y agregá jugadores'}
            </span>
          </button>
        </div>
        <form
          className="code-join"
          onSubmit={async (e) => {
            e.preventDefault()
            setCodeError('')
            try {
              await onJoinCode(code.trim())
            } catch (err) {
              setCodeError(err.message)
            }
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Código de sala"
            maxLength={5}
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <button className="btn btn-ghost" disabled={code.trim().length < 5}>
            Unirme
          </button>
        </form>
        {codeError && <p className="form-error">{codeError}</p>}
        {active.length > 0 && (
          <div className="room-list">
            {active.map((r) => (
              <button key={r.id} className="room-row" onClick={() => onOpenRoom(r.id)}>
                <span>
                  {r.players === 2 ? 'Mano a mano' : 'De a cuatro'}{' '}
                  <span className="muted">
                    {r.status === 'waiting'
                      ? `esperando jugadores (${r.code})`
                      : `${r.match?.score[r.mySeat % 2] ?? 0} a ${r.match?.score[1 - (r.mySeat % 2)] ?? 0}`}
                  </span>
                </span>
                <span className="tag tag-gold">{r.status === 'waiting' ? 'Sala' : 'Seguir'}</span>
              </button>
            ))}
          </div>
        )}
        {finished.length > 0 && (
          <p className="muted small">
            Últimas: {finished.map((r) => (r.match.winner === r.mySeat % 2 ? 'ganaste' : 'perdiste')).join(', ')}
          </p>
        )}
      </section>

      <section className="block">
        <h2>Contra la compu</h2>
        {localOn && (
          <button className="room-row" onClick={onResumeLocal}>
            <span>
              Seguir partida{' '}
              <span className="muted">
                {local.match.score[0]} a {local.match.score[1]}
              </span>
            </span>
            <span className="tag tag-gold">Seguir</span>
          </button>
        )}
        <div className="mode-grid">
          <button className="mode" onClick={() => onLocal(2)}>
            <span className="mode-title">Mano a mano</span>
            <span className="mode-sub">Vos contra la compu</span>
          </button>
          <button className="mode" onClick={() => onLocal(4)}>
            <span className="mode-title">De a cuatro</span>
            <span className="mode-sub">Con un compañero contra dos</span>
          </button>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={flor} onChange={(e) => setFlor(e.target.checked)} />
          <span>Con flor</span>
        </label>
      </section>
    </main>
  )
}

function Profile({ profile, onChange, onBack }) {
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
      <h2 className="page-title center">{displayName(profile)}</h2>
      <p className="muted center">@{profile.username}</p>
      {msg && <p className="muted center">{msg}</p>}
      <p className="muted small center">Es la misma cuenta que el Sudoku: la foto y el nombre se ven en los dos juegos.</p>
      <button className="btn btn-ghost" onClick={() => api.signOut()}>
        Cerrar sesión
      </button>
    </main>
  )
}

