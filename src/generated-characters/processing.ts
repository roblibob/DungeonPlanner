import type { CreateGeneratedCharacterInput } from './types'

const MAX_SOURCE_DIMENSION = 1024
const THUMBNAIL_SIZE = 256
const OUTLINE_RADIUS = 6
const SUBJECT_ALPHA_THRESHOLD = 18

export async function processGeneratedCharacterImage(sourceImageDataUrl: string) {
  const image = await loadImage(sourceImageDataUrl)
  const { width, height } = downscaleDimensions(image.naturalWidth, image.naturalHeight, MAX_SOURCE_DIMENSION)
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = width
  sourceCanvas.height = height
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
  if (!sourceContext) {
    throw new Error('Canvas 2D context is unavailable.')
  }

  sourceContext.drawImage(image, 0, 0, width, height)
  const sourceImageData = sourceContext.getImageData(0, 0, width, height)
  const alphaMask = new Uint8ClampedArray(width * height)

  for (let index = 0; index < sourceImageData.data.length; index += 4) {
    const pixelIndex = index / 4
    const red = sourceImageData.data[index]
    const green = sourceImageData.data[index + 1]
    const blue = sourceImageData.data[index + 2]
    const alpha = sourceImageData.data[index + 3]
    const adjustedAlpha = Math.round(alpha * foregroundFactor(red, green, blue))

    sourceImageData.data[index + 3] = adjustedAlpha
    alphaMask[pixelIndex] = adjustedAlpha
  }

  removeEdgeConnectedForeground(alphaMask, width, height, SUBJECT_ALPHA_THRESHOLD)
  const cropBounds = getMaskBounds(alphaMask, width, height, SUBJECT_ALPHA_THRESHOLD)

  if (!cropBounds) {
    throw new Error('The generated image did not contain a visible subject after background cleanup.')
  }

  const expandedMask = dilateMask(alphaMask, width, height, OUTLINE_RADIUS)
  const paddedCropBounds = {
    minX: Math.max(0, cropBounds.minX - (OUTLINE_RADIUS + 8)),
    minY: Math.max(0, cropBounds.minY - (OUTLINE_RADIUS + 8)),
    maxX: Math.min(width - 1, cropBounds.maxX + (OUTLINE_RADIUS + 8)),
    maxY: Math.min(height - 1, cropBounds.maxY + (OUTLINE_RADIUS + 8)),
  }
  const cropWidth = paddedCropBounds.maxX - paddedCropBounds.minX + 1
  const cropHeight = paddedCropBounds.maxY - paddedCropBounds.minY + 1

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = cropWidth
  outputCanvas.height = cropHeight
  const outputContext = outputCanvas.getContext('2d')
  if (!outputContext) {
    throw new Error('Canvas 2D context is unavailable.')
  }

  const outlineImageData = outputContext.createImageData(cropWidth, cropHeight)
  const subjectImageData = outputContext.createImageData(cropWidth, cropHeight)

  for (let y = paddedCropBounds.minY; y <= paddedCropBounds.maxY; y += 1) {
    for (let x = paddedCropBounds.minX; x <= paddedCropBounds.maxX; x += 1) {
      const sourceIndex = (y * width) + x
      const targetIndex = ((y - paddedCropBounds.minY) * cropWidth + (x - paddedCropBounds.minX)) * 4
      const alpha = alphaMask[sourceIndex]
      const expanded = expandedMask[sourceIndex]

      if (expanded > 0 && alpha === 0) {
        outlineImageData.data[targetIndex] = 255
        outlineImageData.data[targetIndex + 1] = 255
        outlineImageData.data[targetIndex + 2] = 255
        outlineImageData.data[targetIndex + 3] = expanded
      }

      const originalIndex = sourceIndex * 4
      subjectImageData.data[targetIndex] = sourceImageData.data[originalIndex]
      subjectImageData.data[targetIndex + 1] = sourceImageData.data[originalIndex + 1]
      subjectImageData.data[targetIndex + 2] = sourceImageData.data[originalIndex + 2]
      subjectImageData.data[targetIndex + 3] = alpha
    }
  }

  outputContext.putImageData(outlineImageData, 0, 0)
  outputContext.putImageData(subjectImageData, 0, 0)

  const thumbnailCanvas = document.createElement('canvas')
  thumbnailCanvas.width = THUMBNAIL_SIZE
  thumbnailCanvas.height = THUMBNAIL_SIZE
  const thumbnailContext = thumbnailCanvas.getContext('2d')
  if (!thumbnailContext) {
    throw new Error('Canvas 2D context is unavailable.')
  }

  const containScale = Math.min(
    (THUMBNAIL_SIZE * 0.84) / cropWidth,
    (THUMBNAIL_SIZE * 0.84) / cropHeight,
  )
  const thumbnailWidth = cropWidth * containScale
  const thumbnailHeight = cropHeight * containScale
  const thumbnailX = (THUMBNAIL_SIZE - thumbnailWidth) * 0.5
  const thumbnailY = (THUMBNAIL_SIZE - thumbnailHeight) * 0.5
  thumbnailContext.drawImage(outputCanvas, thumbnailX, thumbnailY, thumbnailWidth, thumbnailHeight)

  return {
    processedImageDataUrl: outputCanvas.toDataURL('image/png'),
    thumbnailDataUrl: thumbnailCanvas.toDataURL('image/png'),
    width: cropWidth,
    height: cropHeight,
  }
}

export function deriveGeneratedCharacterName(prompt: string, ordinal: number) {
  const cleaned = prompt.trim().replace(/\s+/g, ' ')
  if (!cleaned) {
    return `Generated Character ${ordinal}`
  }

  const firstClause = cleaned.split(/[,.!?]/, 1)[0]?.trim() ?? cleaned
  const title = firstClause.slice(0, 34).trim()
  return title.length > 0 ? title : `Generated Character ${ordinal}`
}

export function estimateGeneratedCharacterStorageBytes(
  characters: Record<string, CreateGeneratedCharacterInput | { [key: string]: unknown }>,
) {
  return new Blob([JSON.stringify(characters)]).size
}

function downscaleDimensions(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function foregroundFactor(red: number, green: number, blue: number) {
  const brightness = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue)
  const brightnessScore = smoothstep(224, 255, brightness)
  const neutralScore = 1 - smoothstep(18, 56, chroma)
  const backgroundScore = brightnessScore * neutralScore
  return clamp(1 - smoothstep(0.28, 0.96, backgroundScore), 0, 1)
}

function getMaskBounds(mask: Uint8ClampedArray, width: number, height: number, threshold: number) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] <= threshold) {
      continue
    }

    const x = index % width
    const y = Math.floor(index / width)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  return maxX < minX || maxY < minY
    ? null
    : { minX, minY, maxX, maxY }
}

function removeEdgeConnectedForeground(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
) {
  const queue: number[] = []
  const visited = new Uint8Array(mask.length)

  const enqueueIfForeground = (x: number, y: number) => {
    const index = (y * width) + x
    if (visited[index] || mask[index] <= threshold) {
      return
    }

    visited[index] = 1
    queue.push(index)
  }

  for (let x = 0; x < width; x += 1) {
    enqueueIfForeground(x, 0)
    enqueueIfForeground(x, height - 1)
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueueIfForeground(0, y)
    enqueueIfForeground(width - 1, y)
  }

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const index = queue[queueIndex]
    const x = index % width
    const y = Math.floor(index / width)
    mask[index] = 0

    if (x > 0) enqueueIfForeground(x - 1, y)
    if (x < width - 1) enqueueIfForeground(x + 1, y)
    if (y > 0) enqueueIfForeground(x, y - 1)
    if (y < height - 1) enqueueIfForeground(x, y + 1)
    if (x > 0 && y > 0) enqueueIfForeground(x - 1, y - 1)
    if (x < width - 1 && y > 0) enqueueIfForeground(x + 1, y - 1)
    if (x > 0 && y < height - 1) enqueueIfForeground(x - 1, y + 1)
    if (x < width - 1 && y < height - 1) enqueueIfForeground(x + 1, y + 1)
  }
}

function dilateMask(mask: Uint8ClampedArray, width: number, height: number, radius: number) {
  let current = new Uint8ClampedArray(mask)

  for (let step = 0; step < radius; step += 1) {
    const next = new Uint8ClampedArray(current)
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = (y * width) + x
        if (current[index] > 0) {
          next[index] = 255
          continue
        }

        if (
          current[index - 1] > 0 ||
          current[index + 1] > 0 ||
          current[index - width] > 0 ||
          current[index + width] > 0 ||
          current[index - width - 1] > 0 ||
          current[index - width + 1] > 0 ||
          current[index + width - 1] > 0 ||
          current[index + width + 1] > 0
        ) {
          next[index] = 255
        }
      }
    }
    current = next
  }

  return current
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load generated image.'))
    image.src = source
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return normalized * normalized * (3 - (2 * normalized))
}
