import { computePlayVisibilityData } from './playVisibilityCore'

self.addEventListener('message', (event) => {
  const { requestId, input } = event.data as {
    requestId: number
    input: Parameters<typeof computePlayVisibilityData>[0]
  }

  const result = computePlayVisibilityData(input)
  self.postMessage({ requestId, result })
})
