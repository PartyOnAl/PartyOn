import { useEffect, useState } from 'react'

const FALLBACK_CLUB_COVER =
  'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef8?w=1200&q=80'

type ClubCoverImageProps = {
  src: string | undefined | null
  alt: string
  className?: string
}

export function ClubCoverImage({ src, alt, className }: ClubCoverImageProps) {
  const normalized = src?.trim() ? src.trim() : ''
  const [url, setUrl] = useState(
    () => (normalized.length > 0 ? normalized : FALLBACK_CLUB_COVER),
  )

  useEffect(() => {
    const n = src?.trim() ? src.trim() : ''
    setUrl(n.length > 0 ? n : FALLBACK_CLUB_COVER)
  }, [src])

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setUrl(FALLBACK_CLUB_COVER)}
      className={className}
    />
  )
}
