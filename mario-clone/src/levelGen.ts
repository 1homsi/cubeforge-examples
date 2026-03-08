// ─── Constants ────────────────────────────────────────────────────────────────
export const GRID      = 16                 // snap grid — all positions align to this
export const TILE      = 32                 // visual tile size (2x grid)
export const FLOOR_H   = 64                 // 4 grid cells tall
export const FLOOR_TOP = 496                // top edge of floor (snapped: 560 - 64)
export const FLOOR_Y   = FLOOR_TOP + FLOOR_H / 2  // 528, center of floor strip
export const BLOCK_Y   = 384                // center of standard floating block row (snapped)
export const BLOCK_Y2  = BLOCK_Y - TILE     // 352, upper tier (snapped)

/** Snap a value to the nearest grid cell */
function snap(v: number): number { return Math.round(v / GRID) * GRID }

export const LEVEL_NAME:  Record<1|2|3, string> = { 1: 'WORLD 1-1', 2: 'WORLD 1-2', 3: 'WORLD 1-3' }
export const LEVEL_THEME: Record<1|2|3, string> = { 1: 'OVERWORLD', 2: 'UNDERGROUND', 3: 'CASTLE' }

// ─── Types ────────────────────────────────────────────────────────────────────
export type RevealType = 'coin' | 'mushroom' | 'fireFlower' | 'star' | 'oneUp'
export type GameState  = 'playing' | 'gameover' | 'win' | 'levelclear'

export interface QBlock  { id: number; x: number; y: number; reveals: RevealType }
export interface CoinDef { id: number; x: number; y: number }
export interface SpawnedReveal { id: number; type: RevealType; x: number; y: number }
export interface EnemyDef {
  type: 'goomba' | 'koopa' | 'paratroopa' | 'buzzy' | 'billblaster' | 'hammerbro' | 'podoboo' | 'bowser'
  x: number; y: number; left: number; right: number
  src?: string; dir?: number; interval?: number
}
export interface PipeDef { x: number; y: number; h: number; pipeTopY: number; src?: string }
export interface LevelData {
  theme: 'overworld' | 'underground' | 'castle'
  bg: string; worldW: number; floorSrc: string; brickSrc: string
  coinSrc: string; qBlockSrc: string
  floorSegs: Array<{ x: number; w: number }>
  pipes: PipeDef[]
  brickBlocks: Array<{ x: number; y: number }>
  qBlocks: QBlock[]
  coins: CoinDef[]
  enemies: EnemyDef[]
  decorations: Array<{ x: number; y: number; src: string; w: number; h: number }>
  platforms: Array<{ x: number; y: number; w: number }>
  piranhaXs: number[]
  stairX: number; goalX: number
}

// ─── RNG ──────────────────────────────────────────────────────────────────────
function makeRng(seed: number) {
  let s = ((seed ^ 0x5f3759df) >>> 0) || 1
  return (): number => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0x100000000 }
}
function ri(rng: () => number, lo: number, hi: number) { return Math.floor(rng() * (hi - lo + 1)) + lo }
function rc<T>(rng: () => number, arr: readonly T[]): T { return arr[Math.floor(rng() * arr.length)] }

// ─── Level generators ─────────────────────────────────────────────────────────
const REVEALS: RevealType[] = ['mushroom', 'coin', 'fireFlower', 'coin', 'oneUp', 'star', 'coin', 'coin']

function buildBlocks(
  rng: () => number,
  positions: number[],
  stairX: number,
  pitX: number, pitW: number,
  qBlocks: QBlock[], brickBlocks: Array<{x:number;y:number}>,
  qIdRef: {v:number}, revIdxRef: {v:number}
) {
  for (const cx of positions) {
    if (cx >= stairX - 200) continue
    if (cx > pitX - 60 && cx < pitX + pitW + 60) continue
    const y     = rng() > 0.4 ? BLOCK_Y : BLOCK_Y2
    const count = ri(rng, 2, 5)
    const qPos  = ri(rng, 0, count - 1)
    for (let i = 0; i < count; i++) {
      const bx = cx + i * TILE
      if (i === qPos && rng() > 0.35) {
        qBlocks.push({ id: qIdRef.v++, x: bx, y, reveals: REVEALS[revIdxRef.v++ % REVEALS.length] })
      } else {
        brickBlocks.push({ x: bx, y })
      }
    }
  }
}

export function genLevel1(seed: number): LevelData {
  const rng     = makeRng(seed)
  const WORLD_W = snap(3200 + ri(rng, 0, 600))
  const STAIR_X = snap(WORLD_W - 480)
  const GOAL_X  = snap(WORLD_W - 176)

  // Pit
  const pitX = snap(1104 + ri(rng, 0, 496))
  const pitW = snap(128 + ri(rng, 0, 96))
  const floorSegs = [
    { x: 0,           w: pitX },
    { x: pitX + pitW, w: WORLD_W - (pitX + pitW) },
  ]

  // Pipes
  const pipes: PipeDef[] = []
  const piranhaXs: number[] = []
  const pipeXCandidates = [snap(464), snap(pitX - 224), snap(pitX + pitW + 320)]
  for (const px of pipeXCandidates) {
    if (px < 80 || px > WORLD_W - 100) continue
    if (px > pitX - 80 && px < pitX + pitW + 80) continue
    const h = rc(rng, [64, 80, 96] as const)
    pipes.push({ x: px, y: FLOOR_TOP - h / 2, h, pipeTopY: FLOOR_TOP - h })
    if (rng() > 0.45) piranhaXs.push(px)
  }

  // Floating blocks
  const brickBlocks: Array<{x:number;y:number}> = []
  const qBlocks: QBlock[] = []
  const qIdRef = { v: 1 }; const revIdxRef = { v: 0 }
  const clusterXs = [288, 576, 880, 1504, 1856, 2208, 2560, 2896].map(snap)
  buildBlocks(rng, clusterXs, STAIR_X, pitX, pitW, qBlocks, brickBlocks, qIdRef, revIdxRef)

  // Coins
  const coins: CoinDef[] = []
  let cId = 1
  for (let x = 208; x < STAIR_X - 80; x += snap(ri(rng, 208, 320))) {
    if (pipes.some(p => Math.abs(p.x - x) < 50)) continue
    if (x > pitX - 30 && x < pitX + pitW + 30) continue
    coins.push({ id: cId++, x: snap(x), y: BLOCK_Y - 48 })
  }

  // Enemies
  const enemies: EnemyDef[] = []
  for (let x = 288; x < STAIR_X - 208; x += snap(ri(rng, 288, 464))) {
    if (pipes.some(p => Math.abs(p.x - x) < 90)) continue
    if (x > pitX - 100 && x < pitX + pitW + 100) continue
    const type   = rc(rng, ['goomba', 'goomba', 'goomba', 'koopa', 'paratroopa'] as const)
    const spread = snap(ri(rng, 80, 160))
    const ey     = type === 'koopa' || type === 'paratroopa' ? FLOOR_TOP - 22 : FLOOR_TOP - 16
    enemies.push({ type, x: snap(x), y: ey, left: snap(x - spread), right: snap(x + spread) })
  }
  enemies.push({ type: 'billblaster', x: snap(STAIR_X - 304), y: FLOOR_TOP - 48, left: 0, right: 0, dir: 1, interval: 3.5 })
  enemies.push({ type: 'billblaster', x: snap(STAIR_X - 80),  y: FLOOR_TOP - 48, left: 0, right: 0, dir: 1, interval: 4.8 })

  // Clouds (overworld only)
  const CLOUD_SRCS = [
    { src: '/SMB_Cloud_Single.gif', w: 64,  h: 48  },
    { src: '/SMB_Cloud_Double.gif', w: 96,  h: 48  },
    { src: '/SMB_Cloud_Triple.gif', w: 128, h: 48  },
  ] as const
  const decorations: LevelData['decorations'] = []
  for (let x = 150; x < WORLD_W - 150; x += ri(rng, 280, 560)) {
    const y = ri(rng, 80, 220)
    const cloud = CLOUD_SRCS[Math.floor(rng() * CLOUD_SRCS.length)]
    decorations.push({ x, y, src: cloud.src, w: cloud.w, h: cloud.h })
  }

  return {
    theme: 'overworld', bg: '#5c94fc', worldW: WORLD_W,
    floorSrc: '/SMB_Ground.png', brickSrc: '/SMB_Brick_Block_Sprite.png',
    coinSrc: '/SMB1_Sprite_Coin.gif', qBlockSrc: '/SMB_Question_Block.gif',
    floorSegs, pipes, brickBlocks, qBlocks, coins, enemies, decorations, platforms: [],
    piranhaXs, stairX: STAIR_X, goalX: GOAL_X,
  }
}

export function genLevel2(seed: number): LevelData {
  const rng     = makeRng(seed + 99991)
  const WORLD_W = 3808
  const STAIR_X = snap(WORLD_W - 480)
  const GOAL_X  = snap(WORLD_W - 176)
  const floorSegs = [{ x: 0, w: WORLD_W }]

  // Pipes
  const pipes: PipeDef[] = []
  const piranhaXs: number[] = []
  for (let x = 608; x < STAIR_X - 208; x += snap(ri(rng, 752, 1056))) {
    const h = 64
    pipes.push({ x: snap(x), y: FLOOR_TOP - h / 2, h, pipeTopY: FLOOR_TOP - h })
    if (rng() > 0.4) piranhaXs.push(snap(x))
  }

  // Floating brick rows
  const brickBlocks: Array<{x:number;y:number}> = []
  const qBlocks: QBlock[] = []
  const qIdRef = { v: 1 }; const revIdxRef = { v: 0 }
  for (let cx = 200; cx < STAIR_X - 200; cx += ri(rng, 250, 420)) {
    if (pipes.some(p => Math.abs(p.x - cx) < 80)) continue
    const y     = rc(rng, [BLOCK_Y, BLOCK_Y2, BLOCK_Y + 64] as const)
    const count = ri(rng, 3, 6)
    const qPos  = ri(rng, 1, count - 2)
    for (let i = 0; i < count; i++) {
      const bx = cx + i * TILE
      if (i === qPos && rng() > 0.4) {
        qBlocks.push({ id: qIdRef.v++, x: bx, y, reveals: REVEALS[revIdxRef.v++ % REVEALS.length] })
      } else {
        brickBlocks.push({ x: bx, y })
      }
    }
  }

  // Enemies
  const enemies: EnemyDef[] = []
  for (let x = 304; x < STAIR_X - 208; x += snap(ri(rng, 304, 496))) {
    if (pipes.some(p => Math.abs(p.x - x) < 90)) continue
    const type   = rc(rng, ['goomba', 'goomba', 'buzzy', 'koopa'] as const)
    const spread = snap(ri(rng, 80, 160))
    const ey     = type === 'koopa' ? FLOOR_TOP - 22 : FLOOR_TOP - 16
    const src    = type === 'goomba' ? '/GoombaSMBGrey.gif'
                 : type === 'koopa'  ? '/SMB_NES_Blue_Koopa_Troopa_Walking.gif'
                 : '/BuzzyBeetleSMBUnderground.gif'
    enemies.push({ type, x: snap(x), y: ey, left: snap(x - spread), right: snap(x + spread), src })
  }
  for (let x = 2000; x < STAIR_X - 100; x += snap(ri(rng, 400, 608))) {
    enemies.push({ type: 'billblaster', x: snap(x), y: FLOOR_TOP - 48, left: 0, right: 0, dir: rng() > 0.5 ? 1 : -1, interval: 3 + rng() * 2 })
  }

  // Coins
  const coins: CoinDef[] = []
  let cId = 1
  for (let x = 208; x < STAIR_X; x += snap(ri(rng, 208, 352))) {
    coins.push({ id: cId++, x: snap(x), y: BLOCK_Y - 48 })
  }

  return {
    theme: 'underground', bg: '#1a1a2e', worldW: WORLD_W,
    floorSrc: '/SMB_Ground_Underground.png', brickSrc: '/SMB_Underground_Brick_Block.png',
    coinSrc: '/SMB_CoinUnderground.gif', qBlockSrc: '/SMB_QuestionBlockUndergroundAnim.gif',
    floorSegs, pipes, brickBlocks, qBlocks, coins, enemies, decorations: [], platforms: [],
    piranhaXs, stairX: STAIR_X, goalX: GOAL_X,
  }
}

export function genLevel3(seed: number): LevelData {
  const rng     = makeRng(seed + 77777)
  const WORLD_W = 3008
  const STAIR_X = snap(WORLD_W - 448)
  const GOAL_X  = snap(WORLD_W - 176)
  const floorSegs = [{ x: 0, w: WORLD_W }]

  // Pipes (gray)
  const pipes: PipeDef[] = []
  const piranhaXs: number[] = []
  for (let x = 496; x < STAIR_X - 208; x += snap(ri(rng, 752, 1008))) {
    const h = 64
    pipes.push({ x: snap(x), y: FLOOR_TOP - h / 2, h, pipeTopY: FLOOR_TOP - h, src: '/Warp_Pipe_Gray_SMB.png' })
    if (rng() > 0.4) piranhaXs.push(snap(x))
  }

  // Hard block platforms
  const brickBlocks: Array<{x:number;y:number}> = []
  const qBlocks: QBlock[] = []
  const qIdRef = { v: 1 }; const revIdxRef = { v: 0 }
  for (let cx = 200; cx < STAIR_X - 200; cx += ri(rng, 300, 450)) {
    if (pipes.some(p => Math.abs(p.x - cx) < 80)) continue
    const y     = rc(rng, [BLOCK_Y, BLOCK_Y2] as const)
    const count = ri(rng, 3, 5)
    const qPos  = ri(rng, 0, count - 1)
    for (let i = 0; i < count; i++) {
      const bx = cx + i * TILE
      if (i === qPos && rng() > 0.4) {
        qBlocks.push({ id: qIdRef.v++, x: bx, y, reveals: REVEALS[revIdxRef.v++ % REVEALS.length] })
      } else {
        brickBlocks.push({ x: bx, y })
      }
    }
  }

  // Enemies
  const enemies: EnemyDef[] = []
  for (let x = 288; x < STAIR_X - 304; x += snap(ri(rng, 256, 416))) {
    if (pipes.some(p => Math.abs(p.x - x) < 90)) continue
    const type   = rc(rng, ['goomba', 'koopa', 'buzzy', 'hammerbro'] as const)
    const spread = snap(ri(rng, 80, 160))
    const ey     = type === 'koopa' || type === 'hammerbro' ? FLOOR_TOP - 22 : FLOOR_TOP - 16
    const src    = type === 'goomba' ? '/SMBBlueGoomba.gif'
                 : type === 'buzzy'  ? '/SMB_Buzzy_Beetle_Castle_Sprite.gif'
                 : undefined
    enemies.push({ type, x: snap(x), y: ey, left: snap(x - spread), right: snap(x + spread), src })
  }
  for (let x = 496; x < STAIR_X - 304; x += snap(ri(rng, 400, 608))) {
    enemies.push({ type: 'podoboo', x: snap(x), y: FLOOR_TOP - 16, left: 0, right: 0 })
  }
  enemies.push({ type: 'billblaster', x: snap(STAIR_X - 496), y: FLOOR_TOP - 48, left: 0, right: 0, dir:  1, interval: 3.0 })
  enemies.push({ type: 'billblaster', x: snap(STAIR_X - 288), y: FLOOR_TOP - 48, left: 0, right: 0, dir: -1, interval: 3.8 })
  enemies.push({ type: 'bowser', x: snap(WORLD_W - 320), y: FLOOR_TOP - 40, left: snap(WORLD_W - 416), right: snap(WORLD_W - 240) })

  // Coins
  const coins: CoinDef[] = []
  let cId = 1
  for (let x = 208; x < STAIR_X; x += snap(ri(rng, 208, 320))) {
    coins.push({ id: cId++, x: snap(x), y: BLOCK_Y - 48 })
  }

  // Castle fortress decorations
  const decorations: LevelData['decorations'] = []
  for (let x = 400; x < WORLD_W - 304; x += snap(ri(rng, 496, 704))) {
    decorations.push({ x: snap(x), y: 352, src: '/LargeFortressSMB.png', w: 96, h: 128 })
  }

  return {
    theme: 'castle', bg: '#0a0a0f', worldW: WORLD_W,
    floorSrc: '/SMB_Ground_Castle.png', brickSrc: '/SMB_Hard_Block_Sprite.png',
    coinSrc: '/SMB_CoinCastle.gif', qBlockSrc: '/SMB_QuestionBlockCastleAnim.gif',
    floorSegs, pipes, brickBlocks, qBlocks, coins, enemies, decorations, platforms: [],
    piranhaXs, stairX: STAIR_X, goalX: GOAL_X,
  }
}
