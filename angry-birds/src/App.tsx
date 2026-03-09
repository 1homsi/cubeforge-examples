import { useEffect, useReducer, useRef, useState, useCallback } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 800
const H = 500
const GROUND_Y = H - 50
const GRAVITY = 800
const DT = 1 / 60
const SLING_X = 140
const SLING_Y = GROUND_Y - 70
const LAUNCH_POWER = 9
const TRAJECTORY_DOTS = 12

// ─── Types ────────────────────────────────────────────────────────────────────
type GamePhase = 'idle' | 'aiming' | 'flying' | 'ability' | 'settling' | 'levelComplete' | 'gameover'
type BirdType = 'red' | 'yellow' | 'blue' | 'bomb'
type BlockMaterial = 'wood' | 'stone' | 'glass' | 'ice'

interface Bird {
  x: number; y: number; vx: number; vy: number
  type: BirdType; active: boolean; landed: boolean
  abilityUsed: boolean; rotation: number
}

interface Block {
  x: number; y: number; w: number; h: number
  hp: number; maxHp: number; id: number
  material: BlockMaterial; rotation: number
  vx: number; vy: number; angVel: number
}

interface Pig {
  x: number; y: number; r: number
  hp: number; alive: boolean; id: number
  vx: number; vy: number; hurt: number
}

interface Debris {
  x: number; y: number; vx: number; vy: number
  size: number; color: string; life: number; rotation: number; angVel: number
}

interface Level {
  birds: BirdType[]
  blocks: Omit<Block, 'id' | 'vx' | 'vy' | 'angVel' | 'rotation'>[]
  pigs: Omit<Pig, 'id' | 'vx' | 'vy' | 'hurt'>[]
}

// ─── Bird configs ─────────────────────────────────────────────────────────────
const BIRD_COLORS: Record<BirdType, string> = {
  red: '#ef5350', yellow: '#fdd835', blue: '#4fc3f7', bomb: '#37474f',
}
const BIRD_SIZE: Record<BirdType, number> = {
  red: 18, yellow: 16, blue: 14, bomb: 22,
}
const BIRD_NAMES: Record<BirdType, string> = {
  red: 'Red', yellow: 'Speed', blue: 'Split', bomb: 'Bomb',
}

// ─── Material configs ─────────────────────────────────────────────────────────
const MAT_COLORS: Record<BlockMaterial, { full: string; mid: string; low: string }> = {
  wood:  { full: '#8d6e63', mid: '#a1887f', low: '#bcaaa4' },
  stone: { full: '#78909c', mid: '#90a4ae', low: '#b0bec5' },
  glass: { full: '#4dd0e1', mid: '#80deea', low: '#b2ebf2' },
  ice:   { full: '#81d4fa', mid: '#b3e5fc', low: '#e1f5fe' },
}
const MAT_DEBRIS: Record<BlockMaterial, string[]> = {
  wood:  ['#8d6e63', '#a1887f', '#6d4c41', '#d7ccc8'],
  stone: ['#78909c', '#546e7a', '#90a4ae', '#b0bec5'],
  glass: ['#4dd0e1', '#80deea', '#e0f7fa', '#b2ebf2'],
  ice:   ['#81d4fa', '#b3e5fc', '#e1f5fe', '#4fc3f7'],
}

// ─── Levels ───────────────────────────────────────────────────────────────────
const LEVELS: Level[] = [
  // Level 1 — simple intro
  {
    birds: ['red', 'red', 'red'],
    blocks: [
      { x: 520, y: GROUND_Y - 30, w: 16, h: 60, hp: 2, maxHp: 2, material: 'wood' },
      { x: 580, y: GROUND_Y - 30, w: 16, h: 60, hp: 2, maxHp: 2, material: 'wood' },
      { x: 550, y: GROUND_Y - 68, w: 80, h: 12, hp: 1, maxHp: 1, material: 'wood' },
    ],
    pigs: [{ x: 550, y: GROUND_Y - 14, r: 14, hp: 2, alive: true }],
  },
  // Level 2 — glass + wood
  {
    birds: ['red', 'yellow', 'red'],
    blocks: [
      { x: 480, y: GROUND_Y - 25, w: 14, h: 50, hp: 1, maxHp: 1, material: 'glass' },
      { x: 540, y: GROUND_Y - 25, w: 14, h: 50, hp: 1, maxHp: 1, material: 'glass' },
      { x: 510, y: GROUND_Y - 58, w: 80, h: 12, hp: 2, maxHp: 2, material: 'wood' },
      { x: 630, y: GROUND_Y - 30, w: 16, h: 60, hp: 2, maxHp: 2, material: 'wood' },
      { x: 690, y: GROUND_Y - 30, w: 16, h: 60, hp: 2, maxHp: 2, material: 'wood' },
      { x: 660, y: GROUND_Y - 68, w: 80, h: 12, hp: 2, maxHp: 2, material: 'wood' },
    ],
    pigs: [
      { x: 510, y: GROUND_Y - 14, r: 12, hp: 1, alive: true },
      { x: 660, y: GROUND_Y - 14, r: 14, hp: 2, alive: true },
    ],
  },
  // Level 3 — stone fortress
  {
    birds: ['red', 'bomb', 'yellow', 'red'],
    blocks: [
      // Outer walls
      { x: 500, y: GROUND_Y - 40, w: 16, h: 80, hp: 4, maxHp: 4, material: 'stone' },
      { x: 660, y: GROUND_Y - 40, w: 16, h: 80, hp: 4, maxHp: 4, material: 'stone' },
      { x: 580, y: GROUND_Y - 88, w: 180, h: 14, hp: 4, maxHp: 4, material: 'stone' },
      // Inner wood
      { x: 545, y: GROUND_Y - 25, w: 12, h: 50, hp: 2, maxHp: 2, material: 'wood' },
      { x: 615, y: GROUND_Y - 25, w: 12, h: 50, hp: 2, maxHp: 2, material: 'wood' },
      { x: 580, y: GROUND_Y - 58, w: 80, h: 10, hp: 1, maxHp: 1, material: 'wood' },
      // Glass on top
      { x: 550, y: GROUND_Y - 108, w: 12, h: 30, hp: 1, maxHp: 1, material: 'glass' },
      { x: 610, y: GROUND_Y - 108, w: 12, h: 30, hp: 1, maxHp: 1, material: 'glass' },
      { x: 580, y: GROUND_Y - 128, w: 80, h: 10, hp: 1, maxHp: 1, material: 'glass' },
    ],
    pigs: [
      { x: 580, y: GROUND_Y - 14, r: 14, hp: 2, alive: true },
      { x: 580, y: GROUND_Y - 74, r: 12, hp: 1, alive: true },
      { x: 580, y: GROUND_Y - 140, r: 10, hp: 1, alive: true },
    ],
  },
  // Level 4 — ice towers with splits
  {
    birds: ['blue', 'blue', 'red', 'yellow'],
    blocks: [
      // Tower left
      { x: 460, y: GROUND_Y - 30, w: 14, h: 60, hp: 1, maxHp: 1, material: 'ice' },
      { x: 510, y: GROUND_Y - 30, w: 14, h: 60, hp: 1, maxHp: 1, material: 'ice' },
      { x: 485, y: GROUND_Y - 68, w: 70, h: 12, hp: 1, maxHp: 1, material: 'ice' },
      // Tower mid
      { x: 580, y: GROUND_Y - 30, w: 14, h: 60, hp: 1, maxHp: 1, material: 'ice' },
      { x: 630, y: GROUND_Y - 30, w: 14, h: 60, hp: 1, maxHp: 1, material: 'ice' },
      { x: 605, y: GROUND_Y - 68, w: 70, h: 12, hp: 1, maxHp: 1, material: 'ice' },
      // Tower right
      { x: 700, y: GROUND_Y - 30, w: 14, h: 60, hp: 1, maxHp: 1, material: 'ice' },
      { x: 750, y: GROUND_Y - 30, w: 14, h: 60, hp: 1, maxHp: 1, material: 'ice' },
      { x: 725, y: GROUND_Y - 68, w: 70, h: 12, hp: 1, maxHp: 1, material: 'ice' },
    ],
    pigs: [
      { x: 485, y: GROUND_Y - 14, r: 12, hp: 1, alive: true },
      { x: 605, y: GROUND_Y - 14, r: 12, hp: 1, alive: true },
      { x: 725, y: GROUND_Y - 14, r: 12, hp: 1, alive: true },
    ],
  },
  // Level 5 — mega fortress
  {
    birds: ['bomb', 'yellow', 'blue', 'red', 'bomb'],
    blocks: [
      // Base stone walls
      { x: 470, y: GROUND_Y - 50, w: 18, h: 100, hp: 4, maxHp: 4, material: 'stone' },
      { x: 690, y: GROUND_Y - 50, w: 18, h: 100, hp: 4, maxHp: 4, material: 'stone' },
      { x: 580, y: GROUND_Y - 108, w: 240, h: 14, hp: 4, maxHp: 4, material: 'stone' },
      // Wood inner structure
      { x: 520, y: GROUND_Y - 30, w: 14, h: 60, hp: 2, maxHp: 2, material: 'wood' },
      { x: 640, y: GROUND_Y - 30, w: 14, h: 60, hp: 2, maxHp: 2, material: 'wood' },
      { x: 580, y: GROUND_Y - 68, w: 140, h: 12, hp: 2, maxHp: 2, material: 'wood' },
      // Upper glass towers
      { x: 530, y: GROUND_Y - 130, w: 12, h: 36, hp: 1, maxHp: 1, material: 'glass' },
      { x: 580, y: GROUND_Y - 130, w: 12, h: 36, hp: 1, maxHp: 1, material: 'glass' },
      { x: 630, y: GROUND_Y - 130, w: 12, h: 36, hp: 1, maxHp: 1, material: 'glass' },
      { x: 580, y: GROUND_Y - 154, w: 120, h: 10, hp: 1, maxHp: 1, material: 'glass' },
      // Ice crown
      { x: 560, y: GROUND_Y - 172, w: 10, h: 26, hp: 1, maxHp: 1, material: 'ice' },
      { x: 600, y: GROUND_Y - 172, w: 10, h: 26, hp: 1, maxHp: 1, material: 'ice' },
      { x: 580, y: GROUND_Y - 190, w: 60, h: 8, hp: 1, maxHp: 1, material: 'ice' },
    ],
    pigs: [
      { x: 580, y: GROUND_Y - 14, r: 16, hp: 3, alive: true },
      { x: 530, y: GROUND_Y - 82, r: 12, hp: 1, alive: true },
      { x: 630, y: GROUND_Y - 82, r: 12, hp: 1, alive: true },
      { x: 580, y: GROUND_Y - 200, r: 10, hp: 1, alive: true },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function circleRect(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number) {
  const hw = rw / 2, hh = rh / 2
  const closestX = Math.max(rx - hw, Math.min(cx, rx + hw))
  const closestY = Math.max(ry - hh, Math.min(cy, ry + hh))
  const dx = cx - closestX, dy = cy - closestY
  return dx * dx + dy * dy < cr * cr
}

function circleCircle(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
  const dx = x1 - x2, dy = y1 - y2
  return dx * dx + dy * dy < (r1 + r2) * (r1 + r2)
}

function spawnDebris(arr: Debris[], x: number, y: number, material: BlockMaterial, count: number) {
  const colors = MAT_DEBRIS[material]
  for (let i = 0; i < count; i++) {
    arr.push({
      x, y: y - Math.random() * 10,
      vx: (Math.random() - 0.5) * 300,
      vy: -Math.random() * 250 - 50,
      size: 3 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0.6 + Math.random() * 0.8,
      rotation: Math.random() * Math.PI * 2,
      angVel: (Math.random() - 0.5) * 15,
    })
  }
}

function trajectoryPoint(x: number, y: number, vx: number, vy: number, t: number) {
  return { x: x + vx * t, y: y + vy * t + 0.5 * GRAVITY * t * t }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [level, setLevel] = useState(0)
  const [score, setScore] = useState(0)
  const [, setTotalScore] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [birdIdx, setBirdIdx] = useState(0)

  const birdRef = useRef<Bird>({ x: SLING_X, y: SLING_Y, vx: 0, vy: 0, type: 'red', active: false, landed: false, abilityUsed: false, rotation: 0 })
  const blocksRef = useRef<Block[]>([])
  const pigsRef = useRef<Pig[]>([])
  const debrisRef = useRef<Debris[]>([])
  const aimRef = useRef({ dragging: false, curX: 0, curY: 0 })
  const settleTimerRef = useRef(0)
  const levelBirdsRef = useRef<BirdType[]>([])
  const scoreRef = useRef(0)

  const [, forceRender] = useReducer(n => n + 1, 0)

  const initLevel = useCallback((lvl: number) => {
    const def = LEVELS[lvl]
    let nextId = 1
    blocksRef.current = def.blocks.map(b => ({ ...b, id: nextId++, vx: 0, vy: 0, angVel: 0, rotation: 0 }))
    pigsRef.current = def.pigs.map(p => ({ ...p, id: nextId++, vx: 0, vy: 0, hurt: 0 }))
    debrisRef.current = []
    levelBirdsRef.current = [...def.birds]
    setBirdIdx(0)
    birdRef.current = {
      x: SLING_X, y: SLING_Y, vx: 0, vy: 0,
      type: def.birds[0], active: false, landed: false, abilityUsed: false, rotation: 0,
    }
    scoreRef.current = 0
    setScore(0)
    settleTimerRef.current = 0
  }, [])

  // ─── Physics loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'flying' && phase !== 'ability' && phase !== 'settling') return

    const id = setInterval(() => {
      const bird = birdRef.current
      const blocks = blocksRef.current
      const pigs = pigsRef.current
      const debris = debrisRef.current

      // ── Bird physics ──
      if (bird.active && !bird.landed) {
        bird.vy += GRAVITY * DT
        bird.x += bird.vx * DT
        bird.y += bird.vy * DT
        bird.rotation += Math.atan2(bird.vy, bird.vx) * 0.05

        // Ground
        const birdR = BIRD_SIZE[bird.type] / 2
        if (bird.y >= GROUND_Y - birdR) {
          bird.y = GROUND_Y - birdR
          bird.vy *= -0.3
          bird.vx *= 0.6
          if (Math.abs(bird.vx) < 8 && Math.abs(bird.vy) < 8) {
            bird.vx = 0; bird.vy = 0; bird.landed = true
          }
        }
        // Walls
        if (bird.x < birdR) { bird.x = birdR; bird.vx *= -0.5 }
        if (bird.x > W - birdR) { bird.x = W - birdR; bird.vx *= -0.5 }
        if (bird.y < birdR) { bird.y = birdR; bird.vy *= -0.5 }

        // Bird vs blocks
        for (const block of blocks) {
          if (block.hp <= 0) continue
          if (!circleRect(bird.x, bird.y, birdR, block.x, block.y, block.w, block.h)) continue

          const impactForce = Math.sqrt(bird.vx * bird.vx + bird.vy * bird.vy)
          const dmg = bird.type === 'bomb' ? 3 : bird.type === 'yellow' ? 2 : 1
          block.hp -= dmg

          // Momentum transfer
          const pushX = bird.x - block.x, pushY = bird.y - block.y
          const pushDist = Math.sqrt(pushX * pushX + pushY * pushY) || 1
          block.vx += (pushX / pushDist) * impactForce * 0.4 * (bird.type === 'bomb' ? 2 : 1)
          block.vy += (pushY / pushDist) * impactForce * 0.4
          block.angVel += (Math.random() - 0.5) * 8

          bird.vx *= 0.3; bird.vy *= -0.2

          scoreRef.current += 50
          if (block.hp <= 0) {
            spawnDebris(debris, block.x, block.y, block.material, 6 + Math.floor(Math.random() * 4))
            scoreRef.current += 100
          }
        }

        // Bird vs pigs
        for (const pig of pigs) {
          if (!pig.alive) continue
          if (!circleCircle(bird.x, bird.y, birdR, pig.x, pig.y, pig.r)) continue

          const impactForce = Math.sqrt(bird.vx * bird.vx + bird.vy * bird.vy)
          const dmg = bird.type === 'bomb' ? 3 : bird.type === 'yellow' ? 2 : 1
          pig.hp -= dmg
          pig.hurt = 0.3

          const pushX = pig.x - bird.x, pushY = pig.y - bird.y
          const pushDist = Math.sqrt(pushX * pushX + pushY * pushY) || 1
          pig.vx += (pushX / pushDist) * impactForce * 0.5
          pig.vy += (pushY / pushDist) * impactForce * 0.5

          bird.vx *= 0.4; bird.vy *= 0.2

          if (pig.hp <= 0) {
            pig.alive = false
            scoreRef.current += 500
            spawnDebris(debris, pig.x, pig.y, 'wood', 4)
          }
        }
      }

      // ── Block physics ──
      for (const block of blocks) {
        if (block.hp <= 0) continue
        const moving = Math.abs(block.vx) > 1 || Math.abs(block.vy) > 1

        if (moving) {
          block.vy += GRAVITY * DT * 0.6
          block.x += block.vx * DT
          block.y += block.vy * DT
          block.rotation += block.angVel * DT
          block.vx *= 0.97
          block.angVel *= 0.95

          // Ground
          if (block.y + block.h / 2 >= GROUND_Y) {
            block.y = GROUND_Y - block.h / 2
            if (Math.abs(block.vy) > 100) { block.hp--; scoreRef.current += 20 }
            block.vy *= -0.2
            block.vx *= 0.7
            block.angVel *= 0.5
          }
          // Walls
          if (block.x - block.w / 2 < 0) { block.x = block.w / 2; block.vx *= -0.3 }
          if (block.x + block.w / 2 > W) { block.x = W - block.w / 2; block.vx *= -0.3 }
        }

        // Block vs block
        for (const other of blocks) {
          if (other === block || other.hp <= 0) continue
          const overlapX = (block.w + other.w) / 2 - Math.abs(block.x - other.x)
          const overlapY = (block.h + other.h) / 2 - Math.abs(block.y - other.y)
          if (overlapX > 0 && overlapY > 0 && moving) {
            const relVel = Math.abs(block.vx - other.vx) + Math.abs(block.vy - other.vy)
            if (relVel > 30) {
              other.hp--
              other.vx += block.vx * 0.4
              other.vy += block.vy * 0.4
              other.angVel += (Math.random() - 0.5) * 5
              block.vx *= 0.4
              scoreRef.current += 30
              if (other.hp <= 0) {
                spawnDebris(debris, other.x, other.y, other.material, 5)
                scoreRef.current += 100
              }
            }
          }
        }

        // Block vs pig
        for (const pig of pigs) {
          if (!pig.alive) continue
          if (!circleRect(pig.x, pig.y, pig.r, block.x, block.y, block.w, block.h)) continue
          if (!moving) continue
          const relVel = Math.abs(block.vx) + Math.abs(block.vy)
          if (relVel > 30) {
            pig.hp--
            pig.hurt = 0.3
            pig.vx += block.vx * 0.3
            pig.vy += block.vy * 0.3
            if (pig.hp <= 0) {
              pig.alive = false
              scoreRef.current += 500
              spawnDebris(debris, pig.x, pig.y, 'wood', 4)
            }
          }
        }

        // Destroy block if below screen
        if (block.hp > 0 && block.y > H + 50) {
          block.hp = 0
          scoreRef.current += 50
        }
      }

      // ── Pig physics ──
      for (const pig of pigs) {
        if (!pig.alive) continue
        pig.hurt = Math.max(0, pig.hurt - DT)
        if (Math.abs(pig.vx) > 1 || Math.abs(pig.vy) > 1) {
          pig.vy += GRAVITY * DT * 0.5
          pig.x += pig.vx * DT
          pig.y += pig.vy * DT
          pig.vx *= 0.96
          if (pig.y + pig.r >= GROUND_Y) {
            pig.y = GROUND_Y - pig.r
            if (Math.abs(pig.vy) > 120) { pig.hp--; pig.hurt = 0.3 }
            pig.vy *= -0.15
            pig.vx *= 0.6
          }
          if (pig.hp <= 0) {
            pig.alive = false
            scoreRef.current += 500
            spawnDebris(debrisRef.current, pig.x, pig.y, 'wood', 4)
          }
        }
      }

      // ── Debris physics ──
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i]
        d.vy += GRAVITY * DT
        d.x += d.vx * DT
        d.y += d.vy * DT
        d.rotation += d.angVel * DT
        d.life -= DT
        if (d.y > GROUND_Y) { d.y = GROUND_Y; d.vy *= -0.3; d.vx *= 0.5 }
        if (d.life <= 0) debris.splice(i, 1)
      }

      setScore(scoreRef.current)

      // ── Settling check ──
      if (bird.landed || (bird.active && bird.y > H + 50)) {
        settleTimerRef.current += DT
        if (settleTimerRef.current > 1.2) {
          const alive = pigs.filter(p => p.alive).length
          if (alive === 0) {
            // Bonus for leftover birds
            const remaining = levelBirdsRef.current.length - (birdIdx + 1)
            scoreRef.current += remaining * 1000
            setScore(scoreRef.current)
            setPhase('levelComplete')
          } else {
            const nextIdx = birdIdx + 1
            if (nextIdx >= levelBirdsRef.current.length) {
              setPhase('gameover')
            } else {
              setBirdIdx(nextIdx)
              birdRef.current = {
                x: SLING_X, y: SLING_Y, vx: 0, vy: 0,
                type: levelBirdsRef.current[nextIdx],
                active: false, landed: false, abilityUsed: false, rotation: 0,
              }
              setPhase('aiming')
            }
          }
          settleTimerRef.current = 0
        }
      }

      forceRender()
    }, DT * 1000)
    return () => clearInterval(id)
  }, [phase, birdIdx])

  // ─── Bird abilities (click during flight) ─────────────────────────────────
  const activateAbility = useCallback(() => {
    const bird = birdRef.current
    if (!bird.active || bird.landed || bird.abilityUsed) return
    bird.abilityUsed = true

    switch (bird.type) {
      case 'yellow': // Speed boost
        bird.vx *= 2.2
        bird.vy *= 0.7
        break
      case 'blue': { // Split into 3
        const spread = 0.25
        for (let i = -1; i <= 1; i += 2) {
          const angle = Math.atan2(bird.vy, bird.vx) + spread * i
          const speed = Math.sqrt(bird.vx * bird.vx + bird.vy * bird.vy)
          // Create virtual "split birds" as debris-like impacts
          const splitBird: Bird = {
            x: bird.x, y: bird.y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            type: 'blue', active: true, landed: false, abilityUsed: true, rotation: 0,
          }
          // Simulate split bird impacts
          simulateSplitBird(splitBird)
        }
        break
      }
      case 'bomb': { // Explosion — damage everything nearby
        const BLAST_RADIUS = 100
        for (const block of blocksRef.current) {
          if (block.hp <= 0) continue
          const dx = block.x - bird.x, dy = block.y - bird.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < BLAST_RADIUS) {
            const force = (1 - dist / BLAST_RADIUS) * 600
            block.vx += (dx / (dist || 1)) * force
            block.vy += (dy / (dist || 1)) * force - 200
            block.angVel += (Math.random() - 0.5) * 15
            block.hp -= 2
            scoreRef.current += 50
            if (block.hp <= 0) {
              spawnDebris(debrisRef.current, block.x, block.y, block.material, 8)
              scoreRef.current += 100
            }
          }
        }
        for (const pig of pigsRef.current) {
          if (!pig.alive) continue
          const dx = pig.x - bird.x, dy = pig.y - bird.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < BLAST_RADIUS) {
            const force = (1 - dist / BLAST_RADIUS) * 500
            pig.vx += (dx / (dist || 1)) * force
            pig.vy += (dy / (dist || 1)) * force - 150
            pig.hp -= 2
            pig.hurt = 0.5
            if (pig.hp <= 0) {
              pig.alive = false
              scoreRef.current += 500
              spawnDebris(debrisRef.current, pig.x, pig.y, 'wood', 4)
            }
          }
        }
        // Explosion debris
        spawnDebris(debrisRef.current, bird.x, bird.y, 'stone', 12)
        bird.landed = true
        break
      }
    }
    forceRender()
  }, [])

  function simulateSplitBird(splitBird: Bird) {
    // Quick forward-sim for split birds
    for (let t = 0; t < 60; t++) {
      splitBird.vy += GRAVITY * DT
      splitBird.x += splitBird.vx * DT
      splitBird.y += splitBird.vy * DT
      if (splitBird.y > GROUND_Y) break

      const r = BIRD_SIZE.blue / 2
      for (const block of blocksRef.current) {
        if (block.hp <= 0) continue
        if (circleRect(splitBird.x, splitBird.y, r, block.x, block.y, block.w, block.h)) {
          block.hp--
          block.vx += splitBird.vx * 0.3
          block.vy += splitBird.vy * 0.3
          block.angVel += (Math.random() - 0.5) * 5
          scoreRef.current += 50
          if (block.hp <= 0) {
            spawnDebris(debrisRef.current, block.x, block.y, block.material, 6)
            scoreRef.current += 100
          }
          return
        }
      }
      for (const pig of pigsRef.current) {
        if (!pig.alive) continue
        if (circleCircle(splitBird.x, splitBird.y, r, pig.x, pig.y, pig.r)) {
          pig.hp--
          pig.hurt = 0.3
          pig.vx += splitBird.vx * 0.4
          pig.vy += splitBird.vy * 0.4
          if (pig.hp <= 0) {
            pig.alive = false
            scoreRef.current += 500
          }
          return
        }
      }
    }
  }

  // ─── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (phase === 'flying' || phase === 'ability') {
      activateAbility()
      return
    }
    if (phase !== 'aiming') return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    if (Math.abs(mx - SLING_X) < 70 && Math.abs(my - SLING_Y) < 70) {
      aimRef.current = { dragging: true, curX: mx, curY: my }
    }
  }, [phase, activateAbility])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!aimRef.current.dragging) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const dx = SLING_X - mx, dy = SLING_Y - my
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxDist = 90
    if (dist > maxDist) {
      aimRef.current.curX = SLING_X - (dx / dist) * maxDist
      aimRef.current.curY = SLING_Y - (dy / dist) * maxDist
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
    const dx = SLING_X - aim.curX, dy = SLING_Y - aim.curY
    if (Math.sqrt(dx * dx + dy * dy) < 12) {
      bird.x = SLING_X; bird.y = SLING_Y
      forceRender()
      return
    }
    bird.vx = dx * LAUNCH_POWER
    bird.vy = dy * LAUNCH_POWER
    bird.active = true
    settleTimerRef.current = 0
    setPhase('flying')
    forceRender()
  }, [])

  // ─── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (phase === 'idle') { initLevel(0); setPhase('aiming') }
        else if (phase === 'gameover') { initLevel(level); setPhase('aiming') }
        else if (phase === 'levelComplete') { nextLevel() }
        else if (phase === 'flying' || phase === 'ability') { activateAbility() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, level, activateAbility])

  function nextLevel() {
    const next = level + 1
    if (next >= LEVELS.length) {
      setTotalScore(t => t + scoreRef.current)
      setLevel(0)
      setPhase('idle')
    } else {
      setTotalScore(t => t + scoreRef.current)
      setLevel(next)
      initLevel(next)
      setPhase('aiming')
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  const bird = birdRef.current
  const blocks = blocksRef.current
  const pigs = pigsRef.current
  const debris = debrisRef.current
  const aim = aimRef.current
  const alivePigs = pigs.filter(p => p.alive).length
  const birdsRemaining = levelBirdsRef.current.length - birdIdx
  const birdR = BIRD_SIZE[bird.type]
  const birdColor = BIRD_COLORS[bird.type]

  // Trajectory dots
  const trajectoryDots: { x: number; y: number }[] = []
  if (aim.dragging) {
    const vx = (SLING_X - aim.curX) * LAUNCH_POWER
    const vy = (SLING_Y - aim.curY) * LAUNCH_POWER
    for (let i = 1; i <= TRAJECTORY_DOTS; i++) {
      const t = i * 0.07
      trajectoryDots.push(trajectoryPoint(SLING_X, SLING_Y, vx, vy, t))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '8px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
        fontFamily: '"Courier New", monospace',
      }}>
        <div style={{ fontSize: 11, color: '#607d8b' }}>
          LVL {level + 1}/{LEVELS.length} &nbsp;&middot;&nbsp; {alivePigs} target{alivePigs !== 1 ? 's' : ''}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ff7043', fontWeight: 700, fontSize: 20, letterSpacing: 3 }}>
            {String(score).padStart(5, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>
          {bird.active && !bird.abilityUsed && bird.type !== 'red' && (
            <span style={{ color: BIRD_COLORS[bird.type], marginRight: 8 }}>
              TAP: {BIRD_NAMES[bird.type]}
            </span>
          )}
          ANGRY BIRDS
        </div>
      </div>

      {/* Game canvas */}
      <div
        style={{
          position: 'relative', width: W, height: H, overflow: 'hidden',
          cursor: phase === 'aiming' ? 'grab' : (phase === 'flying' && !bird.abilityUsed && bird.type !== 'red') ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { if (aimRef.current.dragging) handleMouseUp() }}
      >
        {/* Sky gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, #0a1628 0%, #1a2744 40%, #2e4a6e 100%)',
        }} />

        {/* Ground */}
        <div style={{
          position: 'absolute', left: 0, top: GROUND_Y, width: W, height: H - GROUND_Y,
          background: 'linear-gradient(180deg, #2e7d32 0%, #1b5e20 60%, #0d3310 100%)',
        }} />
        {/* Grass line */}
        <div style={{
          position: 'absolute', left: 0, top: GROUND_Y - 3, width: W, height: 6,
          background: '#4caf50', borderRadius: 3,
        }} />

        {/* Hills (background) */}
        {[200, 450, 650].map((hx, i) => (
          <div key={`hill${i}`} style={{
            position: 'absolute', left: hx - 80, top: GROUND_Y - 25 - i * 5,
            width: 160 + i * 20, height: 50 + i * 10,
            borderRadius: '50% 50% 0 0', background: '#1b5e20', opacity: 0.4,
          }} />
        ))}

        {/* Clouds */}
        {[{ x: 100, y: 40 }, { x: 350, y: 60 }, { x: 600, y: 30 }, { x: 750, y: 70 }].map((c, i) => (
          <div key={`cloud${i}`} style={{
            position: 'absolute', left: c.x, top: c.y,
            width: 60, height: 20, borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
          }} />
        ))}

        {/* Slingshot back prong */}
        <div style={{
          position: 'absolute', left: SLING_X - 12, top: SLING_Y - 20,
          width: 8, height: 30, background: '#5d4037', borderRadius: 3, zIndex: 2,
        }} />

        {/* Sling rubber band (when aiming) */}
        {aim.dragging && (
          <svg style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
            <line x1={SLING_X - 8} y1={SLING_Y - 8} x2={aim.curX} y2={aim.curY}
              stroke="#3e2723" strokeWidth={3} />
            <line x1={SLING_X + 8} y1={SLING_Y - 8} x2={aim.curX} y2={aim.curY}
              stroke="#3e2723" strokeWidth={3} />
          </svg>
        )}

        {/* Trajectory dots */}
        {trajectoryDots.map((dot, i) => (
          <div key={`td${i}`} style={{
            position: 'absolute',
            left: dot.x - 2, top: dot.y - 2,
            width: 4, height: 4, borderRadius: '50%',
            background: `rgba(255,255,255,${0.4 - i * 0.03})`,
            zIndex: 6, pointerEvents: 'none',
          }} />
        ))}

        {/* Bird */}
        {(phase !== 'idle') && (
          <div style={{
            position: 'absolute',
            left: bird.x - birdR, top: bird.y - birdR,
            width: birdR * 2, height: birdR * 2,
            borderRadius: '50%', background: birdColor,
            border: `2px solid ${bird.type === 'bomb' ? '#212121' : '#c62828'}`,
            zIndex: 10,
            transform: bird.active ? `rotate(${bird.rotation}rad)` : undefined,
            transition: bird.active ? undefined : 'left 0.05s, top 0.05s',
          }}>
            {/* Eyes */}
            <div style={{
              position: 'absolute', left: '30%', top: '25%',
              width: '18%', height: '22%', borderRadius: '50%', background: '#fff',
            }}>
              <div style={{
                position: 'absolute', right: 0, top: '30%',
                width: '60%', height: '50%', borderRadius: '50%', background: '#212121',
              }} />
            </div>
            <div style={{
              position: 'absolute', left: '55%', top: '25%',
              width: '18%', height: '22%', borderRadius: '50%', background: '#fff',
            }}>
              <div style={{
                position: 'absolute', right: 0, top: '30%',
                width: '60%', height: '50%', borderRadius: '50%', background: '#212121',
              }} />
            </div>
            {/* Beak */}
            <div style={{
              position: 'absolute', left: '60%', top: '48%',
              width: 0, height: 0,
              borderTop: '4px solid transparent',
              borderBottom: '4px solid transparent',
              borderLeft: `8px solid ${bird.type === 'yellow' ? '#ff8f00' : '#ff6f00'}`,
            }} />
            {/* Eyebrows (angry!) */}
            <div style={{
              position: 'absolute', left: '22%', top: '18%',
              width: '25%', height: 2, background: '#212121',
              transform: 'rotate(20deg)',
            }} />
            <div style={{
              position: 'absolute', left: '52%', top: '18%',
              width: '25%', height: 2, background: '#212121',
              transform: 'rotate(-20deg)',
            }} />
            {/* Bomb fuse */}
            {bird.type === 'bomb' && (
              <div style={{
                position: 'absolute', left: '40%', top: -8,
                width: 3, height: 10, background: '#8d6e63',
                borderRadius: 1,
              }}>
                <div style={{
                  position: 'absolute', top: -4, left: -2,
                  width: 7, height: 7, borderRadius: '50%',
                  background: bird.abilityUsed ? 'transparent' : '#ff6d00',
                  boxShadow: bird.abilityUsed ? 'none' : '0 0 6px #ff6d00',
                }} />
              </div>
            )}
          </div>
        )}

        {/* Slingshot front prong */}
        <div style={{
          position: 'absolute', left: SLING_X + 4, top: SLING_Y - 20,
          width: 8, height: 30, background: '#6d4c41', borderRadius: 3, zIndex: 12,
        }} />
        {/* Slingshot base */}
        <div style={{
          position: 'absolute', left: SLING_X - 6, top: SLING_Y + 5,
          width: 16, height: 45, background: '#5d4037', borderRadius: '4px 4px 6px 6px', zIndex: 1,
        }} />

        {/* Birds left indicator */}
        {phase !== 'idle' && Array.from({ length: Math.max(0, birdsRemaining - 1) }, (_, i) => {
          const nextBirdType = levelBirdsRef.current[birdIdx + 1 + i]
          if (!nextBirdType) return null
          return (
            <div key={`bl${i}`} style={{
              position: 'absolute', left: 30 + i * 26, top: GROUND_Y + 10,
              width: 16, height: 16, borderRadius: '50%',
              background: BIRD_COLORS[nextBirdType],
              border: '1px solid rgba(0,0,0,0.3)', zIndex: 5,
            }} />
          )
        })}

        {/* Blocks */}
        {blocks.filter(b => b.hp > 0).map(block => {
          const matColor = MAT_COLORS[block.material]
          const hpRatio = block.hp / block.maxHp
          const color = hpRatio > 0.6 ? matColor.full : hpRatio > 0.3 ? matColor.mid : matColor.low
          const cracks = block.hp < block.maxHp

          return (
            <div key={`b${block.id}`} style={{
              position: 'absolute',
              left: block.x - block.w / 2, top: block.y - block.h / 2,
              width: block.w, height: block.h,
              background: color,
              border: `1px solid ${block.material === 'glass' || block.material === 'ice' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`,
              borderRadius: block.material === 'glass' || block.material === 'ice' ? 2 : 1,
              transform: `rotate(${block.rotation}rad)`,
              zIndex: 5,
              opacity: block.material === 'glass' || block.material === 'ice' ? 0.85 : 1,
              boxShadow: cracks ? 'inset 0 0 4px rgba(0,0,0,0.3)' : undefined,
            }}>
              {/* Wood grain */}
              {block.material === 'wood' && block.h > 20 && (
                <>
                  <div style={{ position: 'absolute', left: '30%', top: '10%', width: 1, height: '80%', background: 'rgba(0,0,0,0.1)' }} />
                  <div style={{ position: 'absolute', left: '65%', top: '15%', width: 1, height: '70%', background: 'rgba(0,0,0,0.08)' }} />
                </>
              )}
              {/* Stone texture */}
              {block.material === 'stone' && block.h > 20 && (
                <div style={{ position: 'absolute', left: '40%', top: '50%', width: '30%', height: 1, background: 'rgba(0,0,0,0.15)' }} />
              )}
              {/* Crack lines */}
              {cracks && (
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <line x1="20%" y1="0" x2="60%" y2="100%" stroke="rgba(0,0,0,0.2)" strokeWidth={1} />
                  {block.hp <= block.maxHp / 2 && (
                    <line x1="70%" y1="0" x2="30%" y2="80%" stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
                  )}
                </svg>
              )}
            </div>
          )
        })}

        {/* Pigs */}
        {pigs.filter(p => p.alive).map(pig => (
          <div key={`p${pig.id}`} style={{
            position: 'absolute',
            left: pig.x - pig.r, top: pig.y - pig.r,
            width: pig.r * 2, height: pig.r * 2,
            borderRadius: '50%',
            background: pig.hurt > 0 ? '#ffab91' : '#66bb6a',
            border: `2px solid ${pig.hurt > 0 ? '#ff7043' : '#2e7d32'}`,
            zIndex: 6,
            transition: 'background 0.15s',
          }}>
            {/* Snout */}
            <div style={{
              position: 'absolute', left: '25%', top: '45%',
              width: '50%', height: '35%', borderRadius: '40%',
              background: pig.hurt > 0 ? '#ef9a9a' : '#43a047',
            }}>
              <div style={{ position: 'absolute', left: '20%', top: '35%', width: '20%', height: '30%', borderRadius: '50%', background: '#2e7d32' }} />
              <div style={{ position: 'absolute', right: '20%', top: '35%', width: '20%', height: '30%', borderRadius: '50%', background: '#2e7d32' }} />
            </div>
            {/* Eyes */}
            <div style={{
              position: 'absolute', left: '18%', top: '20%',
              width: '25%', height: '30%', borderRadius: '50%', background: '#fff',
            }}>
              <div style={{
                position: 'absolute', left: '40%', top: '40%',
                width: '40%', height: '40%', borderRadius: '50%', background: '#212121',
              }} />
            </div>
            <div style={{
              position: 'absolute', right: '18%', top: '20%',
              width: '25%', height: '30%', borderRadius: '50%', background: '#fff',
            }}>
              <div style={{
                position: 'absolute', left: '40%', top: '40%',
                width: '40%', height: '40%', borderRadius: '50%', background: '#212121',
              }} />
            </div>
            {/* Hurt expression */}
            {pig.hurt > 0 && (
              <>
                <div style={{
                  position: 'absolute', left: '20%', top: '18%',
                  width: '22%', height: 2, background: '#c62828',
                  transform: 'rotate(-15deg)',
                }} />
                <div style={{
                  position: 'absolute', right: '20%', top: '18%',
                  width: '22%', height: 2, background: '#c62828',
                  transform: 'rotate(15deg)',
                }} />
              </>
            )}
          </div>
        ))}

        {/* Debris */}
        {debris.map((d, i) => (
          <div key={`d${i}`} style={{
            position: 'absolute',
            left: d.x - d.size / 2, top: d.y - d.size / 2,
            width: d.size, height: d.size,
            background: d.color,
            borderRadius: Math.random() > 0.5 ? 1 : 0,
            transform: `rotate(${d.rotation}rad)`,
            opacity: Math.min(1, d.life * 2),
            zIndex: 15, pointerEvents: 'none',
          }} />
        ))}

        {/* ── Overlays ── */}
        {phase === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 10, letterSpacing: 4, color: '#ff7043', marginBottom: 6 }}>CUBEFORGE PRESENTS</p>
              <p style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>ANGRY BIRDS</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '16px 0' }}>
                {(['red', 'yellow', 'blue', 'bomb'] as BirdType[]).map(t => (
                  <div key={t} style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: BIRD_COLORS[t], border: '2px solid rgba(0,0,0,0.2)',
                  }} />
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#78909c', marginBottom: 4 }}>
                4 bird types &middot; 5 levels &middot; wood / stone / glass / ice
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 16 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {phase === 'levelComplete' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#66bb6a', marginBottom: 8 }}>LEVEL {level + 1} COMPLETE</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                {level + 1 < LEVELS.length ? 'NICE!' : 'YOU WIN!'}
              </p>
              <p style={{ fontSize: 14, color: '#90a4ae', margin: '12px 0' }}>
                Score: <strong style={{ color: '#ff7043' }}>{score}</strong>
                {birdsRemaining > 1 && (
                  <span style={{ color: '#66bb6a' }}> (+{(birdsRemaining - 1) * 1000} bird bonus)</span>
                )}
              </p>
              <button onClick={nextLevel} style={btnStyle}>
                {level + 1 < LEVELS.length ? `Level ${level + 2} →` : 'Play Again'}
              </button>
            </div>
          </div>
        )}

        {phase === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>NO BIRDS LEFT</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 14, color: '#90a4ae', margin: '12px 0' }}>
                Score: <strong style={{ color: '#ff7043' }}>{score}</strong>
                &nbsp;&middot;&nbsp; {alivePigs} pig{alivePigs !== 1 ? 's' : ''} remaining
              </p>
              <button onClick={() => { initLevel(level); setPhase('aiming') }} style={btnStyle}>
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5,
        display: 'flex', justifyContent: 'space-between',
        fontFamily: '"Courier New", monospace',
      }}>
        <span>
          Drag to aim &middot; Release to launch
          {bird.active && !bird.abilityUsed && bird.type !== 'red' && (
            <span style={{ color: BIRD_COLORS[bird.type] }}>
              &nbsp;&middot; Click/Space for {BIRD_NAMES[bird.type]} ability
            </span>
          )}
        </span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: 'rgba(10,10,18,0.85)', backdropFilter: 'blur(4px)',
  zIndex: 50,
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace', padding: '36px 48px',
  background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 20, padding: '10px 32px', background: '#ff7043', color: '#fff',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
