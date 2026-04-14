import { getContentPackAssetById, getContentPackAssetsByCategory } from '../../content-packs/registry'
import type { ContentPackAsset } from '../../content-packs/types'
import { useDungeonStore } from '../../store/useDungeonStore'

export function PropToolPanel() {
  const selectedAssetIds = useDungeonStore((state) => state.selectedAssetIds)
  const setSelectedAsset = useDungeonStore((state) => state.setSelectedAsset)
  const selection = useDungeonStore((state) => state.selection)
  const selectedObject = useDungeonStore((state) =>
    selection ? state.placedObjects[selection] : null,
  )
  const removeSelectedObject = useDungeonStore((state) => state.removeSelectedObject)
  const propAssets = getContentPackAssetsByCategory('prop')
  const playerAssets = getContentPackAssetsByCategory('player')
  const selectedAsset = selectedObject?.assetId
    ? getContentPackAssetById(selectedObject.assetId)
    : null
  const isCharacterSelection = selectedObject?.type === 'player' || selectedAsset?.category === 'player'
  const catalogSections = [
    { title: 'Characters', assets: playerAssets },
    { title: 'Props', assets: propAssets },
  ]

  return (
    <div className="space-y-4">
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/70">
          Catalogue
        </p>
        <div className="space-y-4">
          {catalogSections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.24em] text-stone-500">
                {section.title}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {section.assets.map((asset) => (
                  <CatalogCard
                    key={asset.id}
                    asset={asset}
                    active={selectedAssetIds.prop === asset.id}
                    onSelect={() => setSelectedAsset('prop', asset.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-800 bg-stone-950/50 p-4 text-xs leading-6 text-stone-400">
        <p className="font-medium text-stone-300">Placement Tool</p>
        <p className="mt-1">Click a room cell to place. Right-click to remove.</p>
        <p>Hold <kbd>Alt</kbd> + click to inspect.</p>
      </section>

      {/* Inline inspector when a prop is selected */}
      {selectedObject && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/70">
            {isCharacterSelection ? 'Selected Character' : 'Selected Prop'}
          </p>
          <div className="rounded-2xl border border-stone-800 bg-stone-900/80 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  {selectedAsset?.name ?? selectedObject.type}
                </p>
                <p className="mt-1 font-mono text-sm text-stone-200">
                  {selectedObject.id.slice(0, 8)}
                </p>
              </div>
              <button
                type="button"
                onClick={removeSelectedObject}
                className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-200 transition hover:border-rose-300/60 hover:bg-rose-500/20"
              >
                Delete
              </button>
            </div>
            <div className="grid gap-2 text-xs">
              <PropRow label="Position" value={selectedObject.position.map((v) => v.toFixed(2)).join(', ')} />
              <PropRow label="Rotation" value={selectedObject.rotation.map((v) => v.toFixed(2)).join(', ')} />
              <PropRow label="Cell" value={selectedObject.cellKey} />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function CatalogCard({
  asset,
  active,
  onSelect,
}: {
  asset: ContentPackAsset
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`overflow-hidden rounded-2xl border text-left transition ${
        active
          ? 'border-teal-300/35 bg-teal-400/10 shadow-[0_0_0_1px_rgba(94,234,212,0.12)]'
          : 'border-stone-800 bg-stone-950/60 hover:border-stone-700'
      }`}
    >
      <div className="aspect-square border-b border-stone-800/80 bg-stone-900/80">
        {asset.thumbnailUrl ? (
          <img
            src={asset.thumbnailUrl}
            alt={`${asset.name} thumbnail`}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.24em] text-stone-600">
            No preview
          </div>
        )}
      </div>
      <div className="space-y-1 px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-stone-100">{asset.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] ${
              active
                ? 'bg-teal-300/15 text-teal-100'
                : asset.category === 'player'
                  ? 'bg-sky-400/10 text-sky-200'
                  : 'bg-stone-800 text-stone-400'
            }`}
          >
            {active ? 'Selected' : asset.category}
          </span>
        </div>
        <p className="text-[11px] text-stone-500">{asset.slug}</p>
      </div>
    </button>
  )
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-2">
      <span className="uppercase tracking-[0.2em] text-stone-500">{label}</span>
      <span className="break-all text-right text-stone-300">{value}</span>
    </div>
  )
}
