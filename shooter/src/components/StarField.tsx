import { Entity, Transform, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld } from '@cubeforge/react'
import { createTransform } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { createTag } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/react'

const STAR_COUNT = 30

interface StarData {
  id: EntityId
  speed: number
}

// Module-level state — one set per mounted StarField script entity
const starFieldState = new Map<EntityId, StarData[]>()

function starFieldInit(id: EntityId, world: ECSWorld) {
  const stars: StarData[] = []
  for (let i = 0; i < STAR_COUNT; i++) {
    const starId = world.createEntity()
    const x = Math.random() * 800
    const y = Math.random() * 560
    const speed = 20 + Math.random() * 40  // 20–60 px/s
    const size = Math.random() < 0.3 ? 3 : 2
    const brightness = Math.floor(180 + Math.random() * 75)
    const color = `rgb(${brightness},${brightness},${brightness})`

    world.addComponent(starId, createTransform(x, y))
    world.addComponent(starId, createSprite({ width: size, height: size, color, zIndex: -1 }))
    world.addComponent(starId, createTag('star'))

    stars.push({ id: starId, speed })
  }
  starFieldState.set(id, stars)
}

function starFieldUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return
  const stars = starFieldState.get(id)
  if (!stars) return

  for (const star of stars) {
    if (!world.hasEntity(star.id)) continue
    const t = world.getComponent<TransformComponent>(star.id, 'Transform')
    if (!t) continue
    t.x -= star.speed * dt
    if (t.x < -4) {
      t.x = 804
      t.y = Math.random() * 560
    }
  }
}

export function StarField() {
  return (
    <Entity>
      <Transform x={0} y={0} />
      <Script
        init={(id, world) => starFieldInit(id, world)}
        update={starFieldUpdate}
      />
    </Entity>
  )
}
