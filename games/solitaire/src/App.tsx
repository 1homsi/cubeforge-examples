import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite, Text } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 700
const H = 550
const CARD_W = 60
const CARD_H = 84
const COL_GAP = 14
const TABLEAU_Y = 180
const STACK_OFFSET = 22
const FOUNDATION_Y = 30
const STOCK_X = 30

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
type Color = 'red' | 'black'
type GameState = 'idle' | 'playing' | 'win'

interface Card {
  suit: Suit; rank: number; faceUp: boolean; id: string
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const SUIT_SYMBOLS: Record<Suit, string> = { hearts: 'H', diamonds: 'D', clubs: 'C', spades: 'S' }
const SUIT_COLORS: Record<Suit, string> = { hearts: '#ef5350', diamonds: '#ef5350', clubs: '#fff', spades: '#fff' }
const RANK_NAMES = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

function suitColor(suit: Suit): Color {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black'
}

function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ suit, rank, faceUp: false, id: `${suit}-${rank}` })
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

interface SolitaireState {
  tableau: Card[][]   // 7 columns
  foundations: Card[][] // 4 piles (one per suit)
  stock: Card[]
  waste: Card[]
}

function dealGame(): SolitaireState {
  const deck = createDeck()
  const tableau: Card[][] = Array.from({ length: 7 }, () => [])
  let idx = 0
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck[idx++]
      card.faceUp = row === col
      tableau[col].push(card)
    }
  }
  const stock = deck.slice(idx)
  stock.forEach(c => c.faceUp = false)
  return { tableau, foundations: [[], [], [], []], stock, waste: [] }
}

// ─── App ────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [moves, setMoves] = useState(0)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [timer, setTimer] = useState(0)

  const stateRef = useRef<SolitaireState>(dealGame())
  const selectedRef = useRef<{ source: string; cardIdx: number } | null>(null)
  const [, forceRender] = useReducer(n => n + 1, 0)

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return
    const id = setInterval(() => setTimer(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [gameState])

  const checkWin = useCallback(() => {
    const s = stateRef.current
    return s.foundations.every(f => f.length === 13)
  }, [])

  const handleClick = useCallback((source: string, cardIdx: number) => {
    if (gameState !== 'playing') return
    const s = stateRef.current
    const sel = selectedRef.current

    // Stock click
    if (source === 'stock') {
      if (s.stock.length > 0) {
        const card = s.stock.pop()!
        card.faceUp = true
        s.waste.push(card)
      } else {
        // Reset stock from waste
        s.stock = s.waste.reverse()
        s.stock.forEach(c => c.faceUp = false)
        s.waste = []
      }
      selectedRef.current = null
      forceRender()
      return
    }

    // Waste click - select top card
    if (source === 'waste') {
      if (s.waste.length > 0) {
        selectedRef.current = { source: 'waste', cardIdx: s.waste.length - 1 }
      }
      forceRender()
      return
    }

    // Foundation click
    if (source.startsWith('foundation-')) {
      const fi = parseInt(source.split('-')[1])
      if (sel) {
        // Try to move selected to foundation
        const cards = getSelectedCards(s, sel)
        if (cards && cards.length === 1) {
          const card = cards[0]
          const foundation = s.foundations[fi]
          if (canPlaceOnFoundation(foundation, card)) {
            removeSelectedCards(s, sel)
            foundation.push(card)
            setMoves(m => m + 1)
            flipTopCard(s, sel.source)
            selectedRef.current = null
            if (checkWin()) setGameState('win')
            forceRender()
            return
          }
        }
        selectedRef.current = null
        forceRender()
        return
      }
      return
    }

    // Tableau click
    if (source.startsWith('tableau-')) {
      const col = parseInt(source.split('-')[1])
      const column = s.tableau[col]

      if (sel) {
        // Try to move selected to this column
        const cards = getSelectedCards(s, sel)
        if (cards && cards.length > 0) {
          const bottomCard = cards[0]
          if (canPlaceOnTableau(column, bottomCard)) {
            removeSelectedCards(s, sel)
            column.push(...cards)
            setMoves(m => m + 1)
            flipTopCard(s, sel.source)
            selectedRef.current = null
            forceRender()
            return
          }
        }
        selectedRef.current = null
        forceRender()
        return
      }

      // Select card(s) from this column
      if (column.length > 0) {
        // Find first face-up card at or below clicked position
        const faceUpStart = column.findIndex(c => c.faceUp)
        if (faceUpStart >= 0 && cardIdx >= faceUpStart) {
          selectedRef.current = { source, cardIdx: cardIdx }
        }
      }
      forceRender()
      return
    }
  }, [gameState, checkWin])

  // Double-click to auto-move to foundation
  const handleDoubleClick = useCallback((source: string, cardIdx: number) => {
    if (gameState !== 'playing') return
    const s = stateRef.current
    let card: Card | undefined

    if (source === 'waste' && s.waste.length > 0) {
      card = s.waste[s.waste.length - 1]
    } else if (source.startsWith('tableau-')) {
      const col = parseInt(source.split('-')[1])
      const column = s.tableau[col]
      if (cardIdx === column.length - 1 && column[cardIdx]?.faceUp) {
        card = column[cardIdx]
      }
    }

    if (!card) return

    // Try each foundation
    for (let fi = 0; fi < 4; fi++) {
      if (canPlaceOnFoundation(s.foundations[fi], card)) {
        const sel = { source, cardIdx }
        removeSelectedCards(s, sel)
        s.foundations[fi].push(card)
        setMoves(m => m + 1)
        flipTopCard(s, source)
        selectedRef.current = null
        if (checkWin()) setGameState('win')
        forceRender()
        return
      }
    }
  }, [gameState, checkWin])

  function restart() {
    stateRef.current = dealGame()
    selectedRef.current = null
    setMoves(0)
    setTimer(0)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((gameState === 'idle' || gameState === 'win') && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault(); restart()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gameState])

  const s = stateRef.current
  const sel = selectedRef.current
  const fmtTime = `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}`

  // Layout helpers
  const tableauX = (col: number) => 40 + col * (CARD_W + COL_GAP) + CARD_W / 2
  const foundationX = (i: number) => W - 40 - (3 - i) * (CARD_W + COL_GAP) - CARD_W / 2

  // Build render list
  const renderCards: { x: number; y: number; card: Card; source: string; cardIdx: number; selected: boolean; z: number }[] = []

  // Stock
  if (s.stock.length > 0) {
    renderCards.push({
      x: STOCK_X + CARD_W / 2, y: FOUNDATION_Y + CARD_H / 2,
      card: { suit: 'spades', rank: 0, faceUp: false, id: 'stock-top' },
      source: 'stock', cardIdx: 0, selected: false, z: 1,
    })
  }

  // Waste (show top 1)
  if (s.waste.length > 0) {
    const top = s.waste[s.waste.length - 1]
    const isSel = sel?.source === 'waste'
    renderCards.push({
      x: STOCK_X + CARD_W + COL_GAP + CARD_W / 2, y: FOUNDATION_Y + CARD_H / 2,
      card: top, source: 'waste', cardIdx: s.waste.length - 1, selected: isSel, z: 2,
    })
  }

  // Foundations
  for (let fi = 0; fi < 4; fi++) {
    const foundation = s.foundations[fi]
    const fx = foundationX(fi)
    if (foundation.length > 0) {
      const top = foundation[foundation.length - 1]
      renderCards.push({
        x: fx, y: FOUNDATION_Y + CARD_H / 2,
        card: top, source: `foundation-${fi}`, cardIdx: foundation.length - 1, selected: false, z: 2,
      })
    }
  }

  // Tableau
  for (let col = 0; col < 7; col++) {
    const column = s.tableau[col]
    const tx = tableauX(col)
    column.forEach((card, idx) => {
      const isSel = sel?.source === `tableau-${col}` && idx >= sel.cardIdx
      renderCards.push({
        x: tx, y: TABLEAU_Y + idx * STACK_OFFSET + CARD_H / 2,
        card, source: `tableau-${col}`, cardIdx: idx, selected: isSel, z: 3 + idx,
      })
    })
  }

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
          <span style={{ color: '#66bb6a', fontWeight: 700, fontSize: 16, letterSpacing: 2 }}>{fmtTime}</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>SOLITAIRE</div>
      </div>

      {/* Game */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#1b5e20">
            <Camera2D x={W / 2} y={H / 2} background="#1b5e20" />

            {/* Foundation placeholders */}
            {Array.from({ length: 4 }, (_, i) => (
              <Entity key={`fp${i}`} tags={['placeholder']}>
                <Transform x={foundationX(i)} y={FOUNDATION_Y + CARD_H / 2} />
                <Sprite width={CARD_W} height={CARD_H} color="#2e7d32" zIndex={0} />
              </Entity>
            ))}

            {/* Stock placeholder */}
            <Entity tags={['placeholder']}>
              <Transform x={STOCK_X + CARD_W / 2} y={FOUNDATION_Y + CARD_H / 2} />
              <Sprite width={CARD_W} height={CARD_H} color="#2e7d32" zIndex={0} />
            </Entity>

            {/* Cards */}
            {renderCards.map((rc, i) => {
              const cardColor = rc.card.faceUp ? '#f5f5f5' : '#1565c0'
              return (
                <Entity key={`card-${i}-${rc.card.id}`} tags={['card']}>
                  <Transform x={rc.x} y={rc.y} />
                  <Sprite
                    width={CARD_W}
                    height={CARD_H}
                    color={rc.selected ? '#fff9c4' : cardColor}
                    zIndex={rc.z}
                  />
                  {rc.card.faceUp && rc.card.rank > 0 && (
                    <Text
                      text={`${RANK_NAMES[rc.card.rank]}${SUIT_SYMBOLS[rc.card.suit]}`}
                      fontSize={12}
                      color={SUIT_COLORS[rc.card.suit]}
                      align="center"
                      baseline="middle"
                      zIndex={rc.z + 100}
                    />
                  )}
                </Entity>
              )
            })}

            {/* Foundation suit labels */}
            {Array.from({ length: 4 }, (_, i) => (
              <Entity key={`fl${i}`} tags={['label']}>
                <Transform x={foundationX(i)} y={FOUNDATION_Y + CARD_H / 2} />
                <Text
                  text={SUIT_SYMBOLS[SUITS[i]]}
                  fontSize={20}
                  color="#388e3c"
                  align="center"
                  baseline="middle"
                  zIndex={0}
                />
              </Entity>
            ))}
          </World>
        </Game>

        {/* Click overlay */}
        <div
          style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const mx = e.clientX - rect.left
            const my = e.clientY - rect.top

            // Check stock
            if (Math.abs(mx - (STOCK_X + CARD_W / 2)) < CARD_W / 2 && Math.abs(my - (FOUNDATION_Y + CARD_H / 2)) < CARD_H / 2) {
              handleClick('stock', 0)
              return
            }

            // Check waste
            if (Math.abs(mx - (STOCK_X + CARD_W + COL_GAP + CARD_W / 2)) < CARD_W / 2 && Math.abs(my - (FOUNDATION_Y + CARD_H / 2)) < CARD_H / 2) {
              handleClick('waste', s.waste.length - 1)
              return
            }

            // Check foundations
            for (let fi = 0; fi < 4; fi++) {
              if (Math.abs(mx - foundationX(fi)) < CARD_W / 2 && Math.abs(my - (FOUNDATION_Y + CARD_H / 2)) < CARD_H / 2) {
                handleClick(`foundation-${fi}`, 0)
                return
              }
            }

            // Check tableau
            for (let col = 0; col < 7; col++) {
              const tx = tableauX(col)
              if (Math.abs(mx - tx) < CARD_W / 2) {
                const column = s.tableau[col]
                // Find which card was clicked (reverse order for overlap)
                let clickedIdx = -1
                for (let idx = column.length - 1; idx >= 0; idx--) {
                  const cy = TABLEAU_Y + idx * STACK_OFFSET + CARD_H / 2
                  if (my >= cy - CARD_H / 2 && my <= cy + CARD_H / 2) {
                    clickedIdx = idx
                    break
                  }
                }
                if (clickedIdx >= 0) {
                  handleClick(`tableau-${col}`, clickedIdx)
                  return
                }
                // Click empty column
                if (column.length === 0 && my >= TABLEAU_Y && my <= TABLEAU_Y + CARD_H) {
                  handleClick(`tableau-${col}`, 0)
                  return
                }
              }
            }

            // Click elsewhere = deselect
            selectedRef.current = null
            forceRender()
          }}
          onDoubleClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const mx = e.clientX - rect.left
            const my = e.clientY - rect.top

            // Waste double-click
            if (Math.abs(mx - (STOCK_X + CARD_W + COL_GAP + CARD_W / 2)) < CARD_W / 2 && Math.abs(my - (FOUNDATION_Y + CARD_H / 2)) < CARD_H / 2) {
              handleDoubleClick('waste', s.waste.length - 1)
              return
            }

            // Tableau double-click
            for (let col = 0; col < 7; col++) {
              const tx = tableauX(col)
              if (Math.abs(mx - tx) < CARD_W / 2) {
                const column = s.tableau[col]
                if (column.length > 0) {
                  const lastIdx = column.length - 1
                  const cy = TABLEAU_Y + lastIdx * STACK_OFFSET + CARD_H / 2
                  if (my >= cy - CARD_H / 2 && my <= cy + CARD_H / 2) {
                    handleDoubleClick(`tableau-${col}`, lastIdx)
                    return
                  }
                }
              }
            }
          }}
        />

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#66bb6a', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>SOLITAIRE</p>
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
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#fdd835', marginBottom: 8 }}>CONGRATULATIONS</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0' }}>
                {moves} moves &nbsp;&middot;&nbsp; {fmtTime}
              </p>
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
        <span>Click to select/move &nbsp;&middot;&nbsp; Double-click to auto-move to foundation &nbsp;&middot;&nbsp; Click stock to draw</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Solitaire helpers ──────────────────────────────────────────────────────
function getSelectedCards(s: SolitaireState, sel: { source: string; cardIdx: number }): Card[] | null {
  if (sel.source === 'waste') {
    return s.waste.length > 0 ? [s.waste[s.waste.length - 1]] : null
  }
  if (sel.source.startsWith('tableau-')) {
    const col = parseInt(sel.source.split('-')[1])
    return s.tableau[col].slice(sel.cardIdx)
  }
  return null
}

function removeSelectedCards(s: SolitaireState, sel: { source: string; cardIdx: number }) {
  if (sel.source === 'waste') {
    s.waste.pop()
  } else if (sel.source.startsWith('tableau-')) {
    const col = parseInt(sel.source.split('-')[1])
    s.tableau[col] = s.tableau[col].slice(0, sel.cardIdx)
  }
}

function flipTopCard(s: SolitaireState, source: string) {
  if (source.startsWith('tableau-')) {
    const col = parseInt(source.split('-')[1])
    const column = s.tableau[col]
    if (column.length > 0 && !column[column.length - 1].faceUp) {
      column[column.length - 1].faceUp = true
    }
  }
}

function canPlaceOnFoundation(foundation: Card[], card: Card): boolean {
  if (foundation.length === 0) return card.rank === 1
  const top = foundation[foundation.length - 1]
  return top.suit === card.suit && card.rank === top.rank + 1
}

function canPlaceOnTableau(column: Card[], card: Card): boolean {
  if (column.length === 0) return card.rank === 13
  const top = column[column.length - 1]
  if (!top.faceUp) return false
  return suitColor(card.suit) !== suitColor(top.suit) && card.rank === top.rank - 1
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
  marginTop: 24, padding: '10px 32px', background: '#66bb6a', color: '#0a0a0f',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
