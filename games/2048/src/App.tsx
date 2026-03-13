import { useState, useEffect, useCallback } from 'react'
import { Game, World, Entity, Transform, Sprite, Text, Camera2D } from '@cubeforge/react'
import { gameEvents } from './gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 432
const H = 432
const GRID = 4
const GAP = 12
const CELL = (W - GAP * (GRID + 1)) / GRID // 96px
const HALF_CELL = CELL / 2

// ─── Tile Colors ──────────────────────────────────────────────────────────────
const TILE_COLORS: Record<number, string> = {
  2:    '#eee4da',
  4:    '#ede0c8',
  8:    '#f2b179',
  16:   '#f59563',
  32:   '#f67c5f',
  64:   '#f65e3b',
  128:  '#edcf72',
  256:  '#edcc61',
  512:  '#edc850',
  1024: '#edc53f',
  2048: '#edc22e',
}

function tileColor(value: number): string {
  return TILE_COLORS[value] ?? '#3c3a32'
}

function textColor(value: number): string {
  return value <= 4 ? '#776e65' : '#f9f6f2'
}

function textSize(value: number): number {
  if (value >= 1024) return 22
  if (value >= 128)  return 26
  return 32
}

// ─── Grid Helpers ─────────────────────────────────────────────────────────────
type Grid = number[][]

function emptyGrid(): Grid {
  return Array.from({ length: GRID }, () => Array(GRID).fill(0))
}

function cloneGrid(g: Grid): Grid {
  return g.map(r => [...r])
}

function emptyCells(g: Grid): [number, number][] {
  const cells: [number, number][] = []
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (g[r][c] === 0) cells.push([r, c])
  return cells
}

function addRandom(g: Grid): Grid {
  const cells = emptyCells(g)
  if (cells.length === 0) return g
  const [r, c] = cells[Math.floor(Math.random() * cells.length)]
  const ng = cloneGrid(g)
  ng[r][c] = Math.random() < 0.9 ? 2 : 4
  return ng
}

function initGrid(): Grid {
  return addRandom(addRandom(emptyGrid()))
}

// ─── Slide Logic ──────────────────────────────────────────────────────────────
function slideRow(row: number[]): { result: number[]; scored: number } {
  // Remove zeros, merge, pad
  const filtered = row.filter(v => v !== 0)
  const merged: number[] = []
  let scored = 0
  let skip = false
  for (let i = 0; i < filtered.length; i++) {
    if (skip) { skip = false; continue }
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2
      merged.push(val)
      scored += val
      skip = true
    } else {
      merged.push(filtered[i])
    }
  }
  while (merged.length < GRID) merged.push(0)
  return { result: merged, scored }
}

function rotateLeft(g: Grid): Grid {
  const n = emptyGrid()
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      n[GRID - 1 - c][r] = g[r][c]
  return n
}

function rotateRight(g: Grid): Grid {
  const n = emptyGrid()
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      n[c][GRID - 1 - r] = g[r][c]
  return n
}

type Direction = 'left' | 'right' | 'up' | 'down'

function move(g: Grid, dir: Direction): { grid: Grid; scored: number; moved: boolean } {
  let rotated = cloneGrid(g)
  // Rotate so we always slide left
  const rotations: Record<Direction, number> = { left: 0, right: 2, up: 1, down: 3 }
  for (let i = 0; i < rotations[dir]; i++) rotated = rotateLeft(rotated)

  let totalScored = 0
  const result = emptyGrid()
  for (let r = 0; r < GRID; r++) {
    const { result: row, scored } = slideRow(rotated[r])
    result[r] = row
    totalScored += scored
  }

  // Rotate back
  let final = result
  for (let i = 0; i < rotations[dir]; i++) final = rotateRight(final)

  // Check if anything actually changed
  let moved = false
  outer: for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (g[r][c] !== final[r][c]) { moved = true; break outer }

  return { grid: final, scored: totalScored, moved }
}

function canMove(g: Grid): boolean {
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) {
      if (g[r][c] === 0) return true
      if (c + 1 < GRID && g[r][c] === g[r][c + 1]) return true
      if (r + 1 < GRID && g[r][c] === g[r + 1][c]) return true
    }
  return false
}

function hasWon(g: Grid): boolean {
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (g[r][c] >= 2048) return true
  return false
}

// ─── Cell position helpers ────────────────────────────────────────────────────
function cellX(col: number): number {
  return GAP + col * (CELL + GAP) + HALF_CELL
}

function cellY(row: number): number {
  return GAP + row * (CELL + GAP) + HALF_CELL
}

// ─── Tile Entity ──────────────────────────────────────────────────────────────
function Tile({ row, col, value }: { row: number; col: number; value: number }) {
  const x = cellX(col)
  const y = cellY(row)
  return (
    <Entity id={`tile-${row}-${col}`}>
      <Transform x={x} y={y} />
      <Sprite width={CELL} height={CELL} color={tileColor(value)} zIndex={1} />
      <Text
        text={String(value)}
        fontSize={textSize(value)}
        fontFamily="'Courier New', monospace"
        color={textColor(value)}
        align="center"
        baseline="middle"
        zIndex={2}
      />
    </Entity>
  )
}

// ─── Empty cell background ────────────────────────────────────────────────────
function EmptyCell({ row, col }: { row: number; col: number }) {
  return (
    <Entity id={`empty-${row}-${col}`}>
      <Transform x={cellX(col)} y={cellY(row)} />
      <Sprite width={CELL} height={CELL} color="#151825" zIndex={0} />
    </Entity>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
type GameState = 'playing' | 'won' | 'gameover' | 'keepgoing'

export function App() {
  const [grid,      setGrid]      = useState<Grid>(initGrid)
  const [score,     setScore]     = useState(0)
  const [best,      setBest]      = useState(() => {
    const saved = localStorage.getItem('2048-best')
    return saved ? parseInt(saved, 10) : 0
  })
  const [gameState, setGameState] = useState<GameState>('playing')
  const [gameKey,   setGameKey]   = useState(0)

  // Persist best score
  useEffect(() => {
    if (score > best) {
      setBest(score)
      localStorage.setItem('2048-best', String(score))
    }
  }, [score, best])

  // Wire game events
  useEffect(() => {
    gameEvents.onGameOver = () => setGameState('gameover')
    gameEvents.onWin      = () => setGameState('won')
    return () => { gameEvents.onGameOver = null; gameEvents.onWin = null }
  }, [gameKey])

  const handleMove = useCallback((dir: Direction) => {
    if (gameState === 'gameover') return
    const playing = gameState === 'playing' || gameState === 'keepgoing'
    if (!playing) return

    const { grid: newGrid, scored, moved } = move(grid, dir)
    if (!moved) return

    const withNew = addRandom(newGrid)
    setGrid(withNew)
    setScore(s => s + scored)

    if (gameState === 'playing' && hasWon(withNew)) {
      setGameState('won')
    } else if (!canMove(withNew)) {
      setGameState('gameover')
    }
  }, [grid, gameState])

  // Arrow key listener
  useEffect(() => {
    const keyMap: Record<string, Direction> = {
      ArrowLeft:  'left',
      ArrowRight: 'right',
      ArrowUp:    'up',
      ArrowDown:  'down',
    }
    function onKey(e: KeyboardEvent) {
      const dir = keyMap[e.key]
      if (dir) {
        e.preventDefault()
        handleMove(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleMove])

  function restart() {
    setGrid(initGrid())
    setScore(0)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  function keepGoing() {
    setGameState('keepgoing')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ─────────────────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        padding: '10px 18px',
        background: '#0d0f1a',
        borderRadius: '10px 10px 0 0',
        fontSize: 13,
        color: '#90a4ae',
        letterSpacing: 1,
        userSelect: 'none',
      }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: '#546e7a', marginBottom: 2 }}>SCORE</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#edc22e', letterSpacing: 2 }}>{score}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#f2b179', letterSpacing: 3 }}>2048</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: '#546e7a', marginBottom: 2 }}>BEST</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#edc53f', letterSpacing: 2 }}>{best}</div>
        </div>
      </div>

      {/* ── Game canvas + overlays ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#1a1f33">
            <Camera2D x={W / 2} y={H / 2} />

            {/* Empty cell backgrounds */}
            {Array.from({ length: GRID }, (_, r) =>
              Array.from({ length: GRID }, (_, c) => (
                <EmptyCell key={`e-${r}-${c}`} row={r} col={c} />
              ))
            )}

            {/* Tiles */}
            {grid.flatMap((row, r) =>
              row.map((val, c) =>
                val !== 0 ? <Tile key={`t-${r}-${c}-${val}`} row={r} col={c} value={val} /> : null
              )
            )}
          </World>
        </Game>

        {/* ── Win overlay ─────────────────────────────────────────────────── */}
        {gameState === 'won' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#edc22e', marginBottom: 8 }}>
                YOU WIN!
              </p>
              <p style={{
                fontSize: 48,
                fontWeight: 900,
                color: '#edc22e',
                letterSpacing: 3,
              }}>
                2048
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score: {score}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={keepGoing} style={btnStyle}>Keep Going</button>
                <button onClick={restart} style={{ ...btnStyle, background: '#546e7a' }}>New Game</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Game over overlay ───────────────────────────────────────────── */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>
                GAME OVER
              </p>
              <p style={{
                fontSize: 36,
                fontWeight: 900,
                color: '#ef5350',
                letterSpacing: 3,
              }}>
                NO MOVES
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Final Score: {score}
              </p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ─────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        background: '#0d0f1a',
        borderRadius: '0 0 10px 10px',
        padding: '6px 18px',
        fontSize: 11,
        color: '#37474f',
        letterSpacing: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Arrow keys to move &middot; Merge tiles to reach 2048</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position:       'absolute',
  inset:          0,
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  background:     'rgba(10, 10, 18, 0.82)',
  backdropFilter: 'blur(4px)',
}

const cardStyle: React.CSSProperties = {
  textAlign:    'center',
  fontFamily:   '"Courier New", monospace',
  padding:      '36px 48px',
  background:   '#0d0f1a',
  border:       '1px solid #1e2535',
  borderRadius: 12,
}

const btnStyle: React.CSSProperties = {
  marginTop:     24,
  padding:       '10px 32px',
  background:    '#edc22e',
  color:         '#0a0a0f',
  border:        'none',
  borderRadius:  6,
  fontFamily:    '"Courier New", monospace',
  fontSize:      13,
  fontWeight:    700,
  letterSpacing: 2,
  cursor:        'pointer',
}
