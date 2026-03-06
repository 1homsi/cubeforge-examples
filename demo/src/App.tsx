import { useState } from 'react'
import { Game, World, Camera2D } from '@cubeforge/react'
import { Player } from './entities/Player'
import { Enemy } from './entities/Enemy'
import { Platform } from './entities/Platform'

const W = 900
const H = 560

export function App() {
  const [score] = useState(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>

      {/* ── HUD ── */}
      <div style={{
        width: W,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 16px',
        background: '#111318',
        borderRadius: '8px 8px 0 0',
        fontSize: 13,
        letterSpacing: 1.5,
        color: '#78909c',
      }}>
        <span style={{ color: '#4fc3f7', fontWeight: 700 }}>CUBEFORGE</span>
        <span>
          Score&nbsp;
          <span style={{ color: '#ffd54f', fontWeight: 700 }}>{String(score).padStart(5, '0')}</span>
        </span>
        <span style={{ fontSize: 11 }}>WASD / Arrows · Space to jump</span>
      </div>

      {/* ── Engine Canvas ── */}
      <Game width={W} height={H} gravity={1000} style={{ borderRadius: '0 0 8px 8px', display: 'block' }}>
        <World background="#12131f">

          {/* Camera follows player with smooth lerp */}
          <Camera2D followEntity="player" zoom={1} smoothing={0.87} background="#12131f" />

          {/* ── Player ── */}
          <Player x={100} y={420} />

          {/* ── Enemies ── */}
          <Enemy x={380} y={420} patrolLeft={270} patrolRight={520} />
          <Enemy x={660} y={300} patrolLeft={560} patrolRight={760} />
          <Enemy x={200} y={220} patrolLeft={110} patrolRight={310} />

          {/* ── Level geometry ── */}

          {/* Floor */}
          <Platform x={W / 2} y={500} width={W + 40} height={32} color="#263238" />

          {/* Left ledge */}
          <Platform x={90}  y={440} width={140} height={18} color="#37474f" />

          {/* Mid-left */}
          <Platform x={280} y={380} width={180} height={18} color="#37474f" />

          {/* Center */}
          <Platform x={490} y={330} width={160} height={18} color="#455a64" />

          {/* Right high */}
          <Platform x={700} y={270} width={180} height={18} color="#455a64" />

          {/* Left high */}
          <Platform x={160} y={250} width={160} height={18} color="#546e7a" />

          {/* Very top center */}
          <Platform x={W / 2} y={180} width={140} height={18} color="#607d8b" />

          {/* Walls */}
          <Platform x={-10}   y={H / 2} width={20}  height={H + 100} color="#1a1a2e" />
          <Platform x={W + 10} y={H / 2} width={20} height={H + 100} color="#1a1a2e" />

        </World>
      </Game>

      <p style={{ fontSize: 11, color: '#37474f', letterSpacing: 1.5 }}>
        Built with Cubeforge · React browser game engine
      </p>
    </div>
  )
}
