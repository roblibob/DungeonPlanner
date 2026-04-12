/**
 * PathPreview — renders a visual movement path on the grid.
 * Shows highlighted cell discs along the BFS path from a selected entity to
 * the hovered cell. Cells within movementRange are green, beyond are red.
 * A step-count label floats above the target cell.
 */
import { useMemo, useState } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import type { GridCell } from '../../hooks/useSnapToGrid'
import { cellToWorldPosition, GRID_SIZE } from '../../hooks/useSnapToGrid'
import { bfsPath, buildWalkableSet } from '../../utils/pathfinding'
import { useDungeonStore } from '../../store/useDungeonStore'
import type { EntitySnapshot } from '../../multiplayer/useMultiplayerStore'

const IN_RANGE_COLOR  = new THREE.Color('#4ade80') // green-400
const OUT_RANGE_COLOR = new THREE.Color('#f87171') // rose-400
const STEP_Y = 0.08 // slightly above floor

type Props = {
  entity: EntitySnapshot
  hoverCell: GridCell
  /** When true (DM drag), renders a simple ghost disc instead of BFS path */
  instantMove?: boolean
}

export function PathPreview({ entity, hoverCell, instantMove = false }: Props) {
  const paintedCells = useDungeonStore((s) => s.paintedCells)
  const [labelReady, setLabelReady] = useState(false)

  const { path, inRange } = useMemo(() => {
    if (instantMove) return { path: null, inRange: true }
    const walkable = buildWalkableSet(Object.keys(paintedCells))
    const from: GridCell = [entity.cellX, entity.cellZ]
    const path = bfsPath(from, hoverCell, walkable, entity.movementRange + 4)
    const steps = path ? path.length - 1 : Infinity
    const inRange = steps <= entity.movementRange
    return { path, inRange }
  }, [paintedCells, entity.cellX, entity.cellZ, hoverCell, entity.movementRange, instantMove])

  const targetWorld = cellToWorldPosition(hoverCell)

  // DM instant-move: just show a ghost disc at target
  if (instantMove) {
    return (
      <group>
        <mesh
          position={[targetWorld[0], STEP_Y, targetWorld[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[GRID_SIZE * 0.44, 24]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      </group>
    )
  }

  if (!path || path.length <= 1) return null

  const color = inRange ? IN_RANGE_COLOR : OUT_RANGE_COLOR
  const steps = path.length - 1

  return (
    <group>
      {/* Cell highlights along the path */}
      {path.slice(1).map((cell, i) => {
        const pos = cellToWorldPosition(cell)
        const isLast = i === path.length - 2
        return (
          <mesh
            key={`${cell[0]},${cell[1]}`}
            position={[pos[0], STEP_Y, pos[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[isLast ? GRID_SIZE * 0.44 : GRID_SIZE * 0.28, 24]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={isLast ? 0.55 : 0.28}
              depthWrite={false}
            />
          </mesh>
        )
      })}

      {/* Connecting line dots */}
      {path.slice(1, -1).map((cell) => {
        const pos = cellToWorldPosition(cell)
        return (
          <mesh
            key={`dot-${cell[0]},${cell[1]}`}
            position={[pos[0], STEP_Y + 0.01, pos[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[0.08, 8]} />
            <meshBasicMaterial color={color} depthWrite={false} />
          </mesh>
        )
      })}

      {/* Step count label – gated behind onSync for WebGPU safety */}
      <Text
        position={[targetWorld[0], 0.7, targetWorld[2]]}
        fontSize={0.32}
        color={inRange ? '#4ade80' : '#f87171'}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.05}
        outlineColor="#1c1917"
        visible={labelReady}
        onSync={() => setLabelReady(true)}
      >
        {inRange ? `${steps} / ${entity.movementRange}` : `${steps} ✗`}
      </Text>
    </group>
  )
}
