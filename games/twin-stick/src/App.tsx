import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 800
const H = 600
const PLAYER_SIZE = 24
const PLAYER_SPEED = 250
const BULLET_SPEED = 600
const BULLET_SIZE = 6
const ENEMY_SIZE = 18
const ENEMY_SPEED_BASE = 80
const SPAWN_INTERVAL = 1.2 // seconds
const SHOOT_COOLDOWN = 0.12 // seconds
const MAX_BULLETS = 50
const DT = 1 / 60

type GameState = 'idle' | 'playing' | 'gameover'

interface Bullet {
  x: number; y: number; vx: number; vy: number; id: number
}

interface Enemy {
  x: number; y: number; hp: number; id: number; size: number; speed: number; color: string
}

// ─── App ────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [wave, setWave] = useState(1)
  const [lives, setLives] = useState(3)
  const [gameState, setGameState] = useState<GameState>('idle')

  const playerRef = useRef({ x: W / 2, y: H / 2 })
  const bulletsRef = useRef<Bullet[]>([])
  const enemiesRef = useRef<Enemy[]>([])
  const keysRef = useRef(new Set<string>())
  const mouseRef = useRef({ x: W / 2, y: 0 })
  const shootTimerRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const waveTimerRef = useRef(0)
  const killsRef = useRef(0)
  const nextIdRef = useRef(1)
  const shootingRef = useRef(false)
  const invulnRef = useRef(0)

  const [, forceRender] = useReducer(n => n + 1, 0)

  const spawnEnemy = useCallback((waveNum: number) => {
    const side = Math.floor(Math.random() * 4)
    let x: number, y: number
    if (side === 0) { x = Math.random() * W; y = -20 }
    else if (side === 1) { x = Math.random() * W; y = H + 20 }
    else if (side === 2) { x = -20; y = Math.random() * H }
    else { x = W + 20; y = Math.random() * H }

    const isBig = Math.random() < 0.15 * waveNum / 5
    enemiesRef.current.push({
      x, y,
      hp: isBig ? 3 : 1,
      id: nextIdRef.current++,
      size: isBig ? 28 : ENEMY_SIZE,
      speed: ENEMY_SPEED_BASE + waveNum * 8 + (isBig ? -20 : Math.random() * 30),
      color: isBig ? '#ff7043' : '#ef5350',
    })
  }, [])

  // Main game loop
  useEffect(() => {
    if (gameState !== 'playing') return
    const id = setInterval(() => {
      const player = playerRef.current
      const keys = keysRef.current
      const mouse = mouseRef.current

      // Player movement
      let dx = 0, dy = 0
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy = -1
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy = 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx = -1
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx = 1
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      player.x = Math.max(PLAYER_SIZE / 2, Math.min(W - PLAYER_SIZE / 2, player.x + (dx / len) * PLAYER_SPEED * DT))
      player.y = Math.max(PLAYER_SIZE / 2, Math.min(H - PLAYER_SIZE / 2, player.y + (dy / len) * PLAYER_SPEED * DT))

      // Shooting
      shootTimerRef.current -= DT
      if ((shootingRef.current || keys.has('Space')) && shootTimerRef.current <= 0 && bulletsRef.current.length < MAX_BULLETS) {
        shootTimerRef.current = SHOOT_COOLDOWN
        const aimDx = mouse.x - player.x
        const aimDy = mouse.y - player.y
        const aimLen = Math.sqrt(aimDx * aimDx + aimDy * aimDy) || 1
        bulletsRef.current.push({
          x: player.x, y: player.y,
          vx: (aimDx / aimLen) * BULLET_SPEED,
          vy: (aimDy / aimLen) * BULLET_SPEED,
          id: nextIdRef.current++,
        })
      }

      // Update bullets
      bulletsRef.current = bulletsRef.current.filter(b => {
        b.x += b.vx * DT
        b.y += b.vy * DT
        return b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10
      })

      // Spawn enemies
      spawnTimerRef.current -= DT
      if (spawnTimerRef.current <= 0) {
        spawnTimerRef.current = Math.max(0.3, SPAWN_INTERVAL - wave * 0.08)
        const count = 1 + Math.floor(wave / 3)
        for (let i = 0; i < count; i++) spawnEnemy(wave)
      }

      // Wave timer
      waveTimerRef.current += DT
      if (killsRef.current >= wave * 8 + 5) {
        setWave(w => w + 1)
        killsRef.current = 0
        waveTimerRef.current = 0
      }

      // Invuln timer
      if (invulnRef.current > 0) invulnRef.current -= DT

      // Update enemies + collision
      const bullets = bulletsRef.current
      const enemies = enemiesRef.current
      const bulletsToRemove = new Set<number>()
      const enemiesToRemove = new Set<number>()

      enemies.forEach(enemy => {
        // Move toward player
        const edx = player.x - enemy.x
        const edy = player.y - enemy.y
        const elen = Math.sqrt(edx * edx + edy * edy) || 1
        enemy.x += (edx / elen) * enemy.speed * DT
        enemy.y += (edy / elen) * enemy.speed * DT

        // Bullet collision
        bullets.forEach(b => {
          const bdx = b.x - enemy.x
          const bdy = b.y - enemy.y
          if (Math.abs(bdx) < (enemy.size + BULLET_SIZE) / 2 && Math.abs(bdy) < (enemy.size + BULLET_SIZE) / 2) {
            enemy.hp--
            bulletsToRemove.add(b.id)
            if (enemy.hp <= 0) {
              enemiesToRemove.add(enemy.id)
              killsRef.current++
              setScore(s => s + (enemy.size > ENEMY_SIZE ? 30 : 10))
            }
          }
        })

        // Player collision
        if (invulnRef.current <= 0) {
          const pdx = player.x - enemy.x
          const pdy = player.y - enemy.y
          if (Math.abs(pdx) < (PLAYER_SIZE + enemy.size) / 2 && Math.abs(pdy) < (PLAYER_SIZE + enemy.size) / 2) {
            enemiesToRemove.add(enemy.id)
            invulnRef.current = 1.5
            setLives(l => {
              const nl = l - 1
              if (nl <= 0) setGameState('gameover')
              return Math.max(0, nl)
            })
          }
        }
      })

      bulletsRef.current = bullets.filter(b => !bulletsToRemove.has(b.id))
      enemiesRef.current = enemies.filter(e => !enemiesToRemove.has(e.id))

      forceRender()
    }, DT * 1000)
    return () => clearInterval(id)
  }, [gameState, wave, spawnEnemy])

  // Input handlers
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code)
      if ((gameState === 'idle' || gameState === 'gameover') && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault()
        restart()
      }
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [gameState])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const handleMouseDown = useCallback(() => { shootingRef.current = true }, [])
  const handleMouseUp = useCallback(() => { shootingRef.current = false }, [])

  function restart() {
    playerRef.current = { x: W / 2, y: H / 2 }
    bulletsRef.current = []
    enemiesRef.current = []
    keysRef.current.clear()
    shootTimerRef.current = 0
    spawnTimerRef.current = 1
    waveTimerRef.current = 0
    killsRef.current = 0
    invulnRef.current = 0
    shootingRef.current = false
    setScore(0)
    setWave(1)
    setLives(3)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  const player = playerRef.current
  const bullets = bulletsRef.current
  const enemies = enemiesRef.current
  const isFlashing = invulnRef.current > 0 && Math.floor(invulnRef.current * 8) % 2 === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} style={{ color: i < lives ? '#ef5350' : '#37474f', fontSize: 18 }}>&#9829;</span>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>
            {String(score).padStart(6, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>WAVE {wave}</div>
      </div>

      {/* Game */}
      <div
        style={{ position: 'relative', width: W, height: H, cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0a0c14">
            <Camera2D x={W / 2} y={H / 2} background="#0a0c14" />

            {/* Player */}
            <Entity tags={['player']}>
              <Transform x={player.x} y={player.y} />
              <Sprite
                width={PLAYER_SIZE}
                height={PLAYER_SIZE}
                color={isFlashing ? '#0a0c14' : '#4fc3f7'}
                zIndex={10}
              />
            </Entity>

            {/* Bullets */}
            {bullets.map(b => (
              <Entity key={`b${b.id}`} tags={['bullet']}>
                <Transform x={b.x} y={b.y} />
                <Sprite width={BULLET_SIZE} height={BULLET_SIZE} color="#fdd835" zIndex={8} />
              </Entity>
            ))}

            {/* Enemies */}
            {enemies.map(e => (
              <Entity key={`e${e.id}`} tags={['enemy']}>
                <Transform x={e.x} y={e.y} />
                <Sprite width={e.size} height={e.size} color={e.color} zIndex={5} />
              </Entity>
            ))}

            {/* Crosshair */}
            <Entity tags={['crosshair']}>
              <Transform x={mouseRef.current.x} y={mouseRef.current.y} />
              <Sprite width={2} height={16} color="#ffffff44" zIndex={15} />
            </Entity>
            <Entity tags={['crosshair']}>
              <Transform x={mouseRef.current.x} y={mouseRef.current.y} />
              <Sprite width={16} height={2} color="#ffffff44" zIndex={15} />
            </Entity>
          </World>
        </Game>

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>TWIN-STICK</p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* Game over */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>DESTROYED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#4fc3f7' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>Reached Wave {wave}</p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>WASD move &nbsp;&middot;&nbsp; Mouse aim &nbsp;&middot;&nbsp; Click / Space shoot</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: 'rgba(10,10,18,0.82)', backdropFilter: 'blur(4px)',
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace', padding: '36px 48px',
  background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 24, padding: '10px 32px', background: '#4fc3f7', color: '#0a0a0f',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
