import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClubCoverImage } from '@/components/ClubCoverImage'
import { useCatalog } from '@/contexts/CatalogContext'
import type { Club } from '@/types'
import { cn } from '@/lib/utils'
import './ClubsSection.css'

/** Row tracks consumed per 5-card block (pattern A: 2 rows, pattern B: 3 rows). */
function rowTracksForBlock(blockIndex: number): number {
  return blockIndex % 2 === 0 ? 2 : 3
}

function startRowLineForBlock(blockIndex: number): number {
  let line = 1
  for (let b = 0; b < blockIndex; b++) {
    line += rowTracksForBlock(b)
  }
  return line
}

const OVERLAY_GRADIENT =
  'linear-gradient(180deg, transparent 0%, transparent 60%, rgba(0,0,0,0.6) 100%)'

/**
 * Alternating 5-tile layouts on a 3-column × 160px grid (lg+):
 *
 * Pattern A (even block): portrait “column” + four squares
 * [ T ][a][b]
 * [ T ][c][d]
 *
 * Pattern B (odd block): landscape strip + tall stack + squares + wide bottom
 * [ W  W ][P]
 * [ a ][b][P]
 * [ c c ][P]   (c spans cols 1–2 only)
 */
function mosaicPlacementStyle(index: number): CSSProperties {
  const block = Math.floor(index / 5)
  const p = index % 5
  const r = startRowLineForBlock(block)
  const patternA = block % 2 === 0

  if (patternA) {
    switch (p) {
      case 0:
        return { gridColumn: '1 / 2', gridRow: `${r} / ${r + 2}` }
      case 1:
        return { gridColumn: '2 / 3', gridRow: `${r} / ${r + 1}` }
      case 2:
        return { gridColumn: '3 / 4', gridRow: `${r} / ${r + 1}` }
      case 3:
        return { gridColumn: '2 / 3', gridRow: `${r + 1} / ${r + 2}` }
      case 4:
        return { gridColumn: '3 / 4', gridRow: `${r + 1} / ${r + 2}` }
      default:
        return {}
    }
  }

  switch (p) {
    case 0:
      return { gridColumn: '1 / 3', gridRow: `${r} / ${r + 1}` }
    case 1:
      return { gridColumn: '3 / 4', gridRow: `${r} / ${r + 3}` }
    case 2:
      return { gridColumn: '1 / 2', gridRow: `${r + 1} / ${r + 2}` }
    case 3:
      return { gridColumn: '2 / 3', gridRow: `${r + 1} / ${r + 2}` }
    case 4:
      return { gridColumn: '1 / 3', gridRow: `${r + 2} / ${r + 3}` }
    default:
      return {}
  }
}

/** Public venue detail URL (Hot Venues + search). */
export function clubVenueDetailPath(id: string) {
  return `/clubs/${encodeURIComponent(id)}`
}

function VenueCard({ club }: { club: Club }) {
  return (
    <Link
      to={clubVenueDetailPath(club.id)}
      className={cn(
        'group relative isolate flex h-full max-h-full min-h-0 w-full overflow-hidden rounded-[10px]',
        'bg-black outline-none',
        'transition-[box-shadow,transform] duration-300 ease-in-out',
        'focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        'hover:shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_0_20px_-4px_rgba(255,255,255,0.12)]',
      )}
    >
      <ClubCoverImage
        src={club.imageUrl}
        alt={club.name}
        className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 ease-in-out group-hover:scale-[1.03]"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: OVERLAY_GRADIENT }}
        aria-hidden
      />
      <div className="relative z-[1] mt-auto flex flex-col gap-0.5 p-2.5">
        <h3 className="text-left text-[13px] font-bold leading-snug text-white">
          {club.name}
        </h3>
        {club.city ? (
          <span className="text-left text-[11px] text-neutral-400">{club.city}</span>
        ) : null}
      </div>
    </Link>
  )
}

export function ClubsSection() {
  const { clubs: allClubs, loading } = useCatalog()

  return (
    <section
      id="clubs"
      className="min-w-0 overflow-x-hidden border-t border-border/30 bg-black py-16 text-foreground md:py-20"
    >
      <div className="po-container space-y-8 md:space-y-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-3xl font-bold text-white md:text-4xl"
        >
          Hot Venues
        </motion.h2>

        {loading && allClubs.length === 0 ? (
          <p className="text-sm text-neutral-500">Loading venues…</p>
        ) : null}

        {!loading && allClubs.length === 0 ? (
          <p className="rounded-[10px] border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-neutral-400">
            No clubs in the catalog yet. Add rows in your clubs table to fill this grid.
          </p>
        ) : (
          <div
            className={cn(
              'clubs-hot-venues-root grid w-full overflow-x-hidden',
              'grid-cols-1 gap-[8px]',
              'max-md:auto-rows-[180px]',
              'md:grid-cols-2 md:auto-rows-[160px]',
              'lg:grid-cols-3 lg:auto-rows-[160px]',
            )}
          >
            {allClubs.map((club, index) => (
              <motion.div
                key={club.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-24px' }}
                transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.24) }}
                className={cn(
                  'clubs-mosaic-cell min-h-0 min-w-0 overflow-hidden rounded-[10px]',
                  'max-md:h-[180px]',
                  'md:h-[160px] lg:h-auto',
                )}
                style={mosaicPlacementStyle(index)}
              >
                <VenueCard club={club} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
