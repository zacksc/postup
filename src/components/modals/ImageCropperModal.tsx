import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CropArea {
  width: number
  height: number
  x: number
  y: number
}

interface ImageCropperModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  imageUrl: string
  onCropComplete: (croppedBlob: Blob) => void
  aspect?: number
  title?: string
}

export default function ImageCropperModal({
  open,
  onOpenChange,
  imageUrl,
  onCropComplete,
  aspect = 1,
  title = 'Redimensionar imagem',
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null)
  const [processing, setProcessing] = useState(false)

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location)
  }, [])

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom)
  }, [])

  const onCropAreaChange = useCallback((_area: CropArea, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  async function handleConfirm() {
    if (!croppedAreaPixels || processing) return
    setProcessing(true)
    try {
      const blob = await getCroppedImg(imageUrl, croppedAreaPixels)
      onCropComplete(blob)
      onOpenChange(false)
    } catch {
      console.error('Erro ao recortar imagem')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-[400px] bg-secondary/30 rounded-xl overflow-hidden">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaChange}
          />
        </div>
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground shrink-0">Zoom</span>
          <input
            type="range"
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            min={1}
            max={3}
            step={0.1}
            className="flex-1 accent-primary"
          />
          <span className="text-xs text-muted-foreground shrink-0 w-8 text-right">{zoom.toFixed(1)}x</span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={processing}>
            {processing ? 'Processando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function getCroppedImg(imageSrc: string, pixelCrop: CropArea): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const maxDim = 1200
      let { width: cropW, height: cropH } = pixelCrop
      if (cropW > maxDim || cropH > maxDim) {
        const ratio = Math.min(maxDim / cropW, maxDim / cropH)
        cropW = Math.round(cropW * ratio)
        cropH = Math.round(cropH * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No 2d context')); return }
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        cropW,
        cropH,
      )
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas is empty')); return }
        resolve(blob)
      }, 'image/webp', 0.82)
    }
    image.onerror = reject
    image.src = imageSrc
  })
}
