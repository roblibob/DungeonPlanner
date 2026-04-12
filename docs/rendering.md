# Rendering

This page covers the 3D scene: how rooms are built, how walls are derived, what the grid shader does, how post-processing works, and the floor-switch transition.

---

## Renderer

The app uses `WebGPURenderer` from `three/webgpu`. At startup it tries to initialise a real WebGPU context; if that fails (older browsers, some mobile), it falls back to the WebGL backend of the same renderer. The fallback is seamless because both paths use Three.js TSL (Three Shading Language) node materials — the same shader code runs on both backends.

One important startup step: the app queries the adapter for `maxSampledTexturesPerShaderStage` before creating the renderer. Modern GPUs support 96+ slots; the Three.js default of 16 is too low for scenes with many shadow-casting lights and PBR textures. Requesting the full adapter max prevents obscure binding errors mid-scene.

---

## Scene structure

The scene has two layers that are mounted separately:

### GlobalContent (never remounts)

Everything that's floor-independent: ambient and directional lights, fog, grid overlay, OrbitControls, keyboard camera controls, post-processing, FPS meter, and the `FrameDriver`.

### FloorContent (remounts on floor switch, keyed by floor ID)

The dungeon geometry for the active floor: all painted room tiles, walls, openings, and placed props. Remounting on floor switch is deliberate — it gives us a completely clean Three.js scene for the new floor without needing to diff or reconcile.

`FloorContent` also drives the floor Y-slide animation: when it mounts it reads a `startY` prop and uses `useFrame` to spring its root group from that offset to `Y=0` with `k=10` exponential decay.

---

## Room rendering (DungeonRoom)

`DungeonRoom` is the component responsible for converting the flat `paintedCells` map into actual floor tiles, walls, and openings.

### Cell groups

Rather than rendering each cell independently, cells are first grouped by their effective `(floorAssetId, wallAssetId)` pair. This is important because rooms can override the global tile assets — a crypt room might use darker stone while the rest of the dungeon uses standard grey. All cells in the same group share one `CellGroupRenderer` which batches them together.

### Wall derivation

For each cell, the system checks its four neighbours (north, south, east, west). A wall is placed on an edge if:
- The neighbour cell doesn't exist (exterior edge), OR
- The neighbour is in a **different room** (interior boundary wall)

For interior walls between two rooms, only one side renders the wall to avoid Z-fighting. The rule: the cell with the lexicographically **lower** key "owns" the boundary wall. Since both cells see the same physical wall, only the lower-key one creates the instance.

### Wall key format

Walls are identified by `"x:z:direction"` strings, e.g. `"4:2:north"`. This key encodes:
- Which cell's edge it's on (`4:2`)
- Which face of that cell (`north`, `south`, `east`, `west`)

The same physical wall has two keys (one from each side). The opening system normalises this by adding both the stored key and its mirror to the suppressed-set when an opening is placed.

### Opening suppression

Before rendering walls, `DungeonRoom` builds a `suppressedWallKeys` set from all placed `wallOpenings`. For each opening, `getOpeningSegments(wallKey, width)` expands the centre key to the full span of wall segments, and both sides of each segment are added to the set. Walls in that set are simply skipped.

### Staircase hole

A placed `StairCaseDown` prop suppresses the floor tile in its cell — the staircase model fills the space and a tile would clip through it. `DungeonRoom` checks `blockedFloorCellKeys` (built from `placedObjects`) and skips rendering those cells.

---

## Build animations

When you paint new cells, `triggerBuild(cells, originCell)` is called. It:
1. Finds the max Manhattan distance from `originCell` to any cell in the batch
2. Assigns each cell a stagger delay proportional to its distance (0–320 ms)
3. Stores `{ delay, startedAt }` in a module-level `Map`

In `useFrame`, `AnimatedTileGroup` calls `getBuildYOffset(cellKey, now)` which computes the current Y position using a **cubic ease-out** function:

```
t = elapsed / RISE_DURATION_MS
y = -BUILD_DEPTH × (1 - t)³
```

Tiles emerge from 3 units below ground (`BUILD_DEPTH = 3`) and surface smoothly. Walls trail their floor tiles by 70 ms (`WALL_EXTRA_DELAY_MS`) so the floor appears first, then walls rise around it.

Once an animation entry has been alive long enough to guarantee completion, it's deleted from the map. `AnimatedTileGroup` self-disables by setting `doneRef.current = true` — after that, `useFrame` no longer runs for that tile group.

---

## Grid shader (FloorGridOverlay)

The grid is rendered as two layered planes using TSL node materials.

### The depth-test trick

Both planes sit at `Y = 0.270` with `depthTest: true, depthWrite: false`. This height is just above the tallest floor tile model (~0.244 measured). The depth test result:

- **Empty void** (background): background depth = max possible → plane passes → grid is visible ✓
- **Floor tiles** (top surface ~0.244): tile surface is below the plane → plane passes → grid projects onto tile ✓  
- **Walls/props** (taller geometry): face depth < plane depth → test fails → plane is hidden ✓

This single trick makes the grid appear on both the floor and the void without needing two different render passes or a stencil buffer.

### Layer 1 — base grid (full 120×120 plane)

Covers the entire scene. Uses `fract(worldXZ / GRID_SIZE)` to place lines in UV space. Thick axis lines are added at `abs(worldX) < 0.09` and `abs(worldZ) < 0.09` using world-space thresholds. Regular lines are dark stone-grey at 18% alpha; axis lines are a warmer tone at 28% alpha.

### Layer 2 — cursor glow (instanced per painted cell)

One quad instance per painted, visible floor cell. A `uniform` carries the cursor's world XZ position. The fragment shader computes the distance from the cursor and blends a warm amber glow. This means the glow only appears on painted floor tiles, not on bare void — cursor movement in empty space produces no effect.

The cursor position uniform is updated in `useFrame` by reading from a `centerRef` that `Grid.tsx` keeps in sync with the raycaster hit point. This avoids React state entirely — zero re-renders on cursor move.

---

## Post-processing

`WebGPUPostProcessing` builds a TSL node pipeline with two effects composed via `alphaOver`:

### Tilt-shift depth of field (`tiltShift.ts`)

A custom `PassNode` that blurs pixels based on their depth relative to a focus centre. Three uniforms control it:
- `focusCenter` — where along the camera frustum to focus (0–1)
- `focusRange` — the depth band that stays sharp
- `blurRadius` — how much to blur out-of-focus areas

The tilt-shift is stylistic rather than physically accurate — it gives a miniature/tabletop aesthetic.

### Selection outline (`selectionOutline.ts`)

A depth-buffer edge detection pass that renders depth discontinuities as coloured outlines. Objects are eligible for outlining by being on **Three.js layer 31**. A cloned camera that only renders layer 31 provides the depth buffer for the outline pass.

When a prop or opening is selected, `WebGPUPostProcessing` traverses its meshes (using the object registry for O(1) lookup) and enables layer 31. On deselection, it disables layer 31. This avoids full `scene.traverse()` calls on every selection change.

When post-processing is disabled, `ContentPackInstance` falls back to an **inverted-hull outline** — a slightly scaled back-face clone with a bright emissive red material. This works without any post-processing infrastructure and is the non-WebGPU fallback.

---

## Floor-switch transition

The transition is split across three files:

### floorTransition.ts

A plain mutable object (`transition`) holds the animation state: phase (`idle | out | in`), overlay progress, camera offset, pending floor ID, and direction. There's no React state or Zustand involved — all updates happen in `useFrame` with zero re-renders.

`requestFloorTransition(id)` is the public API. It initialises the signal and sets `phase = 'out'`.

### FloorTransitionController.tsx

A null-rendering React component that runs inside the Canvas. In `useFrame` it:

1. **Phase 'out'** (0.28 s): increments `progress` toward 1, springs `actualCameraOffset` toward `wantedCameraOffset` (= ±3 world units in the travel direction). Applies incremental `ΔY` to both `camera.position.y` **and** `controls.target.y` simultaneously — this preserves the camera-to-target vector, so OrbitControls doesn't fight back. At `progress >= 1`, calls `switchFloor(pendingId)`.

2. **Phase 'in'** (0.45 s): decrements `progress` toward 0, springs `wantedCameraOffset` back to 0 (camera returns to natural position). At `progress <= 0`, sets phase to `idle`.

3. Every frame: pushes `progress` as the overlay's CSS `opacity` via `overlayDomRef.current.style.opacity` — an imperative DOM write with zero React overhead.

### DOM overlay (App.tsx)

A `position: fixed` full-screen div with `background: #120f0e` (matching the scene background). Its opacity is driven purely by `overlayDomRef` — React never touches it after initial render. The result: the old floor fades to black, the floor switch happens invisibly, then the new floor fades in.

The `FloorContent` startY animation runs simultaneously during the fade-in — the new floor's tiles start at `±2` world units in the travel direction and settle to `Y=0` as the camera also springs back. Combined, these create the sensation of moving physically between floors.

---

## FPS metering

`FpsCounter.tsx` exports both `FpsMeterNode` (a TSL-based in-scene text renderer that shows the FPS counter directly in the 3D viewport) and `FpsOverlay` (a DOM-based overlay version). The node version is active by default — it's drawn as a 3D screen-space element and has no DOM cost.

The `FrameDriver` component handles the demand-mode render scheduling: a `setInterval` at the configured FPS limit, or `requestAnimationFrame` when the limit is 0 (uncapped). It pauses completely using the Page Visibility API when the tab is hidden.
