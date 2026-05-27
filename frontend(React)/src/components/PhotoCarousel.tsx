import { useEffect, useMemo, useState, type ReactNode } from 'react'
import './PhotoCarousel.css'

type PhotoCarouselProps = {
  images: string[]
  alt: string
  className?: string
  imageClassName?: string
  variant?: 'public' | 'manager'
  currentIndex?: number
  onCurrentIndexChange?: (index: number) => void
  fallbackImage?: string
  emptyContent?: ReactNode
}

export function PhotoCarousel({
  images,
  alt,
  className,
  imageClassName,
  variant = 'public',
  currentIndex,
  onCurrentIndexChange,
  fallbackImage,
  emptyContent,
}: PhotoCarouselProps) {
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set())
  const normalizedImages = useMemo(
    () => images.map((image) => image.trim()).filter(Boolean),
    [images],
  )
  const carouselImages = normalizedImages.length > 0
    ? normalizedImages
    : fallbackImage?.trim()
      ? [fallbackImage.trim()]
      : []
  const [internalIndex, setInternalIndex] = useState(0)
  const activeIndex = currentIndex ?? internalIndex
  const safeIndex = carouselImages.length > 0
    ? Math.min(activeIndex, carouselImages.length - 1)
    : 0
  const activeImage = carouselImages[safeIndex]
  const displayImage = activeImage && failedImages.has(activeImage) && fallbackImage?.trim()
    ? fallbackImage.trim()
    : activeImage
  const hasMultipleImages = carouselImages.length > 1

  function setIndex(nextIndex: number) {
    if (carouselImages.length === 0) return
    const wrappedIndex = (nextIndex + carouselImages.length) % carouselImages.length
    if (onCurrentIndexChange) onCurrentIndexChange(wrappedIndex)
    else setInternalIndex(wrappedIndex)
  }

  useEffect(() => {
    if (carouselImages.length === 0) {
      setIndex(0)
      return
    }
    if (activeIndex > carouselImages.length - 1) setIndex(carouselImages.length - 1)
  }, [activeIndex, carouselImages.length])

  return (
    <div className={`photo-carousel photo-carousel--${variant}${className ? ` ${className}` : ''}`}>
      {displayImage ? (
        <img
          key={displayImage}
          src={displayImage}
          alt={alt}
          className={`photo-carousel__image${imageClassName ? ` ${imageClassName}` : ''}`}
          onError={() => {
            if (activeImage && activeImage !== fallbackImage) {
              setFailedImages((current) => new Set(current).add(activeImage))
            }
          }}
        />
      ) : (
        emptyContent ?? null
      )}
      {hasMultipleImages && (
        <>
          <button
            type="button"
            className="photo-carousel__arrow photo-carousel__arrow--prev"
            aria-label="Show previous photo"
            onClick={() => setIndex(safeIndex - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="photo-carousel__arrow photo-carousel__arrow--next"
            aria-label="Show next photo"
            onClick={() => setIndex(safeIndex + 1)}
          >
            ›
          </button>
          <div className="photo-carousel__dots" aria-label="Photo navigation">
            {carouselImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                className={`photo-carousel__dot${index === safeIndex ? ' photo-carousel__dot--active' : ''}`}
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === safeIndex ? 'true' : undefined}
                onClick={() => setIndex(index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
