import jsQR from 'jsqr'
import { CameraOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface QrScannerViewProps {
  onDetected: (data: string) => void
  active: boolean
}

/**
 * Renders a live camera preview and scans it for QR codes via jsQR. The
 * camera stream is always torn down on unmount or when `active` goes
 * false — leaving a getUserMedia stream open after the scanner is
 * dismissed would keep the camera light on and leak the stream.
 */
export function QrScannerView({ onDetected, active }: QrScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectedRef = useRef(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    detectedRef.current = false
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        tick()
      } catch {
        if (!cancelled) {
          setPermissionError(
            'Could not access the camera. Check your browser permissions, or use "Paste a link" / "Enter manually" instead.',
          )
        }
      }
    }

    function tick() {
      if (cancelled || detectedRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const result = jsQR(imageData.data, imageData.width, imageData.height)
          if (result?.data) {
            detectedRef.current = true
            onDetected(result.data)
            return
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    start()

    return () => {
      cancelled = true
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDetected identity churn shouldn't restart the camera
  }, [active])

  if (permissionError) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-6)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
        }}
      >
        <CameraOff size={32} />
        <p style={{ fontSize: 14 }}>{permissionError}</p>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: '#000',
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '12%',
          border: '2px solid var(--color-accent)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 0 0 999px rgba(0,0,0,0.35)',
        }}
      />
    </div>
  )
}
