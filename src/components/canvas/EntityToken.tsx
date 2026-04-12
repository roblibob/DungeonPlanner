import { useRef, useMemo } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import type { EntitySnapshot } from '../../multiplayer/useMultiplayerStore'
import { useIsDM } from '../../multiplayer/useMultiplayerStore'
import { GRID_SIZE } from '../../hooks/useSnapToGrid'

const PLAYER_COLOR = new THREE.Color('#38bdf8')  // sky-400
const NPC_COLOR    = new THREE.Color('#f87171')  // rose-400
const NPC_HIDDEN_COLOR = new THREE.Color('#555555')
const SELECT_COLOR = new THREE.Color('#fbbf24')  // amber-400

type Props = {
  entity: EntitySnapshot
  selected: boolean
  onClick: (e: ThreeEvent<MouseEvent>) => void
}

export function EntityToken({ entity, selected, onClick }: Props) {
  const isDM = useIsDM()
  const groupRef  = useRef<THREE.Group>(null)
  const ringRef   = useRef<THREE.Mesh>(null)

  // Current rendered world position (smoothly lerped)
  const posRef = useRef({ x: entity.worldX, z: entity.worldZ })

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const k = 1 - Math.exp(-12 * delta)
    posRef.current.x += (entity.worldX - posRef.current.x) * k
    posRef.current.z += (entity.worldZ - posRef.current.z) * k
    groupRef.current.position.set(posRef.current.x, 0, posRef.current.z)
  })

  const color = useMemo(() => {
    if (selected) return SELECT_COLOR
    if (!entity.visibleToPlayers && isDM) return NPC_HIDDEN_COLOR
    return entity.type === 'PLAYER' ? PLAYER_COLOR : NPC_COLOR
  }, [entity.type, entity.visibleToPlayers, isDM, selected])

  // Hidden NPCs are faint for DM, invisible for players
  const opacity = !entity.visibleToPlayers && !isDM ? 0 : 1
  if (opacity === 0) return null

  return (
    <group ref={groupRef} position={[entity.worldX, 0, entity.worldZ]}>
      {/* Base disc */}
      <mesh
        position={[0, 0.12, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={onClick}
      >
        <circleGeometry args={[GRID_SIZE * 0.38, 32]} />
        <meshStandardMaterial
          color={color}
          opacity={entity.visibleToPlayers || isDM ? 0.82 : 0.28}
          transparent
          roughness={0.4}
        />
      </mesh>

      {/* Thin ring outline */}
      <mesh
        ref={ringRef}
        position={[0, 0.13, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[GRID_SIZE * 0.36, GRID_SIZE * 0.42, 32]} />
        <meshStandardMaterial
          color={selected ? SELECT_COLOR : color}
          emissive={selected ? SELECT_COLOR : color}
          emissiveIntensity={selected ? 0.8 : 0.15}
          opacity={entity.visibleToPlayers || isDM ? 1 : 0.28}
          transparent
        />
      </mesh>

      {/* Name label */}
      <Text
        position={[0, 0.55, 0]}
        fontSize={0.28}
        color={entity.visibleToPlayers || isDM ? '#e7e5e4' : '#555'}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.04}
        outlineColor="#1c1917"
      >
        {entity.name}
        {!entity.visibleToPlayers && isDM ? ' 🙈' : ''}
      </Text>
    </group>
  )
}
