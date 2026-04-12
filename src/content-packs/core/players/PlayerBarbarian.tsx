/* eslint-disable react-refresh/only-export-components */
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import playerBarbarianAssetUrl from '../../../assets/models/core/player-barbarian.glb'
import type { ContentPackAsset, ContentPackComponentProps } from '../../types'

const PLAYER_PIVOT_OFFSET = [0, 0, 0] as const

export function PlayerBarbarian(props: ContentPackComponentProps) {
  const gltf = useGLTF(playerBarbarianAssetUrl)
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene])

  return (
    <group position={PLAYER_PIVOT_OFFSET}>
      <group {...props}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

useGLTF.preload(playerBarbarianAssetUrl)

export const playerBarbarianAsset: ContentPackAsset = {
  id: 'core.player_barbarian',
  slug: 'player_barbarian',
  name: 'Barbarian',
  category: 'player',
  assetUrl: playerBarbarianAssetUrl,
  Component: PlayerBarbarian,
  metadata: {
    connectsTo: 'FLOOR',
    light: {
      color: '#ffe6b8',
      intensity: 3.5,
      distance: 7,
      decay: 2,
      castShadow: false,
      offset: [0, 1.4, 0],
    },
  },
}
