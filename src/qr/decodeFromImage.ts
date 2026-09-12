import jsQR from 'jsqr'

export class QrDecodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QrDecodeError'
  }
}

/**
 * Decodes a QR code from an image file (e.g. a screenshot). This is the
 * "I only have one device" path: instead of pointing a second device's
 * camera at a QR code shown on this device's screen, the user saves or
 * screenshots the QR code image and uploads it directly.
 */
export async function decodeQrFromFile(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file)
  const image = await loadImage(dataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new QrDecodeError('Could not read this image in this browser.')
  }
  ctx.drawImage(image, 0, 0)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const result = jsQR(imageData.data, imageData.width, imageData.height)
  if (!result?.data) {
    throw new QrDecodeError('No QR code was found in that image.')
  }
  return result.data
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new QrDecodeError('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new QrDecodeError('That file does not look like a valid image.'))
    img.src = src
  })
}
