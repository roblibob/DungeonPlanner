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
import { PathPreview } from './PathPreview'
import { snapWorldPointToGrid } from '../../hooks/useSnapToGrid'
import type { GridCell } from '../../hooks/useSnapToGrid'

export function EntityLayer() {
  const entities   = useMultiplayerStore((s) => s.entities)
  const room       = useMultiplayerStore((s) => s.room)
  const isDM       = useIsDM()
  const tool       = useDungeonStore((s) => s.tool)

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [hoverCell, setHoverCell]               = useState<GridCell | null>(null)

  const selectedEntity = selectedEntityId ? entities[selectedEntityId] : null

  function handleTokenClick(id: string, e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    setSelectedEntityId((prev) => (prev === id ? null : id))
    setHoverCell(null)
  }

  function handleGroundPointerMove(e: ThreeEvent<PointerEvent>) {
    if (!selectedEntity) return
    const snapped = snapWorldPointToGrid(e.point)
    const [cx, cz] = snapped.cell
    setHoverCell((prev) =>
      prev && prev[0] === cx && prev[1] === cz ? prev : [cx, cz],
    )
  }

  function handleGroundPointerLeave() {
    setHoverCell(null)
  }

  function handleCanvasClick(e: ThreeEvent<MouseEvent>) {
    if (tool !== 'token' || !selectedEntity) return
    const snapped = snapWorldPointToGrid(e.point)
    const action = isDM ? 'forceMoveEntity' : 'requestMove'
    room?.send(action, {
      entityId: selectedEntity.id,
      targetCell: [snapped.cell[0], snapped.cell[1]],
    })
    setSelectedEntityId(null)
    setHoverCell(null)
  }

  return (
    <>
      {/* Invisible ground plane — catches pointer events in token tool */}
      {tool === 'token' && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
          onClick={handleCanvasClick}
          onPointerMove={handleGroundPointerMove}
          onPointerLeave={handleGroundPointerLeave}
        >
          <planeGeometry args={[500, 500]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      {/* Path preview while a token is selected and hovering */}
      {selectedEntity && hoverCell && (
        <PathPreview entity={selectedEntity} hoverCell={hoverCell} />
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
