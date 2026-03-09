import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS   = 8
const ROWS   = 8
const CELL   = 48
const BOARD  = COLS * CELL   // 384
const PAD    = 8
const W      = BOARD + PAD * 2
const H      = BOARD + PAD * 2
const COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#fdd835', '#ab47bc', '#ff7043']
const ANIM_MS = 200
const MAX_MOVES = 30

type Cell = number | null  // color index or null (empty)
type Board = Cell[][]
type GameState = 'idle' | 'playing' | 'animating' | 'gameover'
type Selection = { r: number; c: number } | null

// ─── Helpers ────────────────────────────────────────────────────────────────
function randomColor(): number {
  return Math.floor(Math.random() * COLORS.length)
}

function createBoard(): Board {
  const board: Board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => randomColor())
  )
  // Remove initial matches
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let attempts = 0
      while (attempts < 20 && hasMatchAt(board, r, c)) {
        board[r][c] = randomColor()
        attempts++
      }
    }
  }
  return board
}

function hasMatchAt(board: Board, r: number, c: number): boolean {
  const v = board[r][c]
  if (v === null) return false
  // Horizontal
  if (c >= 2 && board[r][c-1] === v && board[r][c-2] === v) return true
  // Vertical
  if (r >= 2 && board[r-1][c] === v && board[r-2][c] === v) return true
  return false
}

function findMatches(board: Board): Set<string> {
  const matches = new Set<string>()
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 3; c++) {
      const v = board[r][c]
      if (v !== null && board[r][c+1] === v && board[r][c+2] === v) {
        let end = c + 2
        while (end + 1 < COLS && board[r][end+1] === v) end++
        for (let i = c; i <= end; i++) matches.add(`${r},${i}`)
      }
    }
  }
  // Vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 3; r++) {
      const v = board[r][c]
      if (v !== null && board[r+1][c] === v && board[r+2][c] === v) {
        let end = r + 2
        while (end + 1 < ROWS && board[end+1][c] === v) end++
        for (let i = r; i <= end; i++) matches.add(`${i},${c}`)
      }
    }
  }
  return matches
}

function removeMatches(board: Board, matches: Set<string>): Board {
  const nb = board.map(r => [...r])
  matches.forEach(key => {
    const [r, c] = key.split(',').map(Number)
    nb[r][c] = null
  })
  return nb
}

function applyGravity(board: Board): Board {
  const nb = board.map(r => [...r])
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1
    for (let r = ROWS - 1; r >= 0; r--) {
      if (nb[r][c] !== null) {
        const val = nb[r][c]
        nb[r][c] = null
        nb[writeRow][c] = val
        writeRow--
      }
    }
    // Fill empty top with new gems
    for (let r = writeRow; r >= 0; r--) {
      nb[r][c] = randomColor()
    }
  }
  return nb
}

function isAdjacent(a: { r: number; c: number }, b: { r: number; c: number }): boolean {
  return (Math.abs(a.r - b.r) + Math.abs(a.c - b.c)) === 1
}

function swapCells(board: Board, r1: number, c1: number, r2: number, c2: number): Board {
  const nb = board.map(r => [...r])
  const tmp = nb[r1][c1]
  nb[r1][c1] = nb[r2][c2]
  nb[r2][c2] = tmp
  return nb
}

// ─── App ────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [moves, setMoves] = useState(MAX_MOVES)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [selected, setSelected] = useState<Selection>(null)

  const boardRef = useRef<Board>(createBoard())
  const chainRef = useRef(0)
  const [, forceRender] = useReducer(n => n + 1, 0)

  const processMatches = useCallback(() => {
    const board = boardRef.current
    const matches = findMatches(board)
    if (matches.size > 0) {
      chainRef.current++
      const chainBonus = chainRef.current > 1 ? chainRef.current * 50 : 0
      setScore(s => s + matches.size * 10 + chainBonus)
      const cleared = removeMatches(board, matches)
      boardRef.current = cleared
      setGameState('animating')
      forceRender()

      setTimeout(() => {
        boardRef.current = applyGravity(boardRef.current)
        forceRender()
        // Check for cascading matches
        setTimeout(() => processMatches(), ANIM_MS)
      }, ANIM_MS)
    } else {
      chainRef.current = 0
      if (moves <= 0) {
        setGameState('gameover')
      } else {
        setGameState('playing')
      }
    }
  }, [moves])

  const handleCellClick = useCallback((r: number, c: number) => {
    if (gameState !== 'playing') return
    if (!selected) {
      setSelected({ r, c })
      return
    }
    if (selected.r === r && selected.c === c) {
      setSelected(null)
      return
    }
    if (!isAdjacent(selected, { r, c })) {
      setSelected({ r, c })
      return
    }
    // Swap
    const swapped = swapCells(boardRef.current, selected.r, selected.c, r, c)
    const matches = findMatches(swapped)
    if (matches.size === 0) {
      // Invalid swap - swap back
      setSelected(null)
      return
    }
    boardRef.current = swapped
    setSelected(null)
    setMoves(m => m - 1)
    chainRef.current = 0
    processMatches()
  }, [gameState, selected, processMatches])

  // Click handler overlay
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left - PAD
    const my = e.clientY - rect.top - PAD
    const c = Math.floor(mx / CELL)
    const r = Math.floor(my / CELL)
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      handleCellClick(r, c)
    }
  }, [handleCellClick])

  function restart() {
    boardRef.current = createBoard()
    chainRef.current = 0
    setScore(0)
    setMoves(MAX_MOVES)
    setSelected(null)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((gameState === 'idle' || gameState === 'gameover') && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault()
        restart()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gameState])

  const board = boardRef.current
  const px = (col: number) => PAD + col * CELL + CELL / 2
  const py = (row: number) => PAD + row * CELL + CELL / 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ fontSize: 11, color: '#607d8b' }}>MOVES {moves}</div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ab47bc', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>
            {String(score).padStart(5, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>MATCH-3</div>
      </div>

      {/* Game */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Grid background */}
            {Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: COLS }, (_, c) => (
                <Entity key={`bg${r}-${c}`} tags={['bg']}>
                  <Transform x={px(c)} y={py(r)} />
                  <Sprite width={CELL - 2} height={CELL - 2} color="#161d2a" zIndex={0} />
                </Entity>
              ))
            )}

            {/* Gems */}
            {board.map((row, r) =>
              row.map((cell, c) => {
                if (cell === null) return null
                const isSelected = selected?.r === r && selected?.c === c
                return (
                  <Entity key={`gem${r}-${c}-${cell}`} tags={['gem']}>
                    <Transform x={px(c)} y={py(r)} />
                    <Sprite
                      width={isSelected ? CELL - 4 : CELL - 10}
                      height={isSelected ? CELL - 4 : CELL - 10}
                      color={COLORS[cell]}
                      zIndex={isSelected ? 5 : 2}
                    />
                  </Entity>
                )
              })
            )}

            {/* Selection highlight */}
            {selected && (
              <Entity tags={['select']}>
                <Transform x={px(selected.c)} y={py(selected.r)} />
                <Sprite width={CELL} height={CELL} color="#ffffff22" zIndex={4} />
              </Entity>
            )}
          </World>
        </Game>

        {/* Click overlay */}
        <div
          onClick={handleCanvasClick}
          style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
        />

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ab47bc', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>MATCH-3</p>
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
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>NO MOVES LEFT</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0' }}>
                Score &nbsp;<strong style={{ color: '#ab47bc' }}>{score}</strong>
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
        <span>Click to select &nbsp;&middot;&nbsp; Click adjacent to swap &nbsp;&middot;&nbsp; Match 3+ in a row</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: 'rgba(10,10,18,0.82)', backdropFilter: 'blur(4px)', zIndex: 10,
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace', padding: '36px 48px',
  background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 24, padding: '10px 32px', background: '#ab47bc', color: '#fff',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
