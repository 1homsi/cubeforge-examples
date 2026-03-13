import { useRef } from 'react'
import { Entity, Transform, Sprite, BoxCollider, Script, useTriggerEnter, useEntity } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'

/** Collects the key when a player-tagged entity enters its trigger. */
function KeyCollector({ onCollect }: { onCollect?: (id: EntityId) => void }) {
  const entityId = useEntity()
  const collected = useRef(false)

  useTriggerEnter(() => {
    if (collected.current) return
    collected.current = true
    onCollect?.(entityId)
  }, { tag: 'player' })

  return null
}

interface KeyProps {
  x: number
  y: number
  onCollect?: (id: EntityId) => void
}

export function Key({ x, y, onCollect }: KeyProps) {
  const timer = useRef(Math.random() * Math.PI * 2)

  return (
    <Entity tags={['key']}>
      <Transform x={x} y={y} />
      <Sprite width={18} height={18} color="#ffd54f" zIndex={5} />
      <BoxCollider width={18} height={18} isTrigger />
      <Script
        update={(_id: EntityId, world: ECSWorld, _input: unknown, dt: number) => {
          timer.current += dt
          const t = world.getComponent<TransformComponent>(_id, 'Transform')
          if (t) t.y = y + Math.sin(timer.current * 3) * 5
        }}
      />
      <KeyCollector onCollect={onCollect} />
    </Entity>
  )
}
