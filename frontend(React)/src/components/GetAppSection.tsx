import { motion } from 'framer-motion'
import { Download, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useLocation, useNavigate } from 'react-router-dom'

const APP_MOCKUP =
  'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=520&q=80'

type Review = {
  id: string
  name: string
  handle: string
  avatar: string
  quote: string
  /** Short punchline under the quote — keeps cards feeling full without more copy. */
  shortComment: string
}

const REVIEWS: Review[] = [
  {
    id: '1',
    name: 'Jack',
    handle: '@jack',
    avatar: 'https://i.pravatar.cc/96?img=12',
    quote: 'Booking tables has never been this easy. Walked in like VIP.',
    shortComment: 'Would book again — 10/10 night.',
  },
  {
    id: '2',
    name: 'Laura',
    handle: '@laura',
    avatar: 'https://i.pravatar.cc/96?img=45',
    quote: "Best nights I've had in Tirana. Everything is in one app.",
    shortComment: 'My go-to app every weekend.',
  },
  {
    id: '3',
    name: 'Mark',
    handle: '@mark',
    avatar: 'https://i.pravatar.cc/96?img=33',
    quote: 'No more calling clubs. Just book and go.',
    shortComment: 'Took me under a minute.',
  },
  {
    id: '4',
    name: 'Sarah',
    handle: '@sarah',
    avatar: 'https://i.pravatar.cc/96?img=23',
    quote: 'The QR entry is so smooth. No waiting.',
    shortComment: 'In and dancing in seconds.',
  },
]

/** Tiny trust labels under the stats row — quick scan, no noise. */
const TRUST_CHIPS = [
  'Verified venues',
  'Secure checkout',
  'Live lineups',
  'Same-night entry',
] as const

const LEFT_REVIEWS = [REVIEWS[0], REVIEWS[1]]
const RIGHT_REVIEWS = [REVIEWS[2], REVIEWS[3]]

const STATS_LINE = [
  { value: '120K+', label: 'tickets sold' },
  { value: '15K+', label: 'tables booked' },
  { value: '20+', label: 'cities' },
] as const

function StarRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex gap-1', className)} aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="h-[1.1rem] w-[1.1rem] shrink-0 text-primary"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 2l2.9 7.4h7.6l-6 4.6 2.3 7.4L12 16.9 5.2 21.4 7.5 14l-6-4.6h7.6L12 2z" />
        </svg>
      ))}
    </div>
  )
}

function FlankReviewCard({
  item,
  motionIndex,
  side,
}: {
  item: Review
  motionIndex: number
  side: 'left' | 'right'
}) {
  const fromX = side === 'left' ? -48 : 48

  return (
    <div className={cn('relative flex', side === 'left' ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full',
          side === 'left'
            ? 'bg-[radial-gradient(circle closest-side,hsl(330_81%_60%/0.12),transparent_100%)]'
            : 'bg-[radial-gradient(circle closest-side,hsl(280_65%_55%/0.12),transparent_100%)]',
        )}
        aria-hidden
      />
      <motion.article
        initial={{ opacity: 0, x: fromX }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6, delay: motionIndex * 0.15, ease: 'easeOut' }}
        className={cn(
          'relative z-10 w-full max-w-[min(100%,340px)] overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3.5 shadow-[0_0_30px_hsl(330_81%_60%/0.08),0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-[12px]',
          'transition-all duration-300 ease-out',
          'hover:-translate-y-[6px] hover:shadow-[0_0_40px_hsl(330_81%_60%/0.18),0_12px_40px_rgba(0,0,0,0.45)]',
          side === 'left' ? '-rotate-[0.6deg]' : 'rotate-[0.6deg]',
        )}
      >
        <span
          className="pointer-events-none absolute left-1 top-0 font-serif text-[4.25rem] leading-none text-white/[0.06] sm:text-[4.75rem]"
          aria-hidden
        >
          &ldquo;
        </span>
        <div className="relative z-[1] flex flex-row items-start gap-3.5">
          <div className="shrink-0 rounded-full bg-gradient-to-br from-primary via-primary to-accent p-[1.5px] shadow-[0_0_16px_hsl(330_81%_60%/0.25)]">
            <img
              src={item.avatar}
              alt={`${item.name} profile photo`}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <p className="text-base font-bold leading-none text-white">
                {item.name}
                <span className="ml-2 text-[0.75rem] font-normal text-white/[0.4]">{item.handle}</span>
              </p>
              <StarRow className="shrink-0" />
            </div>
            <p className="mt-2.5 text-left text-[0.88rem] italic leading-[1.65] text-white/[0.82]">
              {item.quote}
            </p>
            <p className="mt-2 border-t border-white/[0.06] pt-2 text-[0.72rem] font-medium leading-snug text-primary/90">
              {item.shortComment}
            </p>
          </div>
        </div>
      </motion.article>
    </div>
  )
}

function MobileReviewCard({ item, motionIndex }: { item: Review; motionIndex: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-24px' }}
      transition={{ duration: 0.45, delay: motionIndex * 0.08, ease: 'easeOut' }}
      className={cn(
        'relative w-full overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_0_24px_hsl(330_81%_60%/0.06),0_6px_24px_rgba(0,0,0,0.35)] backdrop-blur-[12px]',
        'transition-all duration-300 ease-out',
        'hover:-translate-y-1 hover:shadow-[0_0_32px_hsl(330_81%_60%/0.14),0_8px_28px_rgba(0,0,0,0.4)]',
      )}
    >
      <span
        className="pointer-events-none absolute left-0.5 top-0 font-serif text-[2.75rem] leading-none text-white/[0.06]"
        aria-hidden
      >
        &ldquo;
      </span>
      <div className="relative z-[1] flex flex-row items-start gap-2.5">
        <div className="shrink-0 rounded-full bg-gradient-to-br from-primary via-primary to-accent p-[1.5px]">
          <img
            src={item.avatar}
            alt={`${item.name} profile photo`}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="text-sm font-bold leading-none text-white">
              {item.name}
              <span className="ml-1.5 text-[0.7rem] font-normal text-white/[0.4]">{item.handle}</span>
            </p>
            <StarRow className="scale-90" />
          </div>
          <p className="mt-1.5 text-[0.8rem] italic leading-relaxed text-white/[0.8]">{item.quote}</p>
          <p className="mt-1.5 text-[0.65rem] font-medium leading-tight text-primary/85">{item.shortComment}</p>
        </div>
      </div>
    </motion.article>
  )
}

function TrustChipsRow() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="mt-4 flex flex-wrap items-center justify-center gap-2"
    >
      {TRUST_CHIPS.map((label) => (
        <span
          key={label}
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white/50"
        >
          {label}
        </span>
      ))}
    </motion.div>
  )
}

/** Decorative dashed curves from review cards toward the phone (desktop only). */
function ReviewConnectorLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full text-white/[0.07]"
      viewBox="0 0 1000 560"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M 175 62 C 300 70, 370 190, 448 248"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 5"
      />
      <path
        d="M 175 318 C 285 310, 375 278, 448 268"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 5"
      />
      <path
        d="M 825 318 C 715 310, 625 278, 552 268"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 5"
      />
      <path
        d="M 825 62 C 700 70, 630 190, 552 248"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 5"
      />
    </svg>
  )
}

function StatsTrustRow() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="flex flex-wrap items-center justify-center gap-x-0 gap-y-2 text-center"
    >
      {STATS_LINE.map((stat, i) => (
        <div key={stat.label} className="flex items-center">
          {i > 0 ? (
            <>
              <span className="mx-2 text-white/20 sm:hidden" aria-hidden>
                ·
              </span>
              <span className="mx-3 hidden h-3 w-px bg-white/[0.12] sm:inline" aria-hidden />
            </>
          ) : null}
          <span className="text-xs text-muted-foreground sm:text-sm">
            <span className="font-semibold text-white/80">{stat.value}</span>{' '}
            {stat.label}
          </span>
        </div>
      ))}
    </motion.div>
  )
}

function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55 }}
      className="relative z-[3] w-full max-w-[min(100%,280px)] shrink-0 sm:max-w-[min(100%,260px)] md:max-w-[min(100%,240px)] lg:max-w-[272px]"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[min(380px,70vw)] w-[min(380px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[88px]"
        aria-hidden
      />
      <div className="rounded-[2.35rem] bg-gradient-to-b from-zinc-500 via-zinc-800 to-zinc-950 p-[11px] shadow-[0_28px_56px_-16px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.14]">
        <div className="relative overflow-hidden rounded-[1.85rem] bg-black ring-1 ring-black/80">
          <div
            className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_1px_2px_rgba(255,255,255,0.08)] ring-1 ring-white/[0.08]"
            aria-hidden
          />
          <div className="aspect-[9/19.5] w-full bg-zinc-950">
            <img
              src={APP_MOCKUP}
              alt="PartyOn app preview on a phone"
              loading="lazy"
              width={390}
              height={844}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function GetAppSection() {
  const navigate = useNavigate()
  const location = useLocation()

  function goToEventsSection() {
    const scrollToEvents = () => {
      document.getElementById('events')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
    if (location.pathname !== '/' && location.pathname !== '/home') {
      void navigate({ pathname: '/', hash: 'events' })
      return
    }
    const base = location.pathname === '/home' ? '/home' : '/'
    void navigate({ pathname: base, hash: 'events' }, { replace: true })
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToEvents)
    })
  }

  return (
    <section
      className="relative overflow-hidden border-t border-white/[0.06] bg-[#06060a] py-10 md:py-24 lg:py-28"
      aria-labelledby="get-app-unified-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_38%,hsl(330_81%_60%/0.08),transparent_58%),radial-gradient(ellipse_55%_45%_at_50%_42%,hsl(280_65%_55%/0.07),transparent_52%)]"
        aria-hidden
      />

      <div className="po-container relative z-10">
        <div className="mx-auto max-w-[1480px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center text-center"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm font-medium text-primary shadow-[0_0_28px_-6px_hsl(330_81%_60%/0.55)]">
              <Sparkles className="h-4 w-4" aria-hidden />
              get the app
            </div>

            <h2
              id="get-app-unified-heading"
              className="font-display text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[1.12] tracking-tight text-white"
            >
              Your <span className="gradient-text">Night</span> Starts Here
            </h2>
            <p className="mt-2 sm:mt-3 max-w-lg text-sm sm:text-base text-muted-foreground md:text-lg">
              Find events, book tickets, and reserve tables in seconds
            </p>

            <div className="mt-5 sm:mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-full border-2 border-white/90 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
              >
                <Download className="h-4 w-4" />
                Download App
              </Button>
              <Button
                type="button"
                className="h-12 rounded-full border-0 bg-gradient-to-r from-primary to-accent px-7 font-semibold text-primary-foreground shadow-[0_0_24px_-4px_hsl(330_81%_60%/0.55)] transition-shadow duration-200 hover:shadow-[0_0_36px_0_hsl(330_81%_60%/0.45)]"
                onClick={goToEventsSection}
              >
                <Sparkles className="h-4 w-4" />
                Explore Events
              </Button>
            </div>
          </motion.div>

          <div className="mt-5 md:mt-10">
            <StatsTrustRow />
            <TrustChipsRow />
          </div>

          {/* Desktop: staggered review columns + phone + faint connector SVG */}
          <div className="relative mt-12 hidden min-h-[540px] w-full lg:mt-16 lg:block xl:min-h-[580px]">
            <ReviewConnectorLines />
            <div className="relative z-[2] flex items-center justify-center gap-6 px-3 sm:px-4 lg:gap-10 xl:gap-20 2xl:gap-32">
              <div className="relative h-[540px] w-[min(100%,360px)] shrink-0 xl:h-[580px] xl:w-[min(100%,380px)]">
                <div className="absolute right-0 top-[8%] w-full max-w-[340px] xl:top-[10%]">
                  <FlankReviewCard item={LEFT_REVIEWS[0]} motionIndex={0} side="left" />
                </div>
                <div className="absolute right-0 top-[58%] w-full max-w-[340px] -translate-y-1/2 xl:top-[60%]">
                  <FlankReviewCard item={LEFT_REVIEWS[1]} motionIndex={1} side="left" />
                </div>
              </div>

              <div className="flex min-w-0 shrink-0 justify-center px-1 sm:px-4">
                <PhoneMockup />
              </div>

              <div className="relative h-[540px] w-[min(100%,360px)] shrink-0 xl:h-[580px] xl:w-[min(100%,380px)]">
                <div className="absolute left-0 top-[58%] w-full max-w-[340px] -translate-y-1/2 xl:top-[60%]">
                  <FlankReviewCard item={RIGHT_REVIEWS[0]} motionIndex={2} side="right" />
                </div>
                <div className="absolute left-0 top-[8%] w-full max-w-[340px] xl:top-[10%]">
                  <FlankReviewCard item={RIGHT_REVIEWS[1]} motionIndex={3} side="right" />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile / tablet layout: phone + reviews */}
          <div className="mt-8 lg:hidden">
            {/* Phone + first two reviews side by side */}
            <div className="flex items-start gap-4 sm:gap-6">
              {/* Phone — capped small so reviews have room */}
              <div className="shrink-0 w-[130px] sm:w-[160px]">
                <PhoneMockup />
              </div>
              {/* First two reviews stacked beside the phone */}
              <div className="flex flex-1 flex-col gap-3 pt-2">
                {[REVIEWS[0], REVIEWS[1]].map((item, i) => (
                  <MobileReviewCard key={item.id} item={item} motionIndex={i} />
                ))}
              </div>
            </div>
            {/* Last two reviews full-width below */}
            <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4">
              {[REVIEWS[2], REVIEWS[3]].map((item, i) => (
                <MobileReviewCard key={item.id} item={item} motionIndex={i + 2} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
