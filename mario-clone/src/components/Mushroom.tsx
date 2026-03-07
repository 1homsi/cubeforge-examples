import { useRef } from 'react'
import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script, useCollisionEnter, useEntity } from '@cubeforge/react'
import type { EntityId, ECSWorld, RigidBodyComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

const mushroomsCollected = new Set<EntityId>()

function MushroomPickup() {
  const entityId = useEntity()
  const collected = useRef(false)

  useCollisionEnter(() => {
    if (collected.current) return
    collected.current = true
    if (entityId !== null) mushroomsCollected.add(entityId)
    gameEvents.onMushroomGet?.()
  }, { tag: 'player' })

  return null
}

export function Mushroom({ x, y }: { x: number; y: number }) {
  return (
    <Entity tags={['mushroom']}>
      <Transform x={x} y={y} />
      <Sprite src="/SMB_Supermushroom.png" width={28} height={28} color="#e53935" zIndex={5} />
      <RigidBody />
      <BoxCollider width={28} height={28} />
      <Script
        update={(id: EntityId, world: ECSWorld) => {
          if (!world.hasEntity(id)) return
          if (mushroomsCollected.has(id)) {
            mushroomsCollected.delete(id)
            world.destroyEntity(id)
            return
          }
          const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
          if (rb) rb.vx = 80
        }}
      />
      <MushroomPickup />
    </Entity>
  )
}
