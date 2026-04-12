# File Format

DungeonPlanner saves dungeons as JSON files with a `.dungeon.json` extension. This page documents the current schema (v5), the versioning strategy, and how migrations work.

---

## Versioning

Every file starts with a `version` field. The current version is **5**. When breaking schema changes are needed:

1. Increment `CURRENT_VERSION` in `serialization.ts`
2. Add a migration in `migrateFile(raw)` that transforms `v(n-1)` to `v(n)`
3. Earlier versions cascade through all migrations in order

Loading always runs through the full migration chain. A v2 file loaded into the current editor runs through v2→v3, v3→v4, v4→v5 in sequence. This means old saves always open correctly.

---

## Top-level structure

```json
{
  "version": 5,
  "name": "My Dungeon",
  "sceneLighting": { "intensity": 1.0 },
  "postProcessing": {
    "enabled": false,
    "focusDistance": 0.5,
    "focalLength": 8.0,
    "bokehScale": 1.0
  },
  "activeFloorId": "floor-abc123",
  "floorOrder": ["floor-abc123", "floor-def456"],
  "floors": [ /* SerializedFloor[] */ ]
}
```

`floorOrder` controls the display order in the UI (independent of the `level` integer on each floor). `activeFloorId` is the floor the file was saved from — the editor restores the same active floor on load.

---

## SerializedFloor

Each floor serializes its full working state:

```json
{
  "id": "floor-abc123",
  "name": "Ground Floor",
  "level": 0,
  "layers": [
    { "id": "default", "name": "Default", "visible": true, "locked": false }
  ],
  "layerOrder": ["default"],
  "activeLayerId": "default",
  "rooms": [
    { "id": "room-001", "name": "Entrance Hall", "layerId": "default",
      "floorAssetId": null, "wallAssetId": null }
  ],
  "cells": [ /* SerializedCell[] */ ],
  "objects": [ /* SerializedObject[] */ ],
  "openings": [ /* SerializedOpening[] */ ],
  "nextRoomNumber": 2
}
```

`null` for `floorAssetId` / `wallAssetId` on a room means "inherit the global selection" — the actual asset used is resolved at render time, not saved.

---

## SerializedCell

```json
{
  "x": 3,
  "z": 5,
  "layerId": "default",
  "roomId": "room-001"
}
```

`roomId` is `null` for cells that haven't been assigned to a room. Cell keys (`"3:5"`) are reconstructed on load from `x` and `z`, not stored directly — this keeps the JSON more readable and prevents key/coordinate drift.

---

## SerializedObject

```json
{
  "id": "obj-xyz789",
  "assetId": "core.props_wall_torch",
  "position": [7.0, 0.45, 11.0],
  "rotation": [0, 1.5708, 0],
  "cell": [3, 5],
  "cellKey": "3:5",
  "layerId": "default",
  "props": {}
}
```

`props` is reserved for future per-instance configuration (e.g. custom light colours). It's always an empty object today but is preserved through save/load for forward compatibility.

---

## SerializedOpening

```json
{
  "id": "opening-aaa111",
  "assetId": "core.opening_door_wall_1",
  "wallKey": "4:2:north",
  "width": 1,
  "flipped": false,
  "layerId": "default"
}
```

`wallKey` encodes the centre wall segment: `"x:z:direction"`. For a multi-width opening (`width: 3`), this is the **centre** segment; the other two are derived by `getOpeningSegments()`.

`flipped` is important for doors — it controls whether the door opens toward you or away. It was missing from the format until v5 (the bug fix is documented below).

---

## Migration history

### v1 → v2
Added `rooms` and room assignment to cells. Cells that had no `roomId` get `null`.

### v2 → v3
Added multi-floor support. Single-floor files are wrapped into the `floors` array structure.

### v3 → v4
Added layers. All cells and objects are assigned to a default layer if not present.

### v4 → v5
Added `flipped` to `SerializedOpening`. Openings without a `flipped` field default to `false` (unflipped). This fixed a silent data-loss bug where the flipped state of all doors was dropped on every save/load.

---

## Notes on asset ID stability

Asset IDs (like `"core.props_wall_torch"`) are stored directly in the file. If an asset is renamed or removed from a content pack, existing saves that reference it will still load — they'll just show the grey fallback box instead of the model. The asset ID is preserved in memory so a re-added asset (same ID) would show up again without needing to re-save.

This means you should treat asset IDs as **stable public identifiers**. Don't rename them without a migration plan.

---

## Parsing and error handling

`parseFile(json)` returns `{ data, error }`. On success, `data` is the deserialized state; on failure, `error` is a human-readable message and `data` is `null`.

The parser is defensive: it checks for required top-level fields and bails with an error message if anything is missing. Partial loads (loading half a corrupted file) are not attempted — it's all or nothing.

---

## Example: minimal v5 file

A single empty floor with no cells, objects, or openings:

```json
{
  "version": 5,
  "name": "Empty Dungeon",
  "sceneLighting": { "intensity": 1.0 },
  "postProcessing": {
    "enabled": false,
    "focusDistance": 0.5,
    "focalLength": 8.0,
    "bokehScale": 1.0
  },
  "activeFloorId": "f1",
  "floorOrder": ["f1"],
  "floors": [
    {
      "id": "f1",
      "name": "Ground Floor",
      "level": 0,
      "layers": [{ "id": "default", "name": "Default", "visible": true, "locked": false }],
      "layerOrder": ["default"],
      "activeLayerId": "default",
      "rooms": [],
      "cells": [],
      "objects": [],
      "openings": [],
      "nextRoomNumber": 1
    }
  ]
}
```
