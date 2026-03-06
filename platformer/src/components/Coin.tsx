import { Entity, Transform, Sprite, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld } from '@cubeforge/react'
import type { Component } from '@cubeforge/core'

// Per-entity coin metadata stored directly in ECS — no shared global state
interface CoinMeta extends Component {
  readonly type: 'CoinMeta'
  onCollect: (id: EntityId) => void
}

function coinUpdate(entityId: EntityId, world: ECSWorld) {
  if (!world.hasEntity(entityId)) return

  const meta = world.getComponent<CoinMeta>(entityId, 'CoinMeta')
  if (!meta) return

  for (const pid of world.query('Tag')) {
    const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(pid, 'Tag')
    if (!tag?.tags.includes('player')) continue

    const pt = world.getComponent<{ type: 'Transform'; x: number; y: number }>(pid, 'Transform')
    const ct = world.getComponent<{ type: 'Transform'; x: number; y: number }>(entityId, 'Transform')
    if (!pt || !ct) continue

    const dx = pt.x - ct.x
    const dy = pt.y - ct.y
    if (dx * dx + dy * dy < 900) {
      meta.onCollect(entityId)
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
  return (
    <Entity tags={['coin', 'collectible']}>
      <Transform x={x} y={y} />
      <Sprite width={18} height={18} color="#ffd54f" zIndex={5} />
      <BoxCollider width={18} height={18} isTrigger={true} />
      <Script
        init={(id, world) => {
          world.addComponent(id, {
            type: 'CoinMeta',
            onCollect: onCollect ?? (() => {}),
          } as CoinMeta)
        }}
        update={coinUpdate}
      />
    </Entity>
  )
}
