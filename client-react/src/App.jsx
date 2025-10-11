import React, { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import Board from './components/Board'
import Lobby from './components/Lobby'

// In dev, Vite proxies /socket.io to 8080. In prod, same origin.
const socket = io()

export default function App() {
  const [nickname, setNickname] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState(null) // 'warden'|'prisoner'|null
  const [queue, setQueue] = useState([])
  const [players, setPlayers] = useState([])
  const [scores, setScores] = useState({ warder: 0, prisoner: 0 })
  const [grid, setGrid] = useState(5)
  const [board, setBoard] = useState([])
  const [positions, setPositions] = useState(null)
  const [currentTurn, setCurrentTurn] = useState(null)
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    socket.on('hello', ({ msg }) => setStatus(msg))
    socket.on('lobby:update', ({ clients, queue }) => {
      setPlayers(clients || [])
      setQueue(queue || [])
    })
    socket.on('role', ({ role }) => setRole(role))
    socket.on('game:start', (p) => {
      setGrid(p.grid)
      setBoard(p.board)
      setPositions(p.positions)
      setCurrentTurn(p.currentTurn)
      setScores(p.scores)
      setStatus('Game started!')
    })
    socket.on('game:state', ({ positions, currentTurn, scores }) => {
      setPositions(positions)
      setCurrentTurn(currentTurn)
      setScores(scores)
    })
    socket.on('turn:tick', ({ remaining }) => setRemaining(remaining))
    socket.on('game:over', ({ winnerRole, winnerName, scores }) => {
      alert(`Winner: ${winnerName} (${winnerRole})`)
      setScores(scores)
      setStatus('Waiting for next game...')
    })
    socket.on('game:aborted', ({ reason }) => {
      alert(`Game aborted: ${reason}`)
    })
    socket.on('server:reset', ({ scores }) => {
      alert('Server reset.')
      setScores(scores)
    })

    return () => socket.off()
  }, [])

  function join() {
    if (!nickname.trim()) return
    socket.emit('set:nickname', nickname.trim())
  }

  function tryMove(r, c) {
    if (!role || role !== currentTurn) return
    socket.emit('move', { r, c })
  }

  return (
    <div className="container">
      <header>
        <h1>Escape Plan — React</h1>
      </header>

      <main className="layout">
        <aside className="panel">
          <label>Nickname</label>
          <div className="row">
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="Your name"
              maxLength={20}
            />
            <button onClick={join}>Join</button>
          </div>

          <Lobby players={players} queue={queue} />

          <div className="meta">
            <div>Status: {status}</div>
            <div>Your role: <strong>{role ? role.toUpperCase() : '-'}</strong></div>
            <div>Current turn: <strong>{currentTurn || '-'}</strong></div>
            <div>Time left: <strong>{remaining ?? '-'}</strong>s</div>
            <div>Scores — Warder: {scores.warder} | Prisoner: {scores.prisoner}</div>
          </div>
        </aside>

        <section className="boardWrap">
          <Board grid={grid} board={board} positions={positions} canMove={role===currentTurn} onCellClick={tryMove} />
          <p className="hint">Click an adjacent cell on your turn to move.</p>
        </section>
      </main>
    </div>
  )
}
