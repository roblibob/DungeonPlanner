# Architecture

This page explains how the main systems relate to each other and how data flows through the app.

---

## The big picture

```
┌──────────────────────────────────────────────────────┐
│  React UI  (App.tsx + components/editor/*)           │
│  reads Zustand store, dispatches actions             │
└───────────────────┬──────────────────────────────────┘
                    │ Zustand re-renders
┌───────────────────▼──────────────────────────────────┐
│  useDungeonStore  (Zustand + persist)                │
│  single source of truth for all dungeon data         │
└───────────────────┬──────────────────────────────────┘
                    │ store selectors in canvas components
┌───────────────────▼──────────────────────────────────┐
│  Canvas  (React Three Fiber + WebGPU renderer)       │
│  Scene.tsx → GlobalContent + FloorContent             │
│  DungeonRoom → floor tiles, walls, opening models    │
│  DungeonObject → props, lights                       │
└──────────────────────────────────────────────────────┘
```

There is no separate "view model" — canvas components subscribe directly to the Zustand store using fine-grained selectors so they only re-render when the slice of state they care about actually changes.

---

## Component tree

```
<App>
  <EditorToolbar />          ← left icon strip + file menu
  <Scene />                  ← lazy-loaded; the entire 3D viewport
    <Canvas>
      <GlobalContent>        ← lights, grid, controls — never remounts
        <Grid />
        <Controls />         ← OrbitControls + KeyboardCameraControls
        <FloorTransitionController />   ← floor-switch animation driver
        <CameraPresetManager />
        <WebGPUPostProcessing />        ← tilt-shift + selection outline
      </GlobalContent>
      <FloorContent key={activeFloorId}>   ← remounts on floor switch
        <DungeonRoom />       ← floor tiles, walls, openings
        <DungeonObject />     ← per placed prop
      </FloorContent>
    </Canvas>
  <RightPanel>
    <ScenePanel />            ← floor list + room tree
    <{Tool}ToolPanel />       ← context-sensitive settings
    <LayerPanel />            ← layer visibility / locking
  </RightPanel>
```

The key architectural choice is the `key={activeFloorId}` on `<FloorContent>`. When you switch floors, React unmounts the old floor entirely and mounts a fresh one. This keeps tile/wall rendering completely stateless — no "did this cell change?" diffing needed.

---

## Data flow for painting a room

1. User drags on the canvas → `RoomToolPanel` + raycaster in `App.tsx`'s `onWindowKeyDown` / canvas pointer events
2. `paintCells([...cells])` dispatched to the store
3. Store pushes the current snapshot to `history`, updates `paintedCells`, adds an entry to `buildAnimations` registry
4. Zustand notifies subscribers → `DungeonRoom` re-renders
5. `DungeonRoom` re-derives `cellGroups`, creates a `CellGroupRenderer` per asset-pair
6. `AnimatedTileGroup` reads from the `buildAnimations` registry in `useFrame` → tiles rise from the ground with staggered easing

---

## Demand-mode render loop

The canvas uses `frameloop="demand"` — it only renders when something calls `invalidate()`. This is important for battery life and CPU usage.

Things that call `invalidate()`:
- `FrameDriver` — a configured FPS-limited interval (default 30 fps, configurable to 0/30/60/120)
- `FloorContent.useFrame` — while the floor Y-slide animation is running
- `FloorTransitionController.useFrame` — during a floor-switch transition
- `AnimatedTileGroup.useFrame` — while build animations are running
- `PropPointLight.useFrame` — every frame when a flickering torch is in scene

When idle (no animations, no input), almost nothing runs.

---

## Multi-floor architecture

Each floor is a `FloorRecord`:

```ts
type FloorRecord = {
  id: string
  name: string
  level: number        // 0 = ground, positive = above, negative = cellar
  snapshot: DungeonSnapshot   // full working state of that floor
  history: DungeonSnapshot[]  // per-floor undo stack
  future:  DungeonSnapshot[]  // per-floor redo stack
}
```

The active floor's state is "unpacked" into the top-level store slices (`paintedCells`, `placedObjects`, etc.). When you switch floors, `switchFloor()` first **saves** the current state back into `floors[activeFloorId].snapshot`, then **loads** the target floor's snapshot into those same top-level slices. This keeps all existing canvas subscriptions working — they never know which floor they're on.

Staircases are special: placing a `StairCaseDown` calls `ensureAdjacentFloor()` which creates the next floor down (or picks an existing one) and places a `StairCaseUp` in the mirrored cell. The connection is maintained by the "level" integer on `FloorRecord`.

---

## Object registry

`objectRegistry.ts` is a simple `Map<id, THREE.Object3D>`. Every prop and opening registers itself on mount and unregisters on unmount. The post-processing outline pass uses this map to find the selected object in O(1) without traversing the full scene graph.

---

## Content pack system

Assets (tiles, props, openings) are defined as `ContentPackAsset` objects and bundled into `ContentPack`s. The registry keeps a flat lookup by ID. The canvas never imports asset files directly — it asks the registry for a component by asset ID. This makes adding new asset packs a matter of appending to the registry array.

See [Content Packs](./content-packs.md) for the full story.
