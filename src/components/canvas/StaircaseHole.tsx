/**
 * Renders a ground-plane with holes + dark pit for every StaircaseDown prop.
 *
 * Instead of ShapeGeometry with holes (unreliable in WebGPU), the ground
 * plane uses a MeshStandardNodeMaterial whose alpha is set to 0 (discarded)
 * for fragments that fall inside any staircase footprint rectangle. This is
 * computed entirely in the TSL shader using world-space fragment position.
 */
import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { positionWorld, float, select } from 'three/tsl'
import { GRID_SIZE } from '../../hooks/useSnapToGrid'

// World-unit dimensions of the opening
export const STAIRCASE_HOLE_W = 2   // width  (X axis)
export const STAIRCASE_HOLE_D = 4   // depth  (Z axis)

// Offset of the hole corner relative to the placed cell corner (cx*G, cz*G).
const HOLE_OFFSET_X = 0
const HOLE_OFFSET_Z = 0

const PIT_DEPTH = 12

// ── Blocked-cell helper (used by DungeonRoom to skip floor tiles) ─────────────

/**
 * Returns the cells blocked by a staircase-down placed at [cx, cz].
 * These cells should NOT render floor tiles.
 */
export function getStaircaseDownBlockedCells(cx: number, cz: number, ry = 0): [number, number][] {
  const hx = cx * GRID_SIZE + HOLE_OFFSET_X
  const hz = cz * GRID_SIZE + HOLE_OFFSET_Z
  const holeCx = hx + STAIRCASE_HOLE_W / 2
  const holeCz = hz + STAIRCASE_HOLE_D / 2
  const hw = STAIRCASE_HOLE_W / 2
  const hd = STAIRCASE_HOLE_D / 2
  const cos = Math.cos(ry)
  const sin = Math.sin(ry)

  function rotXZ(lx: number, lz: number): [number, number] {
    return [holeCx + lx * cos - lz * sin, holeCz + lx * sin + lz * cos]
  }

  const corners = [
    rotXZ(-hw, -hd), rotXZ(hw, -hd),
    rotXZ(hw,  hd),  rotXZ(-hw,  hd),
  ]

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, z] of corners) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
  }

  const cells: [number, number][] = []
  for (let x = Math.floor(minX / GRID_SIZE); x <= Math.floor((maxX - 0.01) / GRID_SIZE); x++) {
    for (let z = Math.floor(minZ / GRID_SIZE); z <= Math.floor((maxZ - 0.01) / GRID_SIZE); z++) {
      cells.push([x, z])
    }
  }
  return cells
}

// ── Ground material builder ───────────────────────────────────────────────────

type HoleRect = { holeCx: number; holeCz: number; hw: number; hd: number; ry: number }

function buildGroundMaterial(color: string, holes: HoleRect[]): THREE.Material {
  const mat = new MeshStandardNodeMaterial({
    color: new THREE.Color(color),
    roughness: 1,
    metalness: 0,
  })

  if (holes.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let inAnyHole: any = null

    for (const { holeCx, holeCz, hw, hd, ry } of holes) {
      // Transform world XZ to hole-local space (inverse rotation = -ry)
      const cos = float(Math.cos(-ry))
      const sin = float(Math.sin(-ry))
      const wx = positionWorld.x.sub(float(holeCx))
      const wz = positionWorld.z.sub(float(holeCz))
      const lx = wx.mul(cos).sub(wz.mul(sin))
      const lz = wx.mul(sin).add(wz.mul(cos))

      const inThis = lx.greaterThanEqual(float(-hw))
        .and(lx.lessThan(float(hw)))
        .and(lz.greaterThanEqual(float(-hd)))
        .and(lz.lessThan(float(hd)))

      inAnyHole = inAnyHole ? inAnyHole.or(inThis) : inThis
    }

    // alpha=0 inside hole → discarded by alphaTest; alpha=1 outside → kept
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mat as any).alphaNode = select(inAnyHole, float(0), float(1))
    mat.alphaTest = 0.5
  }

  return mat
}

// ── Component ─────────────────────────────────────────────────────────────────

type StaircaseHoleObject = {
  id: string
  cell: [number, number]
  rotation: [number, number, number]
}

export function StaircaseHoles({
  staircases,
  groundColor,
}: {
  staircases: StaircaseHoleObject[]
  groundColor: string
}) {
  const holes = useMemo<HoleRect[]>(
    () =>
      staircases.map(({ cell: [cx, cz], rotation: [, ry] }) => {
        const hx = cx * GRID_SIZE + HOLE_OFFSET_X
        const hz = cz * GRID_SIZE + HOLE_OFFSET_Z
        return {
          holeCx: hx + STAIRCASE_HOLE_W / 2,
          holeCz: hz + STAIRCASE_HOLE_D / 2,
          hw: STAIRCASE_HOLE_W / 2,
          hd: STAIRCASE_HOLE_D / 2,
          ry,
        }
      }),
    [staircases],
  )

  const groundMaterial = useMemo(
    () => buildGroundMaterial(groundColor, holes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groundColor, JSON.stringify(holes)],
  )

  useEffect(() => () => { groundMaterial.dispose() }, [groundMaterial])

  return (
    <>
      {/* Ground plane — fragments inside staircase footprints are discarded by TSL shader */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        renderOrder={-1}
        receiveShadow
        material={groundMaterial}
      >
        <planeGeometry args={[500, 500]} />
      </mesh>

      {/* Dark pit box under each hole */}
      {holes.map(({ holeCx, holeCz, hw, hd, ry }, i) => (
        <mesh
          key={i}
          position={[holeCx, -PIT_DEPTH / 2, holeCz]}
          rotation={[0, ry, 0]}
          receiveShadow
          castShadow
        >
          <boxGeometry args={[hw * 2, PIT_DEPTH, hd * 2]} />
          <meshStandardMaterial color="#0a0806" roughness={1} metalness={0} side={THREE.BackSide} />
        </mesh>
      ))}
    </>
  )
}
