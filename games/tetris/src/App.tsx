import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite, Text } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS     = 10
const ROWS     = 20
const CELL     = 32
const BOARD_W  = COLS * CELL   // 320
const BOARD_H  = ROWS * CELL   // 640
const SIDE_W   = 140
const W        = BOARD_W + SIDE_W
const H        = BOARD_H

// ─── Tetromino definitions ───────────────────────────────────────────────────
type Piece = { shape: number[][]; color: string }

const PIECES: Piece[] = [
  { shape: [[0,0],[1,0],[2,0],[3,0]], color: '#00bcd4' },   // I
  { shape: [[0,0],[1,0],[0,1],[1,1]], color: '#fdd835' },   // O
  { shape: [[0,0],[1,0],[2,0],[1,1]], color: '#ab47bc' },   // T
  { shape: [[1,0],[2,0],[0,1],[1,1]], color: '#66bb6a' },   // S
  { shape: [[0,0],[1,0],[1,1],[2,1]], color: '#ef5350' },   // Z
  { shape: [[0,0],[0,1],[1,1],[2,1]], color: '#42a5f5' },   // J
  { shape: [[2,0],[0,1],[1,1],[2,1]], color: '#ff7043' },   // L
]

// ─── Types ──────────────────────────────────────────────────────────────────
type Cell = string | null
type Board = Cell[][]
type GameState = 'idle' | 'playing' | 'gameover'

interface ActivePiece {
  shape: number[][]
  color: string
  x: number
  y: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function randomPiece(): Piece {
  return PIECES[Math.floor(Math.random() * PIECES.length)]
}

function spawnPiece(piece: Piece): ActivePiece {
  return { shape: piece.shape.map(([x,y]) => [x,y]), color: piece.color, x: 3, y: 0 }
}

function rotateShape(shape: number[][]): number[][] {
  // Simple rotation: transpose then reverse rows
  const maxY = Math.max(...shape.map(([,y]) => y))
  return shape.map(([x, y]) => [maxY - y, x]).sort((a,b) => a[1] - b[1] || a[0] - b[0])
}

function fits(board: Board, shape: number[][], px: number, py: number): boolean {
  return shape.every(([sx, sy]) => {
    const bx = px + sx
    const by = py + sy
    return bx >= 0 && bx < COLS && by >= 0 && by < ROWS && board[by][bx] === null
  })
}

function lockPiece(board: Board, piece: ActivePiece): Board {
  const nb = board.map(r => [...r])
  piece.shape.forEach(([sx, sy]) => {
    const bx = piece.x + sx
    const by = piece.y + sy
    if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
      nb[by][bx] = piece.color
    }
  })
  return nb
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter(row => row.some(c => c === null))
  const cleared = ROWS - kept.length
  const empty = Array.from({ length: cleared }, () => Array<Cell>(COLS).fill(null))
  return { board: [...empty, ...kept], cleared }
}

function ghostY(board: Board, piece: ActivePiece): number {
  let gy = piece.y
  while (fits(board, piece.shape, piece.x, gy + 1)) gy++
  return gy
}

const LINE_SCORES = [0, 100, 300, 500, 800]

// ─── App ────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [lines, setLines] = useState(0)
  const [gameState, setGameState] = useState<GameState>('idle')

  const boardRef = useRef<Board>(emptyBoard())
  const pieceRef = useRef<ActivePiece>(spawnPiece(randomPiece()))
  const nextPieceRef = useRef<Piece>(randomPiece())
  const tickRef = useRef(0)

  const [, forceRender] = useReducer(n => n + 1, 0)

  const dropInterval = useCallback(() => Math.max(50, 800 - (level - 1) * 75), [level])

  // Move piece down by one, lock if can't
  const moveDown = useCallback(() => {
    const piece = pieceRef.current
    const board = boardRef.current
    if (fits(board, piece.shape, piece.x, piece.y + 1)) {
      pieceRef.current = { ...piece, y: piece.y + 1 }
    } else {
      // Lock
      const nb = lockPiece(board, piece)
      const { board: cleared, cleared: linesCleared } = clearLines(nb)
      boardRef.current = cleared
      setScore(s => s + LINE_SCORES[linesCleared])
      setLines(l => {
        const nl = l + linesCleared
        setLevel(Math.floor(nl / 10) + 1)
        return nl
      })
      // Spawn next
      const next = nextPieceRef.current
      const newPiece = spawnPiece(next)
      nextPieceRef.current = randomPiece()
      if (!fits(cleared, newPiece.shape, newPiece.x, newPiece.y)) {
        setGameState('gameover')
        return
      }
      pieceRef.current = newPiece
    }
    forceRender()
  }, [level])

  const hardDrop = useCallback(() => {
    const piece = pieceRef.current
    const board = boardRef.current
    const gy = ghostY(board, piece)
    const dropped = gy - piece.y
    pieceRef.current = { ...piece, y: gy }
    setScore(s => s + dropped * 2)
    // Force lock on next tick
    moveDown()
  }, [moveDown])

  // Game tick
  useEffect(() => {
    if (gameState !== 'playing') return
    const id = setInterval(() => {
      tickRef.current++
      moveDown()
    }, dropInterval())
    return () => clearInterval(id)
  }, [gameState, dropInterval, moveDown])

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (gameState === 'idle' || gameState === 'gameover') {
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); restart() }
        return
      }
      if (gameState !== 'playing') return
      const piece = pieceRef.current
      const board = boardRef.current
      e.preventDefault()

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        if (fits(board, piece.shape, piece.x - 1, piece.y)) {
          pieceRef.current = { ...piece, x: piece.x - 1 }
          forceRender()
        }
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        if (fits(board, piece.shape, piece.x + 1, piece.y)) {
          pieceRef.current = { ...piece, x: piece.x + 1 }
          forceRender()
        }
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        moveDown()
        setScore(s => s + 1)
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        const rotated = rotateShape(piece.shape)
        // Try rotation with wall kicks
        for (const dx of [0, -1, 1, -2, 2]) {
          if (fits(board, rotated, piece.x + dx, piece.y)) {
            pieceRef.current = { ...piece, shape: rotated, x: piece.x + dx }
            forceRender()
            break
          }
        }
      } else if (e.code === 'Space') {
        hardDrop()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gameState, moveDown, hardDrop])

  function restart() {
    boardRef.current = emptyBoard()
    pieceRef.current = spawnPiece(randomPiece())
    nextPieceRef.current = randomPiece()
    tickRef.current = 0
    setScore(0)
    setLevel(1)
    setLines(0)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  const board = boardRef.current
  const piece = pieceRef.current
  const gy = gameState === 'playing' ? ghostY(board, piece) : piece.y
  const next = nextPieceRef.current

  // Canvas pixel positions
  const px = (col: number) => col * CELL + CELL / 2
  const py = (row: number) => row * CELL + CELL / 2

  // Collect all cells to render
  const cells: { x: number; y: number; color: string; key: string; z: number }[] = []

  // Board cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        cells.push({ x: px(c), y: py(r), color: board[r][c]!, key: `b${r}-${c}`, z: 2 })
      }
    }
  }

  // Ghost piece
  if (gameState === 'playing') {
    piece.shape.forEach(([sx, sy], i) => {
      cells.push({ x: px(piece.x + sx), y: py(gy + sy), color: '#1a2535', key: `g${i}`, z: 1 })
    })
    // Active piece
    piece.shape.forEach(([sx, sy], i) => {
      cells.push({ x: px(piece.x + sx), y: py(piece.y + sy), color: piece.color, key: `p${i}`, z: 3 })
    })
  }

  // Next piece preview (in sidebar)
  const nextCells = next.shape.map(([sx, sy], i) => ({
    x: BOARD_W + 30 + sx * 24 + 12,
    y: 80 + sy * 24 + 12,
    color: next.color,
    key: `n${i}`,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ fontSize: 11, color: '#607d8b' }}>LVL {level}</div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>
            {String(score).padStart(6, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>LINES {lines}</div>
      </div>

      {/* Game canvas + overlays */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Grid lines */}
            {Array.from({ length: COLS + 1 }, (_, i) => (
              <Entity key={`gv${i}`} tags={['grid']}>
                <Transform x={i * CELL} y={H / 2} />
                <Sprite width={1} height={H} color="#151b26" />
              </Entity>
            ))}
            {Array.from({ length: ROWS + 1 }, (_, i) => (
              <Entity key={`gh${i}`} tags={['grid']}>
                <Transform x={BOARD_W / 2} y={i * CELL} />
                <Sprite width={BOARD_W} height={1} color="#151b26" />
              </Entity>
            ))}

            {/* Board border */}
            <Entity tags={['border']}>
              <Transform x={BOARD_W} y={H / 2} />
              <Sprite width={2} height={H} color="#1e2535" />
            </Entity>

            {/* All cells */}
            {cells.map(c => (
              <Entity key={c.key} tags={['cell']}>
                <Transform x={c.x} y={c.y} />
                <Sprite width={CELL - 2} height={CELL - 2} color={c.color} zIndex={c.z} />
              </Entity>
            ))}

            {/* Sidebar: NEXT label */}
            <Entity tags={['ui']}>
              <Transform x={BOARD_W + SIDE_W / 2} y={40} />
              <Text text="NEXT" fontSize={12} color="#546e7a" align="center" baseline="middle" zIndex={5} />
            </Entity>

            {/* Next piece preview */}
            {nextCells.map(c => (
              <Entity key={c.key} tags={['next']}>
                <Transform x={c.x} y={c.y} />
                <Sprite width={22} height={22} color={c.color} zIndex={3} />
              </Entity>
            ))}

            {/* Sidebar labels */}
            <Entity tags={['ui']}>
              <Transform x={BOARD_W + SIDE_W / 2} y={200} />
              <Text text="SCORE" fontSize={11} color="#546e7a" align="center" baseline="middle" zIndex={5} />
            </Entity>
            <Entity tags={['ui']}>
              <Transform x={BOARD_W + SIDE_W / 2} y={220} />
              <Text text={String(score)} fontSize={16} color="#4fc3f7" align="center" baseline="middle" zIndex={5} />
            </Entity>
            <Entity tags={['ui']}>
              <Transform x={BOARD_W + SIDE_W / 2} y={280} />
              <Text text="LEVEL" fontSize={11} color="#546e7a" align="center" baseline="middle" zIndex={5} />
            </Entity>
            <Entity tags={['ui']}>
              <Transform x={BOARD_W + SIDE_W / 2} y={300} />
              <Text text={String(level)} fontSize={16} color="#69f0ae" align="center" baseline="middle" zIndex={5} />
            </Entity>
            <Entity tags={['ui']}>
              <Transform x={BOARD_W + SIDE_W / 2} y={360} />
              <Text text="LINES" fontSize={11} color="#546e7a" align="center" baseline="middle" zIndex={5} />
            </Entity>
            <Entity tags={['ui']}>
              <Transform x={BOARD_W + SIDE_W / 2} y={380} />
              <Text text={String(lines)} fontSize={16} color="#ffd54f" align="center" baseline="middle" zIndex={5} />
            </Entity>
          </World>
        </Game>

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>TETRIS</p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>BLOCKED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#4fc3f7' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                Level {level} &nbsp;&middot;&nbsp; {lines} lines
              </p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Controls hint */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>&larr;&rarr; move &nbsp;&middot;&nbsp; &uarr; rotate &nbsp;&middot;&nbsp; &darr; soft drop &nbsp;&middot;&nbsp; Space hard drop</span>
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
