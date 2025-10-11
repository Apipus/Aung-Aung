import React from 'react'

export default function Lobby({ players=[], queue=[] }) {
  return (
    <div className="lobby">
      <h3>Lobby</h3>
      <ul>
        {players.map(p => <li key={p.id}>{p.nickname || '(unnamed)'}</li>)}
      </ul>
      <h3>Queue</h3>
      <ol>
        {queue.map((q, idx) => <li key={q.id}>{idx===0 ? 'NEXT — ' : ''}{q.nickname}</li>)}
      </ol>
    </div>
  )
}
