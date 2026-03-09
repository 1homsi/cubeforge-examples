import { useState, useCallback } from 'react'
import { Game, World, Entity, Transform, Sprite, Camera2D } from '@cubeforge/react'

// ── Constants ────────────────────────────────────────────────────────────────
const GRID   = 5
const CELL   = 60
const GAP    = 10
const W      = 350
const H      = 350
const COLOR_ON  = '#4fc3f7'
const COLOR_OFF = '#1a1f33'
const BG        = '#0d0f1a'
const GRID_BG   = '#0a0a12'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Toggle cell (row, col) and its 4 neighbours in-place, returns new array */
function toggle(board: boolean[], row: number, col: number): boolean[] {
  const next = [...board]
  const dirs = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]
  for (const [dr, dc] of dirs) {
    const r = row + dr
    const c = col + dc
    if (r >= 0 && r < GRID && c >= 0 && c < GRID) {
      next[r * GRID + c] = !next[r * GRID + c]
    }
  }
  return next
}

/** Generate a solvable puzzle by performing `n` random toggles from all-off */
function generatePuzzle(toggleCount: number): boolean[] {
  let board = Array(GRID * GRID).fill(false) as boolean[]
  for (let i = 0; i < toggleCount; i++) {
    const r = Math.floor(Math.random() * GRID)
    const c = Math.floor(Math.random() * GRID)
    board = toggle(board, r, c)
  }
  // If we accidentally got all-off, do one more toggle
  if (board.every(v => !v)) {
    board = toggle(board, Math.floor(Math.random() * GRID), Math.floor(Math.random() * GRID))
  }
  return board
}

function toggleCountForLevel(level: number): number {
  return Math.min(3 + level * 2, 25)
}

/** Pixel position of cell centre */
function cellPos(row: number, col: number): { x: number; y: number } {
  const totalGrid = GRID * CELL + (GRID - 1) * GAP
  const offsetX = (W - totalGrid) / 2
  const offsetY = (H - totalGrid) / 2
  return {
    x: offsetX + col * (CELL + GAP) + CELL / 2,
    y: offsetY + row * (CELL + GAP) + CELL / 2,
  }
}

// ── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [level, setLevel] = useState(1)
  const [board, setBoard] = useState(() => generatePuzzle(toggleCountForLevel(1)))
  const [moves, setMoves] = useState(0)
  const [won, setWon]     = useState(false)
  const [gameKey, setGameKey] = useState(0)

  const handleClick = useCallback((row: number, col: number) => {
    if (won) return
    setBoard(prev => {
      const next = toggle(prev, row, col)
      if (next.every(v => !v)) setWon(true)
      return next
    })
    setMoves(m => m + 1)
  }, [won])

  function newPuzzle() {
    setBoard(generatePuzzle(toggleCountForLevel(level)))
    setMoves(0)
    setWon(false)
    setGameKey(k => k + 1)
  }

  function nextLevel() {
    const next = level + 1
    setLevel(next)
    setBoard(generatePuzzle(toggleCountForLevel(next)))
    setMoves(0)
    setWon(false)
    setGameKey(k => k + 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ─────────────────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        padding: '7px 18px',
        background: BG,
        borderRadius: '10px 10px 0 0',
        fontSize: 13,
        color: '#90a4ae',
        letterSpacing: 1,
        userSelect: 'none',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#4fc3f7' }}>
          LVL {level}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#546e7a', letterSpacing: 4 }}>
          LIGHTS OUT
        </div>
        <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#ef5350' }}>
          {moves} moves
        </div>
      </div>

      {/* ── Game canvas + click overlay ──────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background={GRID_BG}>
            <Camera2D x={W / 2} y={H / 2} />
            {board.map((on, idx) => {
              const row = Math.floor(idx / GRID)
              const col = idx % GRID
              const { x, y } = cellPos(row, col)
              return (
                <Entity key={`cell-${row}-${col}`} tags={['cell']}>
                  <Transform x={x} y={y} />
                  <Sprite width={CELL} height={CELL} color={on ? COLOR_ON : COLOR_OFF} />
                </Entity>
              )
            })}
          </World>
        </Game>

        {/* Transparent click overlay */}
        <div
          style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const mx = e.clientX - rect.left
            const my = e.clientY - rect.top
            const totalGrid = GRID * CELL + (GRID - 1) * GAP
            const offsetX = (W - totalGrid) / 2
            const offsetY = (H - totalGrid) / 2
            const col = Math.floor((mx - offsetX) / (CELL + GAP))
            const row = Math.floor((my - offsetY) / (CELL + GAP))
            if (row >= 0 && row < GRID && col >= 0 && col < GRID) {
              handleClick(row, col)
            }
          }}
        />

        {/* ── Win overlay ────────────────────────────────────────────────────── */}
        {won && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>
                PUZZLE COMPLETE
              </p>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#4fc3f7', letterSpacing: 3 }}>
                LIGHTS OUT!
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Level {level} cleared in {moves} moves
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={nextLevel} style={btnStyle}>Next Level</button>
                <button onClick={newPuzzle} style={{ ...btnStyle, background: '#546e7a' }}>Replay</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        background: BG,
        borderRadius: '0 0 10px 10px',
        padding: '6px 18px',
        fontSize: 11,
        color: '#37474f',
        letterSpacing: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>
          Click to toggle &nbsp;&middot;&nbsp;
          <span
            style={{ color: '#4fc3f7', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={newPuzzle}
          >
            New Puzzle
          </span>
        </span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────
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
  background:    '#4fc3f7',
  color:         '#0a0a0f',
  border:        'none',
  borderRadius:  6,
  fontFamily:    '"Courier New", monospace',
  fontSize:      13,
  fontWeight:    700,
  letterSpacing: 2,
  cursor:        'pointer',
}
