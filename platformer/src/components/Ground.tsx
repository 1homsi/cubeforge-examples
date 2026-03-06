import { Entity, Transform, Sprite, RigidBody, BoxCollider } from '@cubeforge/react'

interface GroundProps {
  x: number
  y: number
  width: number
  height?: number
  color?: string
}

export function Ground({ x, y, width, height = 24, color = '#546e7a' }: GroundProps) {
  return (
    <Entity tags={['ground', 'solid']}>
      <Transform x={x} y={y} />
      <Sprite width={width} height={height} color={color} zIndex={1} />
      <RigidBody isStatic={true} />
      <BoxCollider width={width} height={height} />
    </Entity>
  )
}
