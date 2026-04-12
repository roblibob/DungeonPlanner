/**
 * HumanoidBase — procedural miniature stand-in for a humanoid character token.
 *
 * Looks like a classic tabletop RPG miniature: a flat bevelled base with a
 * simple pawn-shaped figure on top.  GRID_SIZE = 2, so all measurements are
 * in that unit space (base radius ≈ 0.38 * 2 = 0.76 max).
 *
 * Replace this component with a real GLB once character art is ready.
 */
import type { ContentPackAsset, ContentPackComponentProps } from '../../types'

const BASE_COLOR   = '#1c1917'   // near-black — classic plastic mini base
const FIGURE_COLOR = '#78716c'   // stone-400 — unpainted sculpt

export function CharacterHumanoid(props: ContentPackComponentProps) {
  return (
    <group {...props}>
      {/* Bevelled base disc */}
      <mesh position={[0, 0.055, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.36, 0.40, 0.11, 32]} />
        <meshStandardMaterial color={BASE_COLOR} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 0.46, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.11, 0.17, 0.52, 14]} />
        <meshStandardMaterial color={FIGURE_COLOR} roughness={0.85} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.82, 0]} receiveShadow castShadow>
        <sphereGeometry args={[0.14, 14, 10]} />
        <meshStandardMaterial color={FIGURE_COLOR} roughness={0.85} />
      </mesh>
    </group>
  )
}

export const characterHumanoidAsset: ContentPackAsset = {
  id: 'core.character_humanoid',
  slug: 'character_humanoid',
  name: 'Humanoid',
  category: 'character',
  assetUrl: '',
  Component: CharacterHumanoid,
}
