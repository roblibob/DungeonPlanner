/**
 * EntityLayer — renders all entity tokens for the active multiplayer session.
 * Handles click-to-select, path preview on hover (token tool), and
 * delegates movement requests to the Colyseus room.
 */
import { useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useMultiplayerStore, useIsDM } from '../../multiplayer/useMultiplayerStore'
import { useDungeonStore } from '../../store/useDungeonStore'
import { EntityToken } from './EntityToken'
import { snapWorldPointToGrid } from '../../hooks/useSnapToGrid'

export function EntityLayer() {
  const entities   = useMultiplayerStore((s) => s.entities)
  const room       = useMultiplayerStore((s) => s.room)
  const isDM       = useIsDM()
  const tool       = useDungeonStore((s) => s.tool)

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)

  function handleTokenClick(id: string, e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    setSelectedEntityId((prev) => (prev === id ? null : id))
  }

  function handleCanvasClick(e: ThreeEvent<MouseEvent>) {
    if (tool !== 'token') return
    const selectedEntity = selectedEntityId ? entities[selectedEntityId] : null

    if (selectedEntity) {
      // Move selected entity to clicked cell
      const snapped = snapWorldPointToGrid(e.point)
      const action = isDM ? 'forceMoveEntity' : 'requestMove'
      room?.send(action, {
        entityId: selectedEntity.id,
        targetCell: [snapped.cell[0], snapped.cell[1]],
      })
      setSelectedEntityId(null)
      return
    }
  }

  return (
    <>
      {/* Invisible ground plane catches click events for token placement */}
      {tool === 'token' && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
          onClick={handleCanvasClick}
        >
          <planeGeometry args={[500, 500]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      {Object.values(entities).map((entity) => (
        <EntityToken
          key={entity.id}
          entity={entity}
          selected={selectedEntityId === entity.id}
          onClick={(e) => handleTokenClick(entity.id, e)}
        />
      ))}
    </>
  )
}
