import { useState } from 'react'
import { Game, World, Camera2D } from '@cubeforge/react'
import { Player } from './components/Player'
import { Enemy } from './components/Enemy'
import { Ground } from './components/Ground'
import { Coin } from './components/Coin'
import type { EntityId } from '@cubeforge/react'

// ─── Level layout ────────────────────────────────────────────────────────────
// All positions are world-space center points, Y increases downward.

const GROUND_Y = 540
const W = 800

export function App() {
  const [score, setScore] = useState(0)
  const [coins] = useState<{ id: number; x: number; y: number }[]>(() => [
    { id: 1, x: 200, y: 380 },
    { id: 2, x: 350, y: 280 },
    { id: 3, x: 500, y: 380 },
    { id: 4, x: 630, y: 200 },
    { id: 5, x: 130, y: 200 },
  ])
  const [collectedCoins, setCollectedCoins] = useState<Set<number>>(new Set())

  function handleCoinCollect(_entityId: EntityId, coinId: number) {
    setCollectedCoins(prev => new Set([...prev, coinId]))
    setScore(s => s + 10)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* HUD — plain React, rendered outside the canvas */}
      <div style={{
        display: 'flex',
        gap: 32,
        padding: '8px 24px',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 8,
        fontSize: 14,
        letterSpacing: 1,
        color: '#eee',
        width: 800,
        justifyContent: 'space-between',
      }}>
        <span>CUBEFORGE ENGINE — platformer demo</span>
        <span>Score: <strong style={{ color: '#ffd54f' }}>{score}</strong></span>
      </div>

      <Game width={W} height={560} gravity={980}>
        <World background="#1a1a2e">
          <Camera2D followEntity="player" smoothing={0.88} background="#1a1a2e" />

          {/* Player */}
          <Player x={100} y={460} />

          {/* Enemies */}
          <Enemy x={380} y={460} patrolLeft={250} patrolRight={550} />
          <Enemy x={620} y={340} patrolLeft={540} patrolRight={720} />

          {/* Coins */}
          {coins
            .filter(c => !collectedCoins.has(c.id))
            .map(c => (
              <Coin
                key={c.id}
                x={c.x}
                y={c.y}
                onCollect={(eid) => handleCoinCollect(eid, c.id)}
              />
            ))
          }

          {/* ── Ground & Platforms ─────────────────────────────────────── */}
          {/* Main floor */}
          <Ground x={W / 2} y={GROUND_Y} width={W} height={28} color="#37474f" />

          {/* Left pillar */}
          <Ground x={80}  y={460} width={120} height={20} color="#455a64" />

          {/* Mid-left platform */}
          <Ground x={250} y={400} width={160} height={20} color="#455a64" />

          {/* Mid platform */}
          <Ground x={450} y={360} width={160} height={20} color="#455a64" />

          {/* High left */}
          <Ground x={130} y={280} width={140} height={20} color="#546e7a" />

          {/* High right */}
          <Ground x={640} y={280} width={160} height={20} color="#546e7a" />

          {/* Top center */}
          <Ground x={W / 2} y={200} width={120} height={20} color="#607d8b" />

          {/* Wall left */}
          <Ground x={0}  y={350} width={20} height={500} color="#263238" />
          {/* Wall right */}
          <Ground x={W} y={350} width={20} height={500} color="#263238" />
        </World>
      </Game>

      {/* Controls hint */}
      <p style={{ fontSize: 12, color: '#555', letterSpacing: 1 }}>
        WASD / Arrow Keys to move &nbsp;·&nbsp; Space / Up to jump &nbsp;·&nbsp; Collect yellow coins
      </p>
    </div>
  )
}
