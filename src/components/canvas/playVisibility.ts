import { useEffect, useMemo } from 'react'
import { getContentPackAssetById } from '../../content-packs/registry'
import { getCellKey, type GridCell } from '../../hooks/useSnapToGrid'
import { getOpeningSegments, useDungeonStore, type OpeningRecord, type PaintedCells } from '../../store/useDungeonStore'
import type { DungeonObjectRecord, Layer } from '../../store/useDungeonStore'

const PLAYER_VISION_RANGE = 8

export type PlayVisibilityState = 'visible' | 'explored' | 'hidden'

export type PlayVisibility = {
  active: boolean
  getCellVisibility: (cellKey: string) => PlayVisibilityState
  getObjectVisibility: (cellKey: string) => PlayVisibilityState
  getWallVisibility: (wallKey: string) => PlayVisibilityState
}

type WallDirection = 'north' | 'south' | 'east' | 'west'

const WALL_DIRECTIONS: Record<WallDirection, { delta: GridCell; opposite: WallDirection }> = {
  north: { delta: [0, 1], opposite: 'south' },
  south: { delta: [0, -1], opposite: 'north' },
  east: { delta: [1, 0], opposite: 'west' },
  west: { delta: [-1, 0], opposite: 'east' },
}

export function usePlayVisibility(): PlayVisibility {
  const tool = useDungeonStore((state) => state.tool)
  const paintedCells = useDungeonStore((state) => state.paintedCells)
  const exploredCells = useDungeonStore((state) => state.exploredCells)
  const wallOpenings = useDungeonStore((state) => state.wallOpenings)
  const placedObjects = useDungeonStore((state) => state.placedObjects)
  const layers = useDungeonStore((state) => state.layers)
  const mergeExploredCells = useDungeonStore((state) => state.mergeExploredCells)

  const visibleCellKeys = useMemo(() => {
    if (tool !== 'play') {
      return []
    }

    const playerOrigins = Object.values(placedObjects)
      .filter((object) => isVisiblePlayerOrigin(object, paintedCells, layers))
      .map((object) => object.cell)
    const blockingCells = getBlockingCellKeys(placedObjects, layers)

    return computeVisibleCellKeys(
      paintedCells,
      wallOpenings,
      playerOrigins,
      PLAYER_VISION_RANGE,
      blockingCells,
    )
  }, [layers, paintedCells, placedObjects, tool, wallOpenings])

  useEffect(() => {
    if (tool === 'play') {
      mergeExploredCells(visibleCellKeys)
    }
  }, [mergeExploredCells, tool, visibleCellKeys])

  return useMemo(() => {
    if (tool !== 'play') {
      return {
        active: false,
        getCellVisibility: () => 'visible' as const,
        getObjectVisibility: () => 'visible' as const,
        getWallVisibility: () => 'visible' as const,
      }
    }

    const visibleSet = new Set(visibleCellKeys)

    const getCellVisibility = (cellKey: string): PlayVisibilityState => {
      if (visibleSet.has(cellKey)) {
        return 'visible'
      }
      if (exploredCells[cellKey]) {
        return 'explored'
      }
      return 'hidden'
    }

    return {
      active: true,
      getCellVisibility,
      getObjectVisibility: getCellVisibility,
      getWallVisibility: (wallKey: string) => {
        const parsed = parseWallKey(wallKey)
        if (!parsed) {
          return 'hidden'
        }

        const cellVisibility = getCellVisibility(parsed.cellKey)
        const adjacentVisibility = getCellVisibility(parsed.neighborCellKey)

        return maxVisibility(cellVisibility, adjacentVisibility)
      },
    }
  }, [exploredCells, tool, visibleCellKeys])
}

export function isVisiblePlayerOrigin(
  object: DungeonObjectRecord,
  paintedCells: PaintedCells,
  layers: Record<string, Layer>,
) {
  return (
    object.type === 'player' &&
    layers[object.layerId]?.visible !== false &&
    Boolean(paintedCells[getCellKey(object.cell)])
  )
}

export function computeVisibleCellKeys(
  paintedCells: PaintedCells,
  wallOpenings: Record<string, OpeningRecord>,
  origins: GridCell[],
  range: number,
  blockingCellKeys: Iterable<string> = [],
): string[] {
  const openWalls = buildOpenWallSet(wallOpenings)
  const blockingCells = new Set(blockingCellKeys)
  const visible = new Set<string>()
  const paintedCellList = Object.values(paintedCells)

  for (const origin of origins) {
    const originKey = getCellKey(origin)
    if (!paintedCells[originKey] || visible.has(originKey)) {
      continue
    }

    visible.add(originKey)

    for (const target of paintedCellList) {
      const targetKey = getCellKey(target.cell)
      if (visible.has(targetKey)) {
        continue
      }

      const dx = target.cell[0] - origin[0]
      const dz = target.cell[1] - origin[1]
      if (dx * dx + dz * dz > range * range) {
        continue
      }

      if (hasLineOfSight(origin, target.cell, paintedCells, openWalls, blockingCells)) {
        visible.add(targetKey)
      }
    }
  }

  return [...visible]
}

function buildOpenWallSet(wallOpenings: Record<string, OpeningRecord>) {
  const openWalls = new Set<string>()

  for (const opening of Object.values(wallOpenings)) {
    for (const wallKey of getOpeningSegments(opening.wallKey, opening.width)) {
      openWalls.add(wallKey)

      const parsed = parseWallKey(wallKey)
      if (parsed) {
        openWalls.add(parsed.mirroredWallKey)
      }
    }
  }

  return openWalls
}

function hasLineOfSight(
  origin: GridCell,
  target: GridCell,
  paintedCells: PaintedCells,
  openWalls: Set<string>,
  blockingCells: Set<string>,
) {
  if (origin[0] === target[0] && origin[1] === target[1]) {
    return true
  }

  let current: GridCell = [origin[0], origin[1]]
  const dx = target[0] - origin[0]
  const dz = target[1] - origin[1]
  const stepX = Math.sign(dx)
  const stepZ = Math.sign(dz)
  const tDeltaX = stepX === 0 ? Number.POSITIVE_INFINITY : 1 / Math.abs(dx)
  const tDeltaZ = stepZ === 0 ? Number.POSITIVE_INFINITY : 1 / Math.abs(dz)
  let tMaxX = stepX === 0 ? Number.POSITIVE_INFINITY : tDeltaX * 0.5
  let tMaxZ = stepZ === 0 ? Number.POSITIVE_INFINITY : tDeltaZ * 0.5

  while (current[0] !== target[0] || current[1] !== target[1]) {
    if (approximatelyEqual(tMaxX, tMaxZ)) {
      if (stepX === 0 || stepZ === 0) {
        return false
      }

      const nextDiagonal: GridCell = [current[0] + stepX, current[1] + stepZ]
      const viaX: GridCell = [current[0] + stepX, current[1]]
      const viaZ: GridCell = [current[0], current[1] + stepZ]
      const canPassViaX = canTraverseAdjacent(
        current,
        viaX,
        paintedCells,
        openWalls,
      ) && !isBlockingSightCell(viaX, target, blockingCells) && canTraverseAdjacent(
        viaX,
        nextDiagonal,
        paintedCells,
        openWalls,
      )
      const canPassViaZ = canTraverseAdjacent(
        current,
        viaZ,
        paintedCells,
        openWalls,
      ) && !isBlockingSightCell(viaZ, target, blockingCells) && canTraverseAdjacent(
        viaZ,
        nextDiagonal,
        paintedCells,
        openWalls,
      )

      if (!canPassViaX && !canPassViaZ) {
        return false
      }

      current = nextDiagonal
      if (isBlockingSightCell(current, target, blockingCells)) {
        return false
      }
      tMaxX += tDeltaX
      tMaxZ += tDeltaZ
      continue
    }

    if (tMaxX < tMaxZ) {
      const nextCell: GridCell = [current[0] + stepX, current[1]]
      if (!canTraverseAdjacent(current, nextCell, paintedCells, openWalls)) {
        return false
      }
      current = nextCell
      if (isBlockingSightCell(current, target, blockingCells)) {
        return false
      }
      tMaxX += tDeltaX
      continue
    }

    const nextCell: GridCell = [current[0], current[1] + stepZ]
    if (!canTraverseAdjacent(current, nextCell, paintedCells, openWalls)) {
      return false
    }
    current = nextCell
    if (isBlockingSightCell(current, target, blockingCells)) {
      return false
    }
    tMaxZ += tDeltaZ
  }

  return true
}

function canTraverseAdjacent(
  from: GridCell,
  to: GridCell,
  paintedCells: PaintedCells,
  openWalls: Set<string>,
) {
  const direction = getDirection(from, to)
  if (!direction) {
    return false
  }

  const fromKey = getCellKey(from)
  const toKey = getCellKey(to)
  const fromRecord = paintedCells[fromKey]
  const toRecord = paintedCells[toKey]
  if (!fromRecord || !toRecord) {
    return false
  }

  if ((fromRecord.roomId ?? null) === (toRecord.roomId ?? null)) {
    return true
  }

  return openWalls.has(`${fromKey}:${direction}`)
}

function getDirection(from: GridCell, to: GridCell): WallDirection | null {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]

  if (dx === 1 && dz === 0) return 'east'
  if (dx === -1 && dz === 0) return 'west'
  if (dx === 0 && dz === 1) return 'north'
  if (dx === 0 && dz === -1) return 'south'
  return null
}

function parseWallKey(wallKey: string) {
  const [xText, zText, directionText] = wallKey.split(':')
  const x = Number.parseInt(xText ?? '', 10)
  const z = Number.parseInt(zText ?? '', 10)
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return null
  }

  if (
    directionText !== 'north' &&
    directionText !== 'south' &&
    directionText !== 'east' &&
    directionText !== 'west'
  ) {
    return null
  }

  const direction = WALL_DIRECTIONS[directionText]
  const cellKey = `${x}:${z}`
  const neighborCellKey = `${x + direction.delta[0]}:${z + direction.delta[1]}`

  return {
    cellKey,
    neighborCellKey,
    mirroredWallKey: `${neighborCellKey}:${direction.opposite}`,
  }
}

function maxVisibility(a: PlayVisibilityState, b: PlayVisibilityState): PlayVisibilityState {
  if (a === 'visible' || b === 'visible') {
    return 'visible'
  }
  if (a === 'explored' || b === 'explored') {
    return 'explored'
  }
  return 'hidden'
}

function approximatelyEqual(a: number, b: number) {
  return Math.abs(a - b) < 1e-9
}

function getBlockingCellKeys(
  placedObjects: Record<string, DungeonObjectRecord>,
  layers: Record<string, Layer>,
) {
  const blockingCells = new Set<string>()

  for (const object of Object.values(placedObjects)) {
    if (layers[object.layerId]?.visible === false) {
      continue
    }

    const asset = object.assetId ? getContentPackAssetById(object.assetId) : null
    if (!asset?.metadata?.blocksLineOfSight || asset.metadata.connectsTo !== 'FLOOR') {
      continue
    }

    blockingCells.add(getCellKey(object.cell))
  }

  return blockingCells
}

function isBlockingSightCell(
  cell: GridCell,
  target: GridCell,
  blockingCells: Set<string>,
) {
  return (cell[0] !== target[0] || cell[1] !== target[1]) && blockingCells.has(getCellKey(cell))
}
