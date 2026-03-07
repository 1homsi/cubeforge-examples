import { useRef } from 'react'
import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script, useCollisionEnter } from '@cubeforge/react'
import type { EntityId, ECSWorld, RigidBodyComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

/** Fires once when the player-tagged entity touches the mushroom. */
function MushroomPickup() {
  const collected = useRef(false)

  useCollisionEnter(() => {
    if (collected.current) return
    collected.current = true
    gameEvents.onMushroomGet?.()
  }, { tag: 'player' })

  return null
}

export function Mushroom({ x, y }: { x: number; y: number }) {
  return (
    <Entity tags={['mushroom']}>
      <Transform x={x} y={y} />
      <Sprite width={20} height={20} color="#e53935" zIndex={5} />
      <RigidBody />
      <BoxCollider width={20} height={20} />
      <Script
        update={(id: EntityId, world: ECSWorld) => {
          if (!world.hasEntity(id)) return
          const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
          if (rb) rb.vx = 80
        }}
      />
      <MushroomPickup />
    </Entity>
  )
}
