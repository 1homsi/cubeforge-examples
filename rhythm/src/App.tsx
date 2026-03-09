import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite, Text } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 400
const H = 600
const LANES = 4
const LANE_W = W / LANES
const TARGET_Y = H - 80
const NOTE_SIZE = 50
const NOTE_SPEED = 280
const PERFECT_WINDOW = 25
const GOOD_WINDOW = 50
const DT = 1 / 60

const LANE_KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK']
const LANE_LABELS = ['D', 'F', 'J', 'K']
const LANE_COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#fdd835']

type GameState = 'idle' | 'playing' | 'results'
type HitResult = 'perfect' | 'good' | 'miss'

interface Note {
  lane: number; y: number; id: number; hit: boolean
}

interface HitEffect {
  lane: number; result: HitResult; timer: number; id: number
}

// ─── Song patterns ──────────────────────────────────────────────────────────
// Each pattern is [time_in_beats, lane]
const SONG_BPM = 120
const BEAT_INTERVAL = 60 / SONG_BPM

const SONG_PATTERN: [number, number][] = [
  // Intro
  [0, 0], [1, 1], [2, 2], [3, 3],
  [4, 0], [4, 3], [5, 1], [5, 2],
  [6, 0], [6.5, 1], [7, 2], [7.5, 3],
  // Verse
  [8, 0], [8.5, 0], [9, 1], [10, 2], [10.5, 2], [11, 3],
  [12, 0], [12, 2], [13, 1], [13, 3], [14, 0], [14.5, 1], [15, 2], [15.5, 3],
  // Chorus
  [16, 0], [16, 1], [16.5, 2], [16.5, 3], [17, 0], [17, 1], [17.5, 2], [17.5, 3],
  [18, 0], [18.5, 1], [19, 2], [19.5, 3], [20, 0], [20, 1], [20, 2], [20, 3],
  // Bridge
  [22, 1], [22.5, 2], [23, 1], [23.5, 2], [24, 0], [24, 3],
  [25, 0], [25.25, 1], [25.5, 2], [25.75, 3],
  [26, 3], [26.25, 2], [26.5, 1], [26.75, 0],
  // Outro
  [28, 0], [28, 1], [28, 2], [28, 3],
  [29, 0], [29.5, 1], [30, 2], [30.5, 3],
  [31, 0], [31, 1], [31, 2], [31, 3],
  [32, 0], [32, 3],
]

const SONG_DURATION = 34 // beats

// ─── App ────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [perfects, setPerfects] = useState(0)
  const [goods, setGoods] = useState(0)
  const [misses, setMisses] = useState(0)
  const [gameState, setGameState] = useState<GameState>('idle')

  const notesRef = useRef<Note[]>([])
  const effectsRef = useRef<HitEffect[]>([])
  const timeRef = useRef(0)
  const nextNoteRef = useRef(0)
  const nextIdRef = useRef(1)
  const laneFlashRef = useRef<boolean[]>([false, false, false, false])
  const comboRef = useRef(0)

  const [, forceRender] = useReducer(n => n + 1, 0)

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return
    const id = setInterval(() => {
      timeRef.current += DT
      const beatTime = timeRef.current

      // Spawn notes
      while (nextNoteRef.current < SONG_PATTERN.length) {
        const [beat, lane] = SONG_PATTERN[nextNoteRef.current]
        const spawnTime = beat * BEAT_INTERVAL
        if (beatTime >= spawnTime - (TARGET_Y / NOTE_SPEED)) {
          notesRef.current.push({
            lane,
            y: -(beatTime - spawnTime + TARGET_Y / NOTE_SPEED) * NOTE_SPEED + TARGET_Y,
            id: nextIdRef.current++,
            hit: false,
          })
          nextNoteRef.current++
        } else {
          break
        }
      }

      // Move notes
      notesRef.current.forEach(n => { n.y += NOTE_SPEED * DT })

      // Check missed notes (past target)
      notesRef.current = notesRef.current.filter(n => {
        if (n.hit) return false
        if (n.y > TARGET_Y + GOOD_WINDOW + 30) {
          setMisses(m => m + 1)
          comboRef.current = 0
          setCombo(0)
          effectsRef.current.push({ lane: n.lane, result: 'miss', timer: 0.5, id: nextIdRef.current++ })
          return false
        }
        return true
      })

      // Update effects
      effectsRef.current = effectsRef.current.filter(e => {
        e.timer -= DT
        return e.timer > 0
      })

      // Reset lane flashes
      laneFlashRef.current = [false, false, false, false]

      // Song end
      if (beatTime > SONG_DURATION * BEAT_INTERVAL + 2 && notesRef.current.length === 0) {
        setGameState('results')
      }

      forceRender()
    }, DT * 1000)
    return () => clearInterval(id)
  }, [gameState])

  // Input
  const tryHit = useCallback((lane: number) => {
    if (gameState !== 'playing') return
    laneFlashRef.current[lane] = true
    const notes = notesRef.current
    // Find closest unhit note in this lane near target
    let best: Note | null = null
    let bestDist = Infinity
    notes.forEach(n => {
      if (n.lane === lane && !n.hit) {
        const dist = Math.abs(n.y - TARGET_Y)
        if (dist < bestDist) { bestDist = dist; best = n }
      }
    })

    if (best && bestDist <= GOOD_WINDOW) {
      best.hit = true
      let result: HitResult
      let points: number
      if (bestDist <= PERFECT_WINDOW) {
        result = 'perfect'
        points = 100
        setPerfects(p => p + 1)
      } else {
        result = 'good'
        points = 50
        setGoods(g => g + 1)
      }
      comboRef.current++
      const c = comboRef.current
      setCombo(c)
      setMaxCombo(m => Math.max(m, c))
      const multiplier = Math.min(4, 1 + Math.floor(c / 10))
      setScore(s => s + points * multiplier)
      effectsRef.current.push({ lane, result, timer: 0.5, id: nextIdRef.current++ })
    }
  }, [gameState])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((gameState === 'idle' || gameState === 'results') && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault(); restart(); return
      }
      const laneIdx = LANE_KEYS.indexOf(e.code)
      if (laneIdx >= 0) { e.preventDefault(); tryHit(laneIdx) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gameState, tryHit])

  function restart() {
    notesRef.current = []
    effectsRef.current = []
    timeRef.current = 0
    nextNoteRef.current = 0
    nextIdRef.current = 1
    laneFlashRef.current = [false, false, false, false]
    comboRef.current = 0
    setScore(0); setCombo(0); setMaxCombo(0)
    setPerfects(0); setGoods(0); setMisses(0)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  const notes = notesRef.current
  const effects = effectsRef.current
  const laneFlash = laneFlashRef.current
  const multiplier = Math.min(4, 1 + Math.floor(combo / 10))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ fontSize: 11, color: '#607d8b' }}>
          {combo > 0 && <span style={{ color: '#fdd835' }}>{combo}x </span>}
          {multiplier > 1 && <span style={{ color: '#ff7043' }}>x{multiplier}</span>}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ab47bc', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>
            {String(score).padStart(6, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>RHYTHM</div>
      </div>

      {/* Game */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0a0a14">
            <Camera2D x={W / 2} y={H / 2} background="#0a0a14" />

            {/* Lane dividers */}
            {Array.from({ length: LANES + 1 }, (_, i) => (
              <Entity key={`lane${i}`} tags={['lane']}>
                <Transform x={i * LANE_W} y={H / 2} />
                <Sprite width={1} height={H} color="#151b26" zIndex={0} />
              </Entity>
            ))}

            {/* Target line */}
            <Entity tags={['target']}>
              <Transform x={W / 2} y={TARGET_Y} />
              <Sprite width={W} height={2} color="#ffffff33" zIndex={1} />
            </Entity>

            {/* Lane flash on hit */}
            {laneFlash.map((flash, i) => flash ? (
              <Entity key={`flash${i}`} tags={['flash']}>
                <Transform x={i * LANE_W + LANE_W / 2} y={TARGET_Y} />
                <Sprite width={LANE_W} height={NOTE_SIZE + 20} color={`${LANE_COLORS[i]}22`} zIndex={1} />
              </Entity>
            ) : null)}

            {/* Target indicators */}
            {LANE_LABELS.map((label, i) => (
              <Entity key={`tgt${i}`} tags={['indicator']}>
                <Transform x={i * LANE_W + LANE_W / 2} y={TARGET_Y} />
                <Sprite width={LANE_W - 8} height={NOTE_SIZE} color="#1a1f2e" zIndex={2} />
              </Entity>
            ))}
            {LANE_LABELS.map((label, i) => (
              <Entity key={`tgtl${i}`} tags={['label']}>
                <Transform x={i * LANE_W + LANE_W / 2} y={TARGET_Y} />
                <Text text={label} fontSize={20} color="#37474f" align="center" baseline="middle" zIndex={3} />
              </Entity>
            ))}

            {/* Notes */}
            {notes.filter(n => !n.hit && n.y > -NOTE_SIZE && n.y < H + NOTE_SIZE).map(n => (
              <Entity key={`note${n.id}`} tags={['note']}>
                <Transform x={n.lane * LANE_W + LANE_W / 2} y={n.y} />
                <Sprite width={LANE_W - 12} height={NOTE_SIZE - 8} color={LANE_COLORS[n.lane]} zIndex={5} />
              </Entity>
            ))}

            {/* Hit effects */}
            {effects.map(e => (
              <Entity key={`eff${e.id}`} tags={['effect']}>
                <Transform x={e.lane * LANE_W + LANE_W / 2} y={TARGET_Y - 40} />
                <Text
                  text={e.result === 'perfect' ? 'PERFECT' : e.result === 'good' ? 'GOOD' : 'MISS'}
                  fontSize={14}
                  color={e.result === 'perfect' ? '#fdd835' : e.result === 'good' ? '#4fc3f7' : '#ef5350'}
                  align="center"
                  baseline="middle"
                  zIndex={10}
                />
              </Entity>
            ))}

            {/* Combo display */}
            {combo >= 5 && (
              <Entity tags={['combo']}>
                <Transform x={W / 2} y={H / 2 - 40} />
                <Text text={`${combo} COMBO`} fontSize={28} color="#fdd83588" align="center" baseline="middle" zIndex={8} />
              </Entity>
            )}
          </World>
        </Game>

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ab47bc', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>RHYTHM</p>
              <p style={{ fontSize: 12, color: '#90a4ae', marginTop: 12 }}>
                Hit notes as they reach the line
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 12 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* Results overlay */}
        {gameState === 'results' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#fdd835', marginBottom: 8 }}>SONG COMPLETE</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 3, marginBottom: 16 }}>RESULTS</p>
              <p style={{ fontSize: 22, color: '#ab47bc', fontWeight: 700 }}>{score}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', marginTop: 12, fontSize: 13, color: '#90a4ae' }}>
                <span>Perfect</span><span style={{ color: '#fdd835', textAlign: 'right' }}>{perfects}</span>
                <span>Good</span><span style={{ color: '#4fc3f7', textAlign: 'right' }}>{goods}</span>
                <span>Miss</span><span style={{ color: '#ef5350', textAlign: 'right' }}>{misses}</span>
                <span>Max Combo</span><span style={{ color: '#ff7043', textAlign: 'right' }}>{maxCombo}</span>
              </div>
              <button onClick={restart} style={btnStyle}>Play Again</button>
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
        <span>D F J K &mdash; hit notes in 4 lanes</span>
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
  marginTop: 24, padding: '10px 32px', background: '#ab47bc', color: '#fff',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
