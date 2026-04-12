/**
 * MonsterBase — procedural miniature for NPC/monster tokens.
 *
 * Slightly bulkier and lower-slung than the humanoid to read differently
 * at a glance on the table.  Same black base, rougher stone finish.
 */
import type { ContentPackAsset, ContentPackComponentProps } from '../../types'

const BASE_COLOR    = '#1c1917'
const MONSTER_COLOR = '#57534e'  // stone-600 — heavier, darker than humanoid

export function CharacterMonster(props: ContentPackComponentProps) {
  return (
    <group {...props}>
      {/* Base disc — same as humanoid so rings line up */}
      <mesh position={[0, 0.055, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.36, 0.40, 0.11, 32]} />
        <meshStandardMaterial color={BASE_COLOR} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Squat, wide body */}
      <mesh position={[0, 0.42, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.16, 0.22, 0.44, 14]} />
        <meshStandardMaterial color={MONSTER_COLOR} roughness={0.9} />
      </mesh>

      {/* Wide, flat head */}
      <mesh position={[0, 0.74, 0]} receiveShadow castShadow>
        <sphereGeometry args={[0.18, 14, 8]} />
        <meshStandardMaterial color={MONSTER_COLOR} roughness={0.9} />
      </mesh>
    </group>
  )
}

export const characterMonsterAsset: ContentPackAsset = {
  id: 'core.character_monster',
  slug: 'character_monster',
  name: 'Monster',
  category: 'character',
  assetUrl: '',
  Component: CharacterMonster,
}
