import { useRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  GRID_SIZE,
  cellToWorldPosition,
  getCellKey,
  type GridCell,
} from '../../hooks/useSnapToGrid'
import {
  useDungeonStore,
  type PaintedCells,
} from '../../store/useDungeonStore'
import { getBuildYOffset } from '../../store/buildAnimations'
import { ContentPackInstance } from './ContentPackInstance'

const WALL_EXTRA_DELAY_MS = 70

type WallDirection = 'north' | 'south' | 'east' | 'west'

type RoomWallInstance = {
  key: string
  direction: WallDirection
  position: [number, number, number]
  rotation: [number, number, number]
}

const WALL_DIRECTIONS: Array<{
  direction: WallDirection
  delta: GridCell
  rotation: [number, number, number]
}> = [
  { direction: 'north', delta: [0, 1], rotation: [0, Math.PI, 0] },
  { direction: 'south', delta: [0, -1], rotation: [0, 0, 0] },
  { direction: 'east', delta: [1, 0], rotation: [0, -Math.PI / 2, 0] },
  { direction: 'west', delta: [-1, 0], rotation: [0, Math.PI / 2, 0] },
]

export function DungeonRoom() {
  const paintedCells = useDungeonStore((state) => state.paintedCells)
  const floorAssetId = useDungeonStore((state) => state.selectedAssetIds.floor)
  const wallAssetId = useDungeonStore((state) => state.selectedAssetIds.wall)
  const cells = useMemo(() => Object.values(paintedCells), [paintedCells])
  const walls = useMemo(() => deriveRoomWalls(paintedCells), [paintedCells])

  return (
    <>
      {cells.map((cell) => {
        const key = getCellKey(cell)
        return (
          <AnimatedTileGroup key={`floor:${key}`} cellKey={key}>
            <ContentPackInstance
              assetId={floorAssetId}
              position={cellToWorldPosition(cell)}
              variant="floor"
              variantKey={key}
            />
          </AnimatedTileGroup>
        )
      })}

      {walls.map((wall) => {
        // Wall key is "x:z:direction" — extract the floor cell key "x:z"
        const floorKey = wall.key.split(':').slice(0, 2).join(':')
        return (
          <AnimatedTileGroup key={wall.key} cellKey={floorKey} extraDelay={WALL_EXTRA_DELAY_MS}>
            <ContentPackInstance
              assetId={wallAssetId}
              position={wall.position}
              rotation={wall.rotation}
              variant="wall"
              variantKey={wall.key}
            />
          </AnimatedTileGroup>
        )
      })}
    </>
  )
}

/**
 * Wraps a tile in a group whose Y position is driven each frame by the build
 * animation registry. When there is no active animation the group stays at Y=0
 * with negligible overhead (one Map lookup per frame).
 */
function AnimatedTileGroup({
  cellKey,
  extraDelay = 0,
  children,
}: {
  cellKey: string
  extraDelay?: number
  children: ReactNode
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const y = getBuildYOffset(cellKey, performance.now(), extraDelay)
    if (group.position.y !== y) group.position.y = y
  })

  return <group ref={groupRef}>{children}</group>
}

function deriveRoomWalls(paintedCells: PaintedCells): RoomWallInstance[] {
  const walls: RoomWallInstance[] = []

  Object.values(paintedCells).forEach((cell) => {
    const center = cellToWorldPosition(cell)

    WALL_DIRECTIONS.forEach(({ direction, delta, rotation }) => {
      const neighbor: GridCell = [cell[0] + delta[0], cell[1] + delta[1]]
      if (paintedCells[getCellKey(neighbor)]) {
        return
      }

      walls.push({
        key: `${getCellKey(cell)}:${direction}`,
        direction,
        position: [
          center[0] + delta[0] * (GRID_SIZE * 0.5),
          0,
          center[2] + delta[1] * (GRID_SIZE * 0.5),
        ],
        rotation,
      })
    })
  })

  return walls
}
