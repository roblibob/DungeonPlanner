/**
 * EntityLayer — renders all entity tokens for the active multiplayer session.
 * Handles click-to-select, DM drag-and-drop, path preview on hover (token tool),
 * and delegates movement requests to the Colyseus room.
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

  // Click-select state (used by players; DM uses drag instead)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [hoverCell, setHoverCell]               = useState<GridCell | null>(null)

  // DM drag state
  const [draggingEntityId, setDraggingEntityId] = useState<string | null>(null)

  const selectedEntity = selectedEntityId ? entities[selectedEntityId] : null
  const draggingEntity = draggingEntityId ? entities[draggingEntityId] : null

  const showGroundPlane = tool === 'token'

  // ── DM drag handlers ──────────────────────────────────────────────────────

  function handleTokenPointerDown(id: string, e: ThreeEvent<PointerEvent>) {
    if (!isDM || tool !== 'token') return
    e.stopPropagation()
    setDraggingEntityId(id)
    setSelectedEntityId(null)
    setHoverCell(null)
  }

  function handleGroundPointerUp(e: ThreeEvent<PointerEvent>) {
    if (draggingEntityId) {
      const snapped = snapWorldPointToGrid(e.point)
      room?.send('forceMoveEntity', {
        entityId: draggingEntityId,
        targetCell: [snapped.cell[0], snapped.cell[1]],
      })
      setDraggingEntityId(null)
      setHoverCell(null)
      return
    }
  }

  // ── Click-move handlers (players + DM fallback) ───────────────────────────

  function handleTokenClick(id: string, e: ThreeEvent<MouseEvent>) {
    if (draggingEntityId) return // ignore click noise after drag
    e.stopPropagation()
    setSelectedEntityId((prev) => (prev === id ? null : id))
    setHoverCell(null)
  }

  function handleGroundPointerMove(e: ThreeEvent<PointerEvent>) {
    if (!selectedEntity && !draggingEntity) return
    const snapped = snapWorldPointToGrid(e.point)
    const [cx, cz] = snapped.cell
    setHoverCell((prev) =>
      prev && prev[0] === cx && prev[1] === cz ? prev : [cx, cz],
    )
  }

  function handleGroundPointerLeave() {
    if (!draggingEntityId) setHoverCell(null)
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

  // Entity used for the path/ghost preview (drag takes priority over click-select)
  const previewEntity = draggingEntity ?? selectedEntity

  return (
    <>
      {/* Invisible ground plane — catches pointer events in token tool */}
      {showGroundPlane && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
          onClick={handleCanvasClick}
          onPointerMove={handleGroundPointerMove}
          onPointerLeave={handleGroundPointerLeave}
          onPointerUp={handleGroundPointerUp}
        >
          <planeGeometry args={[500, 500]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      {/* Path / drag ghost preview */}
      {previewEntity && hoverCell && (
        <PathPreview
          entity={previewEntity}
          hoverCell={hoverCell}
          instantMove={!!draggingEntity}
        />
      )}

      {Object.values(entities).map((entity) => (
        <EntityToken
          key={entity.id}
          entity={entity}
          selected={selectedEntityId === entity.id}
          isDragging={draggingEntityId === entity.id}
          onClick={(e) => handleTokenClick(entity.id, e)}
          onPointerDown={isDM ? (e) => handleTokenPointerDown(entity.id, e) : undefined}
        />
      ))}
    </>
  )
}
