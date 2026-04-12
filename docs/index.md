# DungeonPlanner — Documentation

DungeonPlanner is a browser-based 3D dungeon editor for tabletop RPGs. You paint rooms onto a grid, place props and openings (doors, stairs), organise everything into named layers, and navigate between multiple floor levels — all rendered in real-time using WebGPU.

This documentation covers the whole system from the top down. Read the overview pages first, then dive into whatever interests you.

---

## Table of contents

| Doc | What it covers |
|-----|---------------|
| [Architecture](./architecture.md) | How the major pieces fit together — data flow, component tree, render loop |
| [State & Store](./store.md) | The Zustand store: all state shapes, actions, undo/redo, floors |
| [Content Packs](./content-packs.md) | The asset system: how tiles, props and openings are defined and registered |
| [Rendering](./rendering.md) | Scene graph, grid shader, post-processing, floor transitions |
| [Editor UI](./ui.md) | Toolbar, tool panels, layer panel, scene panel, keyboard shortcuts |
| [File Format](./file-format.md) | Save / load — JSON schema, versioning, migration strategy |

---

## Quick orientation

```
src/
  App.tsx                  — root layout, keyboard shortcuts, debug helpers
  store/
    useDungeonStore.ts     — all dungeon state + actions (Zustand)
    serialization.ts       — save/load v5 JSON
    buildAnimations.ts     — tile rise animation registry
  content-packs/
    core/                  — bundled tile/prop/opening assets
    types.ts               — ContentPackAsset, PropLight, etc.
    registry.ts            — flat asset lookup
  components/
    canvas/                — Three.js / R3F scene components
    editor/                — React UI panels
  hooks/
    useSnapToGrid.ts       — grid math utilities
    useRaycaster.ts        — mouse-to-world intersection
  postprocessing/
    tiltShift.ts           — TSL depth-of-field node
    selectionOutline.ts    — TSL depth-edge outline node
```

The renderer is WebGPU-first with a WebGL fallback — both use Three.js TSL (Three Shading Language) node materials, so shaders are always written in TSL regardless of backend.
