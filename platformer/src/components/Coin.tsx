import { useEffect } from 'react'
import { Entity, Transform, Sprite, BoxCollider, Script, useGame } from '@cubeforge/react'
import type { EntityId, ECSWorld } from '@cubeforge/react'

// Global coin collected counter (shared across all instances)
let _onCollect: ((id: EntityId) => void) | null = null

function coinUpdate(entityId: EntityId, world: ECSWorld) {
  if (!world.hasEntity(entityId)) return

  const playerEntities = world.query('Tag')
  for (const pid of playerEntities) {
    const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(pid, 'Tag')
    if (!tag?.tags.includes('player')) continue

    const pt = world.getComponent<{ type: 'Transform'; x: number; y: number }>(pid, 'Transform')
    const ct = world.getComponent<{ type: 'Transform'; x: number; y: number }>(entityId, 'Transform')
    if (!pt || !ct) continue

    const dx = pt.x - ct.x
    const dy = pt.y - ct.y
    if (dx * dx + dy * dy < 30 * 30) {
      _onCollect?.(entityId)
      world.destroyEntity(entityId)
      return
    }
  }
}

interface CoinProps {
  x: number
  y: number
  onCollect?: (id: EntityId) => void
}

export function Coin({ x, y, onCollect }: CoinProps) {
  useGame() // ensures we're inside <Game>

  useEffect(() => {
    if (onCollect) _onCollect = onCollect
    return () => { if (_onCollect === onCollect) _onCollect = null }
  }, [onCollect])

  return (
    <Entity tags={['coin', 'collectible']}>
      <Transform x={x} y={y} />
      <Sprite width={18} height={18} color="#ffd54f" zIndex={5} />
      <BoxCollider width={18} height={18} isTrigger={true} />
      <Script update={coinUpdate} />
    </Entity>
  )
}
