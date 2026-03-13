import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 800
const H = 600
const PLAYER_SIZE = 20
const PLAYER_SPEED = 160
const ENEMY_SIZE = 16
const XP_SIZE = 8
const ATTACK_RADIUS = 80
const ATTACK_COOLDOWN = 0.8
const DT = 1 / 60

type GameState = 'idle' | 'playing' | 'levelup' | 'gameover'

interface Enemy {
  x: number; y: number; hp: number; maxHp: number; id: number; speed: number; size: number
}

interface XpGem {
  x: number; y: number; value: number; id: number
}

interface AttackAnim {
  x: number; y: number; radius: number; timer: number; id: number
}

interface Upgrade {
  name: string; desc: string; apply: () => void
}

// ─── App ────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [timer, setTimer] = useState(0)
  const [playerLevel, setPlayerLevel] = useState(1)
  const [upgrades, setUpgrades] = useState<Upgrade[]>([])

  const playerRef = useRef({ x: W / 2, y: H / 2 })
  const enemiesRef = useRef<Enemy[]>([])
  const xpGemsRef = useRef<XpGem[]>([])
  const attackAnimsRef = useRef<AttackAnim[]>([])
  const keysRef = useRef(new Set<string>())
  const nextIdRef = useRef(1)
  const attackTimerRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const gameTimerRef = useRef(0)
  const xpRef = useRef(0)
  const xpToNextRef = useRef(10)
  const killsRef = useRef(0)

  // Stats (upgradeable)
  const statsRef = useRef({
    attackRadius: ATTACK_RADIUS,
    attackCooldown: ATTACK_COOLDOWN,
    attackDamage: 1,
    speed: PLAYER_SPEED,
    pickupRadius: 40,
  })

  const [, forceRender] = useReducer(n => n + 1, 0)

  const generateUpgrades = useCallback((): Upgrade[] => {
    const stats = statsRef.current
    const all: Upgrade[] = [
      { name: 'ATK UP', desc: '+1 Damage', apply: () => { stats.attackDamage += 1 } },
      { name: 'RANGE UP', desc: '+20 Range', apply: () => { stats.attackRadius += 20 } },
      { name: 'SPEED UP', desc: '+30 Speed', apply: () => { stats.speed += 30 } },
      { name: 'FAST ATK', desc: '-0.1s Cooldown', apply: () => { stats.attackCooldown = Math.max(0.15, stats.attackCooldown - 0.1) } },
      { name: 'MAGNET', desc: '+20 Pickup Range', apply: () => { stats.pickupRadius += 20 } },
    ]
    // Pick 3 random
    const shuffled = all.sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 3)
  }, [])

  // Main loop
  useEffect(() => {
    if (gameState !== 'playing') return
    const id = setInterval(() => {
      const player = playerRef.current
      const keys = keysRef.current
      const stats = statsRef.current

      // Player movement
      let dx = 0, dy = 0
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy = -1
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy = 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx = -1
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx = 1
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      player.x = Math.max(PLAYER_SIZE / 2, Math.min(W - PLAYER_SIZE / 2, player.x + (dx / len) * stats.speed * DT))
      player.y = Math.max(PLAYER_SIZE / 2, Math.min(H - PLAYER_SIZE / 2, player.y + (dy / len) * stats.speed * DT))

      // Timer
      gameTimerRef.current += DT
      if (Math.floor(gameTimerRef.current) > Math.floor(gameTimerRef.current - DT)) {
        setTimer(Math.floor(gameTimerRef.current))
      }

      const difficulty = 1 + gameTimerRef.current / 30

      // Spawn enemies
      spawnTimerRef.current -= DT
      if (spawnTimerRef.current <= 0) {
        spawnTimerRef.current = Math.max(0.2, 1.5 - difficulty * 0.1)
        const count = Math.min(5, Math.floor(difficulty))
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2
          const dist = 350 + Math.random() * 100
          const isBig = Math.random() < 0.1 * difficulty
          enemiesRef.current.push({
            x: player.x + Math.cos(angle) * dist,
            y: player.y + Math.sin(angle) * dist,
            hp: isBig ? Math.ceil(difficulty * 2) : Math.ceil(difficulty * 0.5),
            maxHp: isBig ? Math.ceil(difficulty * 2) : Math.ceil(difficulty * 0.5),
            id: nextIdRef.current++,
            speed: 40 + difficulty * 5 + (isBig ? -10 : Math.random() * 20),
            size: isBig ? 24 : ENEMY_SIZE,
          })
        }
      }

      // Auto-attack
      attackTimerRef.current -= DT
      if (attackTimerRef.current <= 0) {
        attackTimerRef.current = stats.attackCooldown
        // Damage enemies in range
        const enemies = enemiesRef.current
        let hitAny = false
        enemies.forEach(e => {
          const edx = e.x - player.x
          const edy = e.y - player.y
          if (Math.sqrt(edx * edx + edy * edy) <= stats.attackRadius) {
            e.hp -= stats.attackDamage
            hitAny = true
          }
        })
        if (hitAny) {
          attackAnimsRef.current.push({
            x: player.x, y: player.y, radius: stats.attackRadius, timer: 0.2, id: nextIdRef.current++,
          })
        }
      }

      // Update attack anims
      attackAnimsRef.current = attackAnimsRef.current.filter(a => {
        a.timer -= DT
        return a.timer > 0
      })

      // Remove dead enemies, spawn XP
      const dead = enemiesRef.current.filter(e => e.hp <= 0)
      dead.forEach(e => {
        killsRef.current++
        setScore(s => s + 10)
        xpGemsRef.current.push({
          x: e.x + (Math.random() - 0.5) * 10,
          y: e.y + (Math.random() - 0.5) * 10,
          value: 1,
          id: nextIdRef.current++,
        })
      })
      enemiesRef.current = enemiesRef.current.filter(e => e.hp > 0)

      // Move enemies toward player
      enemiesRef.current.forEach(e => {
        const edx = player.x - e.x
        const edy = player.y - e.y
        const elen = Math.sqrt(edx * edx + edy * edy) || 1
        e.x += (edx / elen) * e.speed * DT
        e.y += (edy / elen) * e.speed * DT

        // Player collision
        if (Math.abs(e.x - player.x) < (PLAYER_SIZE + e.size) / 2 &&
            Math.abs(e.y - player.y) < (PLAYER_SIZE + e.size) / 2) {
          setGameState('gameover')
        }
      })

      // Collect XP gems
      xpGemsRef.current = xpGemsRef.current.filter(gem => {
        const gdx = gem.x - player.x
        const gdy = gem.y - player.y
        if (Math.sqrt(gdx * gdx + gdy * gdy) <= stats.pickupRadius) {
          xpRef.current += gem.value
          if (xpRef.current >= xpToNextRef.current) {
            xpRef.current -= xpToNextRef.current
            xpToNextRef.current = Math.ceil(xpToNextRef.current * 1.5)
            setPlayerLevel(l => l + 1)
            setUpgrades(generateUpgrades())
            setGameState('levelup')
          }
          return false
        }
        return true
      })

      forceRender()
    }, DT * 1000)
    return () => clearInterval(id)
  }, [gameState, generateUpgrades])

  // Input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code)
      if ((gameState === 'idle' || gameState === 'gameover') && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault(); restart()
      }
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [gameState])

  function restart() {
    playerRef.current = { x: W / 2, y: H / 2 }
    enemiesRef.current = []
    xpGemsRef.current = []
    attackAnimsRef.current = []
    keysRef.current.clear()
    attackTimerRef.current = 0
    spawnTimerRef.current = 1
    gameTimerRef.current = 0
    xpRef.current = 0
    xpToNextRef.current = 10
    killsRef.current = 0
    statsRef.current = {
      attackRadius: ATTACK_RADIUS, attackCooldown: ATTACK_COOLDOWN,
      attackDamage: 1, speed: PLAYER_SPEED, pickupRadius: 40,
    }
    setScore(0)
    setTimer(0)
    setPlayerLevel(1)
    setUpgrades([])
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  function pickUpgrade(idx: number) {
    upgrades[idx].apply()
    setGameState('playing')
  }

  const player = playerRef.current
  const enemies = enemiesRef.current
  const xpGems = xpGemsRef.current
  const attackAnims = attackAnimsRef.current
  const fmtTime = `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ fontSize: 11, color: '#607d8b' }}>LVL {playerLevel} &nbsp; KILLS {killsRef.current}</div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#69f0ae', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>{fmtTime}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 15 }}>{String(score).padStart(6, '0')}</span>
        </div>
      </div>

      {/* XP bar */}
      <div style={{ width: W, height: 4, background: '#1a1f2e' }}>
        <div style={{ width: `${(xpRef.current / xpToNextRef.current) * 100}%`, height: '100%', background: '#69f0ae', transition: 'width 0.1s' }} />
      </div>

      {/* Game */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0a0c14">
            <Camera2D x={W / 2} y={H / 2} background="#0a0c14" />

            {/* Attack radius animations */}
            {attackAnims.map(a => (
              <Entity key={`atk${a.id}`} tags={['attack']}>
                <Transform x={a.x} y={a.y} />
                <Sprite width={a.radius * 2} height={a.radius * 2} color="#4fc3f722" zIndex={1} />
              </Entity>
            ))}

            {/* XP gems */}
            {xpGems.map(gem => (
              <Entity key={`xp${gem.id}`} tags={['xp']}>
                <Transform x={gem.x} y={gem.y} />
                <Sprite width={XP_SIZE} height={XP_SIZE} color="#69f0ae" zIndex={3} />
              </Entity>
            ))}

            {/* Enemies */}
            {enemies.map(e => (
              <Entity key={`e${e.id}`} tags={['enemy']}>
                <Transform x={e.x} y={e.y} />
                <Sprite width={e.size} height={e.size} color={e.hp > 1 ? '#ff7043' : '#ef5350'} zIndex={5} />
              </Entity>
            ))}

            {/* Player */}
            <Entity tags={['player']}>
              <Transform x={player.x} y={player.y} />
              <Sprite width={PLAYER_SIZE} height={PLAYER_SIZE} color="#4fc3f7" zIndex={10} />
            </Entity>
          </World>
        </Game>

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#69f0ae', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 2 }}>SURVIVORS</p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* Level up overlay */}
        {gameState === 'levelup' && (
          <div style={overlayStyle}>
            <div style={{ ...cardStyle, padding: '24px 36px' }}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#fdd835', marginBottom: 12 }}>LEVEL UP!</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 20 }}>Choose an Upgrade</p>
              <div style={{ display: 'flex', gap: 12 }}>
                {upgrades.map((u, i) => (
                  <button key={i} onClick={() => pickUpgrade(i)} style={{
                    padding: '16px 20px', background: '#161d2a', border: '1px solid #1e2535',
                    borderRadius: 8, cursor: 'pointer', fontFamily: '"Courier New", monospace',
                    color: '#fff', textAlign: 'center', minWidth: 120,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#4fc3f7', marginBottom: 6 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: '#90a4ae' }}>{u.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Game over */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>OVERWHELMED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Survived &nbsp;<strong style={{ color: '#69f0ae' }}>{fmtTime}</strong>
                &nbsp;&middot;&nbsp; Score &nbsp;<strong style={{ color: '#4fc3f7' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>Level {playerLevel} &middot; {killsRef.current} kills</p>
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
        <span>WASD move &nbsp;&middot;&nbsp; Auto-attack nearby enemies &nbsp;&middot;&nbsp; Collect XP gems to level up</span>
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
  marginTop: 24, padding: '10px 32px', background: '#69f0ae', color: '#0a0a0f',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
