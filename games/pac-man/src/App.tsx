import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const CELL     = 20
const COLS     = 21
const ROWS     = 23
const W        = COLS * CELL   // 420
const H        = ROWS * CELL   // 460
const TICK_MS  = 150
const POWER_DURATION = 40 // ticks
const GHOST_COLORS = ['#ef5350', '#f48fb1', '#4fc3f7', '#ffb74d']

type Dir = { x: number; y: number }
type GameState = 'idle' | 'playing' | 'gameover' | 'win'

// ─── Maze (1=wall, 0=dot, 2=power, 3=empty, 4=ghost-house) ─────────────────
const MAZE_TEMPLATE = [
  '111111111111111111111',
  '100000001010000000001',
  '101110101010101011101',
  '120100000000000010021',
  '101011101110111010101',
  '100000001010000000001',
  '111011100010001110111',
  '333011133333331110333',
  '111011101111101110111',
  '000000103444301000000',
  '111011101111101110111',
  '333011133333331110333',
  '111011101110101110111',
  '100000000010000000001',
  '101110111010111011101',
  '120010000000000100021',
  '110110101110101011011',
  '100000101010100000001',
  '101111101010101111101',
  '100000000000000000001',
  '101011101110111010101',
  '100000001010000000001',
  '111111111111111111111',
]

function parseMaze(): number[][] {
  return MAZE_TEMPLATE.map(row => row.split('').map(Number))
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const DIRS: Dir[] = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]

function canMove(maze: number[][], x: number, y: number): boolean {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true // tunnel
  const c = maze[y][x]
  return c !== 1
}

function wrap(x: number, y: number): [number, number] {
  return [((x % COLS) + COLS) % COLS, ((y % ROWS) + ROWS) % ROWS]
}

interface Ghost {
  x: number; y: number; dir: Dir; color: string; scared: boolean
}

// ─── App ────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [gameState, setGameState] = useState<GameState>('idle')

  const mazeRef = useRef(parseMaze())
  const playerRef = useRef({ x: 10, y: 16 })
  const dirRef = useRef<Dir>({ x: 0, y: 0 })
  const nextDirRef = useRef<Dir>({ x: 0, y: 0 })
  const ghostsRef = useRef<Ghost[]>([])
  const powerRef = useRef(0)
  const ghostComboRef = useRef(0)
  const dotsLeftRef = useRef(0)

  const [, forceRender] = useReducer(n => n + 1, 0)

  const initGame = useCallback(() => {
    const maze = parseMaze()
    mazeRef.current = maze
    playerRef.current = { x: 10, y: 16 }
    dirRef.current = { x: 0, y: 0 }
    nextDirRef.current = { x: 0, y: 0 }
    powerRef.current = 0
    ghostComboRef.current = 0
    // Count dots
    let dots = 0
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (maze[r][c] === 0 || maze[r][c] === 2) dots++
    dotsLeftRef.current = dots
    // Init ghosts
    ghostsRef.current = [
      { x: 9, y: 9, dir: { x: 0, y: -1 }, color: GHOST_COLORS[0], scared: false },
      { x: 10, y: 9, dir: { x: 0, y: -1 }, color: GHOST_COLORS[1], scared: false },
      { x: 11, y: 9, dir: { x: 0, y: -1 }, color: GHOST_COLORS[2], scared: false },
      { x: 10, y: 10, dir: { x: 1, y: 0 }, color: GHOST_COLORS[3], scared: false },
    ]
  }, [])

  // Tick
  useEffect(() => {
    if (gameState !== 'playing') return
    const id = setInterval(() => {
      const maze = mazeRef.current
      const player = playerRef.current
      const nextDir = nextDirRef.current

      // Try next dir first
      const nx = player.x + nextDir.x
      const ny = player.y + nextDir.y
      if (canMove(maze, ...wrap(nx, ny))) {
        dirRef.current = nextDir
      }
      const dir = dirRef.current
      const mx = player.x + dir.x
      const my = player.y + dir.y
      const [wmx, wmy] = wrap(mx, my)
      if (canMove(maze, wmx, wmy)) {
        playerRef.current = { x: wmx, y: wmy }
      }

      const p = playerRef.current
      // Eat dot
      const cell = maze[p.y]?.[p.x]
      if (cell === 0) {
        maze[p.y][p.x] = 3
        setScore(s => s + 10)
        dotsLeftRef.current--
      } else if (cell === 2) {
        maze[p.y][p.x] = 3
        setScore(s => s + 50)
        dotsLeftRef.current--
        powerRef.current = POWER_DURATION
        ghostComboRef.current = 0
        ghostsRef.current.forEach(g => g.scared = true)
      }

      // Win check
      if (dotsLeftRef.current <= 0) {
        setGameState('win')
        forceRender()
        return
      }

      // Power countdown
      if (powerRef.current > 0) {
        powerRef.current--
        if (powerRef.current <= 0) {
          ghostsRef.current.forEach(g => g.scared = false)
        }
      }

      // Move ghosts
      const ghosts = ghostsRef.current
      ghosts.forEach(ghost => {
        // Simple AI: random valid direction, prefer toward player when not scared
        const validDirs = DIRS.filter(d => {
          const gx = ghost.x + d.x
          const gy = ghost.y + d.y
          const [wgx, wgy] = wrap(gx, gy)
          return canMove(maze, wgx, wgy) && !(d.x === -ghost.dir.x && d.y === -ghost.dir.y)
        })

        if (validDirs.length > 0) {
          let chosen: Dir
          if (ghost.scared) {
            // Run away: pick direction away from player
            chosen = validDirs.reduce((best, d) => {
              const dist = Math.abs(ghost.x + d.x - p.x) + Math.abs(ghost.y + d.y - p.y)
              const bestDist = Math.abs(ghost.x + best.x - p.x) + Math.abs(ghost.y + best.y - p.y)
              return dist > bestDist ? d : best
            })
          } else {
            // Chase: 70% chance to move toward player, 30% random
            if (Math.random() < 0.7) {
              chosen = validDirs.reduce((best, d) => {
                const dist = Math.abs(ghost.x + d.x - p.x) + Math.abs(ghost.y + d.y - p.y)
                const bestDist = Math.abs(ghost.x + best.x - p.x) + Math.abs(ghost.y + best.y - p.y)
                return dist < bestDist ? d : best
              })
            } else {
              chosen = validDirs[Math.floor(Math.random() * validDirs.length)]
            }
          }
          ghost.dir = chosen
          const [wgx, wgy] = wrap(ghost.x + chosen.x, ghost.y + chosen.y)
          ghost.x = wgx
          ghost.y = wgy
        }

        // Collision with player
        if (ghost.x === p.x && ghost.y === p.y) {
          if (ghost.scared) {
            // Eat ghost
            ghost.x = 10; ghost.y = 9; ghost.scared = false
            ghostComboRef.current++
            const bonus = 200 * Math.pow(2, ghostComboRef.current - 1)
            setScore(s => s + bonus)
          } else {
            // Player dies
            setLives(l => {
              const nl = l - 1
              if (nl <= 0) {
                setGameState('gameover')
              } else {
                playerRef.current = { x: 10, y: 16 }
                dirRef.current = { x: 0, y: 0 }
                nextDirRef.current = { x: 0, y: 0 }
              }
              return Math.max(0, nl)
            })
          }
        }
      })

      forceRender()
    }, TICK_MS)
    return () => clearInterval(id)
  }, [gameState])

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (gameState === 'idle' || gameState === 'gameover' || gameState === 'win') {
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); restart() }
        return
      }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') nextDirRef.current = { x: 0, y: -1 }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') nextDirRef.current = { x: 0, y: 1 }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') nextDirRef.current = { x: -1, y: 0 }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') nextDirRef.current = { x: 1, y: 0 }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gameState])

  function restart() {
    initGame()
    setScore(0)
    setLives(3)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  const maze = mazeRef.current
  const player = playerRef.current
  const ghosts = ghostsRef.current
  const cx = (col: number) => col * CELL + CELL / 2
  const cy = (row: number) => row * CELL + CELL / 2

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
            <span key={i} style={{ color: i < lives ? '#fdd835' : '#37474f', fontSize: 16 }}>&#9679;</span>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#fdd835', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>
            {String(score).padStart(6, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>
          DOTS {dotsLeftRef.current}
        </div>
      </div>

      {/* Game */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#000010">
            <Camera2D x={W / 2} y={H / 2} background="#000010" />

            {/* Maze walls and dots */}
            {maze.map((row, r) =>
              row.map((cell, c) => {
                if (cell === 1) {
                  return (
                    <Entity key={`w${r}-${c}`} tags={['wall']}>
                      <Transform x={cx(c)} y={cy(r)} />
                      <Sprite width={CELL} height={CELL} color="#1a237e" zIndex={1} />
                    </Entity>
                  )
                }
                if (cell === 0) {
                  return (
                    <Entity key={`d${r}-${c}`} tags={['dot']}>
                      <Transform x={cx(c)} y={cy(r)} />
                      <Sprite width={4} height={4} color="#ffecb3" zIndex={2} />
                    </Entity>
                  )
                }
                if (cell === 2) {
                  return (
                    <Entity key={`p${r}-${c}`} tags={['power']}>
                      <Transform x={cx(c)} y={cy(r)} />
                      <Sprite width={10} height={10} color="#ffab00" zIndex={2} />
                    </Entity>
                  )
                }
                return null
              })
            )}

            {/* Player (Pac-Man) */}
            <Entity tags={['player']}>
              <Transform x={cx(player.x)} y={cy(player.y)} />
              <Sprite width={CELL - 4} height={CELL - 4} color="#fdd835" zIndex={10} />
            </Entity>

            {/* Ghosts */}
            {ghosts.map((g, i) => (
              <Entity key={`ghost${i}`} tags={['ghost']}>
                <Transform x={cx(g.x)} y={cy(g.y)} />
                <Sprite
                  width={CELL - 4}
                  height={CELL - 4}
                  color={g.scared ? '#2196f3' : g.color}
                  zIndex={9}
                />
              </Entity>
            ))}
          </World>
        </Game>

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#fdd835', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>PAC-MAN</p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* Win overlay */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#fdd835', marginBottom: 8 }}>ALL DOTS EATEN</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0' }}>
                Score &nbsp;<strong style={{ color: '#fdd835' }}>{score}</strong>
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>NO LIVES LEFT</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0' }}>
                Score &nbsp;<strong style={{ color: '#fdd835' }}>{score}</strong>
              </p>
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
        <span>Arrow Keys &mdash; move &nbsp;&middot;&nbsp; eat dots &nbsp;&middot;&nbsp; avoid ghosts</span>
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
  marginTop: 24, padding: '10px 32px', background: '#fdd835', color: '#0a0a0f',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
