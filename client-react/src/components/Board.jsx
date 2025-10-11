import React from 'react'

export default function Board({ grid=5, board=[], positions=null, onCellClick=()=>{}, canMove=false }) {
  return (
    <div className={`board ${canMove ? 'myturn' : ''}`} style={{ '--grid': grid }}>
      {Array.from({ length: grid }).map((_, r) =>
        Array.from({ length: grid }).map((_, c) => {
          const type = board?.[r]?.[c]?.type
          const isWarder = positions?.warden?.r === r && positions?.warden?.c === c
          const isPrisoner = positions?.prisoner?.r === r && positions?.prisoner?.c === c
          return (
            <div
              key={`${r}-${c}`}
              className={`cell ${type === 'obstacle' ? 'obstacle' : ''} ${type === 'tunnel' ? 'tunnel' : ''}`}
              onClick={() => onCellClick(r, c)}
            >
              {isWarder ? '🔒' : isPrisoner ? '🧍' : ''}
            </div>
          )
        })
      )}
    </div>
  )
}
