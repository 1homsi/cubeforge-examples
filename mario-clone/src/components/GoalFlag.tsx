import { useRef } from 'react'
import { Entity, Transform, Sprite, BoxCollider, useTriggerEnter } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

function GoalActivator() {
  const fired = useRef(false)

  useTriggerEnter(() => {
    if (fired.current) return
    fired.current = true
    gameEvents.onGoalReached?.()
  }, { tag: 'player' })

  return null
}

interface GoalFlagProps {
  x: number
  y: number
}

export function GoalFlag({ x, y }: GoalFlagProps) {
  return (
    <Entity tags={['goalFlag']}>
      <Transform x={x} y={y} />
      <Sprite width={16} height={64} color="#4caf50" zIndex={4} />
      <BoxCollider width={16} height={64} isTrigger />
      <GoalActivator />
    </Entity>
  )
}
