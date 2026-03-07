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
    <>
      {/* Flag pole */}
      <Entity tags={['goalFlag']}>
        <Transform x={x} y={y} />
        <Sprite src="/SMB_Goal_Pole.png" width={16} height={160} color="#888" zIndex={4} />
        <BoxCollider width={16} height={160} isTrigger />
        <GoalActivator />
      </Entity>

      {/* Castle at end */}
      <Entity>
        <Transform x={x + 90} y={y - 16} />
        <Sprite src="/SMBCastle.png" width={128} height={128} color="#555" zIndex={1} />
      </Entity>
    </>
  )
}
