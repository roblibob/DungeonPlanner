/**
 * WebGPU-native post-processing using Three.js TSL nodes.
 *
 * Uses our own postprocessing library (src/postprocessing/) which imports only
 * from 'three/tsl' and 'three/webgpu' — both proper package exports.
 *
 * Effects:
 *   - Tilt-shift DoF: horizontal focus band blurs foreground/background
 *   - Selection outline: inverted-hull in scene (handled by ContentPackInstance)
 */
import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { uniform } from 'three/tsl'
import { tiltShift } from '../../postprocessing/tiltShift'
import { useDungeonStore } from '../../store/useDungeonStore'

export function WebGPUPostProcessing() {
  const { gl: renderer, scene, camera, size } = useThree()
  const postProcessingRef = useRef<THREE.PostProcessing | null>(null)

  // Uniforms updated each frame — no pipeline rebuild on value changes
  const focusCenterUniform = useRef(uniform(0.5))
  const focusRangeUniform  = useRef(uniform(0.15))
  const blurRadiusUniform  = useRef(uniform(6))

  const settings = useDungeonStore((state) => state.postProcessing)

  // Build TSL pipeline when renderer / scene / camera / size change
  useEffect(() => {
    if (!renderer || !scene || !camera) return

    const outputNode = tiltShift(scene, camera, {
      focusCenter: focusCenterUniform.current,
      focusRange:  focusRangeUniform.current,
      blurRadius:  blurRadiusUniform.current,
    })

    const postProcessing = new THREE.PostProcessing(
      renderer as unknown as THREE.WebGPURenderer,
    )
    postProcessing.outputNode = outputNode
    postProcessingRef.current = postProcessing

    return () => {
      postProcessingRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, scene, camera, size])

  // Sync uniforms + render each frame
  useFrame(() => {
    if (!postProcessingRef.current) return

    // Map store settings to shader uniforms
    // focusDistance → vertical centre (store: 0–1, shader: 0–1)
    focusCenterUniform.current.value = settings.focusDistance
    // focalLength → focus band half-width (store: 0.5–12 → remap to 0.02–0.4)
    focusRangeUniform.current.value = Math.max(0.02, settings.focalLength / 30)
    // bokehScale → blur radius in pixels (store: 0.5–6 → multiply to pixel range)
    blurRadiusUniform.current.value = settings.bokehScale * 4

    postProcessingRef.current.render()
  }, 1)

  return null
}

