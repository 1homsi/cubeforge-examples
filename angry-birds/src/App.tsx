import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 800
const H = 450
const GROUND_Y = H - 40
const GRAVITY = 600
const DT = 1 / 60
const SLING_X = 130
const SLING_Y = GROUND_Y - 60
const MAX_BIRDS = 3
const LAUNCH_POWER = 8

type GameState = 'idle' | 'aiming' | 'flying' | 'settling' | 'gameover' | 'win'

interface Bird {
  x: number; y: number; vx: number; vy: number; active: boolean; landed: boolean
}

interface Block {
  x: number; y: number; w: number; h: number; hp: number; id: number; color: string; vx: number; vy: number
}

interface Target {
  x: number; y: number; alive: boolean; id: number
}

// ─── Level builder ──────────────────────────────────────────────────────────
function buildLevel(): { blocks: Block[]; targets: Target[] } {
  let nextId = 1
  const blocks: Block[] = []
  const targets: Target[] = []

  // Tower 1 at x=500
  blocks.push({ x: 480, y: GROUND_Y - 20, w: 20, h: 40, hp: 2, id: nextId++, color: '#8d6e63', vx: 0, vy: 0 })
  blocks.push({ x: 520, y: GROUND_Y - 20, w: 20, h: 40, hp: 2, id: nextId++, color: '#8d6e63', vx: 0, vy: 0 })
  blocks.push({ x: 500, y: GROUND_Y - 48, w: 60, h: 12, hp: 1, id: nextId++, color: '#a1887f', vx: 0, vy: 0 })
  targets.push({ x: 500, y: GROUND_Y - 62, alive: true, id: nextId++ })

  // Tower 2 at x=620
  blocks.push({ x: 600, y: GROUND_Y - 20, w: 20, h: 40, hp: 2, id: nextId++, color: '#8d6e63', vx: 0, vy: 0 })
  blocks.push({ x: 640, y: GROUND_Y - 20, w: 20, h: 40, hp: 2, id: nextId++, color: '#8d6e63', vx: 0, vy: 0 })
  blocks.push({ x: 620, y: GROUND_Y - 48, w: 60, h: 12, hp: 1, id: nextId++, color: '#a1887f', vx: 0, vy: 0 })
  targets.push({ x: 620, y: GROUND_Y - 62, alive: true, id: nextId++ })

  // Tower 3 (tall) at x=720
  blocks.push({ x: 700, y: GROUND_Y - 25, w: 20, h: 50, hp: 3, id: nextId++, color: '#6d4c41', vx: 0, vy: 0 })
  blocks.push({ x: 740, y: GROUND_Y - 25, w: 20, h: 50, hp: 3, id: nextId++, color: '#6d4c41', vx: 0, vy: 0 })
  blocks.push({ x: 720, y: GROUND_Y - 58, w: 60, h: 12, hp: 1, id: nextId++, color: '#a1887f', vx: 0, vy: 0 })
  blocks.push({ x: 720, y: GROUND_Y - 78, w: 30, h: 28, hp: 2, id: nextId++, color: '#8d6e63', vx: 0, vy: 0 })
  targets.push({ x: 720, y: GROUND_Y - 98, alive: true, id: nextId++ })

  return { blocks, targets }
}

// ─── App ────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [birdsLeft, setBirdsLeft] = useState(MAX_BIRDS)
  const [gameState, setGameState] = useState<GameState>('idle')

  const birdRef = useRef<Bird>({ x: SLING_X, y: SLING_Y, vx: 0, vy: 0, active: false, landed: false })
  const blocksRef = useRef<Block[]>([])
  const targetsRef = useRef<Target[]>([])
  const aimRef = useRef({ dragging: false, startX: 0, startY: 0, curX: 0, curY: 0 })
  const settleTimerRef = useRef(0)

  const [, forceRender] = useReducer(n => n + 1, 0)

  const initLevel = useCallback(() => {
    const { blocks, targets } = buildLevel()
    blocksRef.current = blocks
    targetsRef.current = targets
    birdRef.current = { x: SLING_X, y: SLING_Y, vx: 0, vy: 0, active: false, landed: false }
  }, [])

  // Physics loop
  useEffect(() => {
    if (gameState !== 'flying' && gameState !== 'settling') return
    const id = setInterval(() => {
      const bird = birdRef.current
      const blocks = blocksRef.current
      const targets = targetsRef.current

      if (bird.active && !bird.landed) {
        // Apply gravity
        bird.vy += GRAVITY * DT
        bird.x += bird.vx * DT
        bird.y += bird.vy * DT

        // Ground collision
        if (bird.y >= GROUND_Y - 8) {
          bird.y = GROUND_Y - 8
          bird.vy = 0
          bird.vx *= 0.7
          if (Math.abs(bird.vx) < 5) {
            bird.vx = 0
            bird.landed = true
          }
        }

        // Off-screen
        if (bird.x > W + 20 || bird.x < -20) {
          bird.landed = true
        }

        // Bird vs blocks
        blocks.forEach(block => {
          if (block.hp <= 0) return
          const dx = bird.x - block.x
          const dy = bird.y - block.y
          if (Math.abs(dx) < (16 + block.w) / 2 && Math.abs(dy) < (16 + block.h) / 2) {
            block.hp--
            // Transfer momentum
            block.vx += bird.vx * 0.3
            block.vy += bird.vy * 0.3
            bird.vx *= 0.4
            bird.vy *= -0.3
            setScore(s => s + 50)
          }
        })

        // Bird vs targets
        targets.forEach(t => {
          if (!t.alive) return
          if (Math.abs(bird.x - t.x) < 20 && Math.abs(bird.y - t.y) < 20) {
            t.alive = false
            setScore(s => s + 500)
          }
        })
      }

      // Block physics
      blocks.forEach(block => {
        if (block.hp <= 0) return
        // Simple gravity for blocks that have been hit
        if (Math.abs(block.vx) > 0.5 || Math.abs(block.vy) > 0.5) {
          block.vy += GRAVITY * DT * 0.5
          block.x += block.vx * DT
          block.y += block.vy * DT
          block.vx *= 0.98
          if (block.y + block.h / 2 >= GROUND_Y) {
            block.y = GROUND_Y - block.h / 2
            block.vy = 0
            block.vx *= 0.8
          }
        }

        // Block vs block collision (simple)
        blocks.forEach(other => {
          if (other === block || other.hp <= 0) return
          const bdx = block.x - other.x
          const bdy = block.y - other.y
          const overlapX = (block.w + other.w) / 2 - Math.abs(bdx)
          const overlapY = (block.h + other.h) / 2 - Math.abs(bdy)
          if (overlapX > 0 && overlapY > 0) {
            if (Math.abs(block.vx) + Math.abs(block.vy) > 20) {
              other.hp--
              other.vx += block.vx * 0.3
              other.vy += block.vy * 0.3
              block.vx *= 0.5
              setScore(s => s + 30)
            }
          }
        })

        // Block falling on target
        targets.forEach(t => {
          if (!t.alive) return
          if (Math.abs(block.x - t.x) < (block.w + 16) / 2 && Math.abs(block.y - t.y) < (block.h + 16) / 2) {
            if (Math.abs(block.vy) > 20) {
              t.alive = false
              setScore(s => s + 500)
            }
          }
        })
      })

      // Settling: check if bird landed and things stopped moving
      if (bird.landed || gameState === 'settling') {
        settleTimerRef.current += DT
        if (settleTimerRef.current > 1.5) {
          // Check win/lose
          const aliveTargets = targets.filter(t => t.alive).length
          if (aliveTargets === 0) {
            setGameState('win')
          } else if (birdsLeft <= 0) {
            setGameState('gameover')
          } else {
            // Next bird
            birdRef.current = { x: SLING_X, y: SLING_Y, vx: 0, vy: 0, active: false, landed: false }
            setGameState('aiming')
          }
          settleTimerRef.current = 0
        }
      }

      forceRender()
    }, DT * 1000)
    return () => clearInterval(id)
  }, [gameState, birdsLeft])

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (gameState !== 'aiming') return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    // Only start drag near slingshot
    if (Math.abs(mx - SLING_X) < 60 && Math.abs(my - SLING_Y) < 60) {
      aimRef.current = { dragging: true, startX: SLING_X, startY: SLING_Y, curX: mx, curY: my }
    }
  }, [gameState])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!aimRef.current.dragging) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    // Limit drag distance
    const ddx = SLING_X - mx
    const ddy = SLING_Y - my
    const dist = Math.sqrt(ddx * ddx + ddy * ddy)
    const maxDist = 80
    if (dist > maxDist) {
      aimRef.current.curX = SLING_X - (ddx / dist) * maxDist
      aimRef.current.curY = SLING_Y - (ddy / dist) * maxDist
    } else {
      aimRef.current.curX = mx
      aimRef.current.curY = my
    }
    birdRef.current.x = aimRef.current.curX
    birdRef.current.y = aimRef.current.curY
    forceRender()
  }, [])

  const handleMouseUp = useCallback(() => {
    if (!aimRef.current.dragging) return
    aimRef.current.dragging = false
    const aim = aimRef.current
    const bird = birdRef.current
    const ddx = SLING_X - aim.curX
    const ddy = SLING_Y - aim.curY
    if (Math.sqrt(ddx * ddx + ddy * ddy) < 10) {
      // Too short, cancel
      bird.x = SLING_X
      bird.y = SLING_Y
      forceRender()
      return
    }
    bird.vx = ddx * LAUNCH_POWER
    bird.vy = ddy * LAUNCH_POWER
    bird.active = true
    setBirdsLeft(b => b - 1)
    settleTimerRef.current = 0
    setGameState('flying')
    forceRender()
  }, [])

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((gameState === 'idle' || gameState === 'gameover' || gameState === 'win') &&
          (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault(); restart()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gameState])

  function restart() {
    initLevel()
    setBirdsLeft(MAX_BIRDS)
    setScore(0)
    settleTimerRef.current = 0
    setGameState('aiming')
    setGameKey(k => k + 1)
  }

  const bird = birdRef.current
  const blocks = blocksRef.current
  const targets = targetsRef.current
  const aim = aimRef.current
  const aliveTargets = targets.filter(t => t.alive).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ fontSize: 11, color: '#607d8b' }}>
          BIRDS {birdsLeft} &nbsp;&middot;&nbsp; TARGETS {aliveTargets}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ff7043', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>
            {String(score).padStart(5, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>ANGRY BIRDS</div>
      </div>

      {/* Game */}
      <div
        style={{ position: 'relative', width: W, height: H, cursor: gameState === 'aiming' ? 'grab' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#1a2744">
            <Camera2D x={W / 2} y={H / 2} background="#1a2744" />

            {/* Ground */}
            <Entity tags={['ground']}>
              <Transform x={W / 2} y={GROUND_Y + 20} />
              <Sprite width={W} height={40} color="#2e7d32" zIndex={1} />
            </Entity>

            {/* Slingshot */}
            <Entity tags={['sling']}>
              <Transform x={SLING_X} y={SLING_Y + 20} />
              <Sprite width={8} height={50} color="#5d4037" zIndex={2} />
            </Entity>
            <Entity tags={['sling']}>
              <Transform x={SLING_X - 10} y={SLING_Y - 10} />
              <Sprite width={6} height={20} color="#6d4c41" zIndex={3} />
            </Entity>
            <Entity tags={['sling']}>
              <Transform x={SLING_X + 10} y={SLING_Y - 10} />
              <Sprite width={6} height={20} color="#6d4c41" zIndex={3} />
            </Entity>

            {/* Aim line */}
            {aim.dragging && (
              <Entity tags={['aimline']}>
                <Transform x={(SLING_X + aim.curX) / 2} y={(SLING_Y + aim.curY) / 2} />
                <Sprite width={2} height={Math.sqrt((SLING_X - aim.curX) ** 2 + (SLING_Y - aim.curY) ** 2)} color="#ffffff44" zIndex={4} />
              </Entity>
            )}

            {/* Bird */}
            <Entity tags={['bird']}>
              <Transform x={bird.x} y={bird.y} />
              <Sprite width={16} height={16} color="#ef5350" zIndex={10} />
            </Entity>

            {/* Birds left indicator */}
            {Array.from({ length: birdsLeft }, (_, i) => (
              <Entity key={`bl${i}`} tags={['birdLeft']}>
                <Transform x={30 + i * 20} y={GROUND_Y + 20} />
                <Sprite width={10} height={10} color="#ef5350" zIndex={5} />
              </Entity>
            ))}

            {/* Blocks */}
            {blocks.filter(b => b.hp > 0).map(block => (
              <Entity key={`block${block.id}`} tags={['block']}>
                <Transform x={block.x} y={block.y} />
                <Sprite
                  width={block.w}
                  height={block.h}
                  color={block.hp >= 3 ? '#5d4037' : block.hp >= 2 ? block.color : '#bcaaa4'}
                  zIndex={5}
                />
              </Entity>
            ))}

            {/* Targets (pigs) */}
            {targets.filter(t => t.alive).map(t => (
              <Entity key={`target${t.id}`} tags={['target']}>
                <Transform x={t.x} y={t.y} />
                <Sprite width={16} height={16} color="#66bb6a" zIndex={6} />
              </Entity>
            ))}
          </World>
        </Game>

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ff7043', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>ANGRY BIRDS</p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* Win */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#66bb6a', marginBottom: 8 }}>ALL TARGETS DOWN</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0' }}>
                Score &nbsp;<strong style={{ color: '#ff7043' }}>{score}</strong>
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}

        {/* Game over */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>NO BIRDS LEFT</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ff7043' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>{aliveTargets} target(s) remaining</p>
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
        <span>Click &amp; drag slingshot to aim &nbsp;&middot;&nbsp; Release to launch &nbsp;&middot;&nbsp; Hit all green targets</span>
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
  marginTop: 24, padding: '10px 32px', background: '#ff7043', color: '#fff',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
