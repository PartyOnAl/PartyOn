import type { Promotion, PromotionOfferCard, PromotionOfferDetail } from '@/types'
import { normalizeLatLngPair } from '@/lib/geoNormalize'

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1200&q=80'

const DEFAULT_TERMS_SUMMARY =
  'Offer subject to availability, venue rules, and age restrictions. Non-transferable unless stated.'

const DEFAULT_TERMS_FULL = `${DEFAULT_TERMS_SUMMARY}

PartyOn acts as a marketing and booking platform only. The venue is solely responsible for fulfilment, service quality, and compliance with local laws. Prices include applicable taxes unless the venue states otherwise at checkout.

Cancellations follow the venue's policy. Abuse, resale, or fraudulent redemption may void the offer without refund. By claiming this offer you accept the venue's house rules and dress code where applicable.`

function pickCtaLabel(promo: Promotion): PromotionOfferDetail['ctaLabel'] {
  const t = `${promo.title} ${promo.badge}`.toLowerCase()
  if (t.includes('free') || t.includes('2-for') || t.includes('2 for')) return 'Claim Offer'
  if (t.includes('vip') || t.includes('table') || t.includes('bottle')) return 'Book Now'
  return 'Buy Ticket'
}

function defaultBenefits(promo: Promotion): PromotionOfferDetail['benefits'] {
  return [
    {
      title: 'Real savings',
      subtitle: `Locked-in perks for ${promo.venue} — less than walk-up pricing when the night is busy.`,
    },
    {
      title: 'Skip the guesswork',
      subtitle: 'Redemption steps are clear before you arrive so door and table staff are aligned.',
    },
    {
      title: 'Exclusive window',
      subtitle: `${promo.badge} adds priority treatment over generic guest-list queues where the venue allows it.`,
    },
  ]
}

function defaultRedemptionSteps(promo: Promotion): string[] {
  return [
    'Purchase or claim the offer while logged into PartyOn.',
    `Open your confirmation email or PartyOn wallet entry before you arrive at ${promo.venue}.`,
    'Show the QR or booking reference to the host or cashier named on your confirmation.',
    'Enjoy — staff may ask for a matching ID for age-restricted perks.',
  ]
}

function defaultExcluded(): string[] {
  return [
    'Transport, accommodation, and personal expenses',
    'Additional bottles or upgrades not named in this offer',
    'Cash substitution or retroactive refunds on past visits',
  ]
}

/** Optional richer copy keyed by promotion id (merge over catalog defaults). */
const DETAIL_PATCHES: Record<
  string,
  Partial<
    Pick<
      PromotionOfferDetail,
      | 'tagline'
      | 'description'
      | 'benefits'
      | 'validUntil'
      | 'validUntilShort'
      | 'redemptionSteps'
      | 'included'
      | 'excluded'
      | 'termsSummary'
      | 'termsAndConditions'
      | 'termsBullets'
      | 'address'
      | 'category'
      | 'ctaLabel'
      | 'checkoutPrice'
      | 'originalPrice'
      | 'savingsAmount'
      | 'savingsPercentLabel'
      | 'showPriceInSidebar'
      | 'whyWorthItBulletLines'
      | 'worthCardIncludedItems'
    >
  >
> = {}

/** Split catalog list fields that use `|` inside cells (e.g. `a|b|c` or several array rows). */
function splitPipeDelimitedParts(parts: string[] | null | undefined): string[] {
  if (parts == null) return []
  return parts
    .flatMap((cell) =>
      String(cell)
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean),
    )
}

function promotionIncludedItems(promo: Promotion): string[] {
  const raw = promo.included ?? promo.included_items ?? promo.includedItems
  if (raw == null) return []
  return splitPipeDelimitedParts(Array.isArray(raw) ? raw : [raw])
}

function taglineFromPromo(promo: Promotion): string {
  const d = promo.description.trim()
  if (d.length <= 120) return d
  return `${d.slice(0, 117)}…`
}

function whyLinesToBenefits(
  lines: string[],
): PromotionOfferDetail['benefits'] {
  return lines.map((line) => {
    const m = line.match(/^(.+?)\s*[—–-]\s*(.+)$/)
    if (m) return { title: m[1]!.trim(), subtitle: m[2]!.trim() }
    return { title: line }
  })
}

function currencyDisplay(promo: Promotion): string {
  const c = promo.currency?.trim().toUpperCase()
  if (!c) return '€'
  if (c === 'EUR' || c === '€') return '€'
  if (c === 'USD') return '$'
  if (c === 'GBP') return '£'
  if (c === 'ALL') return 'L'
  return '€'
}

export function buildPromotionOfferDetail(
  id: string,
  promotions: Promotion[],
): PromotionOfferDetail | null {
  const promo = promotions.find((p) => p.id === id)
  if (!promo) return null

  const patch = DETAIL_PATCHES[id] ?? {}

  const trimmedDesc = promo.description.trim()
  const longTrim = promo.longDescription?.trim() ?? ''
  const description =
    patch.description ??
    (longTrim.length > 0
      ? longTrim
      : trimmedDesc.length > 0
        ? trimmedDesc
        : `Details for this offer at ${promo.venue} will appear here when the venue adds a description.`)

  const defaultTermsBullets = [
    DEFAULT_TERMS_SUMMARY,
    'The venue is responsible for fulfilment and may verify ID at entry.',
    'PartyOn is a booking platform; in-venue disputes are handled by the venue.',
    'Offer may be limited on peak nights; unused promotional value may not roll over.',
  ]

  /** When DB has `terms_conditions` but no separate bullet list, show that text instead of generic defaults. */
  function termsBulletsFromFullText(text: string | undefined): string[] | null {
    const full = text?.trim()
    if (!full) return null
    const lines = full
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    return lines.length > 0 ? lines : null
  }

  const showPriceInSidebar = promo.showNumericPricing === true

  let checkoutPrice: number
  let originalPrice: number
  let savingsAmount: number
  let savingsPercentLabel: string | null

  if (!showPriceInSidebar) {
    checkoutPrice = 0
    originalPrice = 0
    savingsAmount = 0
    savingsPercentLabel = null
  } else {
    checkoutPrice =
      patch.checkoutPrice !== undefined
        ? patch.checkoutPrice
        : typeof promo.promoPrice === 'number' && Number.isFinite(promo.promoPrice)
          ? Math.max(0, promo.promoPrice)
          : 0
    originalPrice =
      patch.originalPrice ??
      (typeof promo.listPrice === 'number' && Number.isFinite(promo.listPrice)
        ? promo.listPrice
        : 0)
    savingsAmount =
      patch.savingsAmount ?? Math.max(0, originalPrice - checkoutPrice)
    savingsPercentLabel =
      patch.savingsPercentLabel !== undefined
        ? patch.savingsPercentLabel
        : originalPrice > 0 && savingsAmount > 0
          ? `${Math.round((savingsAmount / originalPrice) * 100)}% off`
          : null
  }

  const parsedValid = promo.validUntil ? new Date(promo.validUntil) : null
  const validDate =
    parsedValid && !Number.isNaN(parsedValid.getTime())
      ? parsedValid
      : new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)

  let lat: number | undefined
  let lng: number | undefined
  if (typeof promo.lat === 'number' && typeof promo.lng === 'number') {
    const n = normalizeLatLngPair(promo.lat, promo.lng)
    lat = n.lat
    lng = n.lng
  }

  const benefitsFromDb =
    promo.whyWorthIt && promo.whyWorthIt.length > 0
      ? whyLinesToBenefits(promo.whyWorthIt)
      : null

  const benefitsResolved =
    patch.benefits ?? benefitsFromDb ?? defaultBenefits(promo)

  const whyFromDbPipes =
    promo.whyWorthIt != null && promo.whyWorthIt.length > 0
      ? splitPipeDelimitedParts(promo.whyWorthIt)
      : null
  const whyWorthItBulletLines =
    patch.whyWorthItBulletLines ??
    (whyFromDbPipes && whyFromDbPipes.length > 0
      ? whyFromDbPipes
      : benefitsResolved.map((b) =>
          b.subtitle ? `${b.title} — ${b.subtitle}` : b.title,
        ))

  const worthCardIncludedItems =
    patch.worthCardIncludedItems !== undefined
      ? patch.worthCardIncludedItems
      : promo.included != null
        ? splitPipeDelimitedParts(promo.included)
        : null

  const termsBulletsResolved =
    patch.termsBullets ??
    (promo.termsBullets && promo.termsBullets.length > 0
      ? promo.termsBullets
      : termsBulletsFromFullText(promo.termsAndConditions) ?? defaultTermsBullets)

  const termsSummaryResolved =
    patch.termsSummary ??
    (termsBulletsResolved[0] ?? DEFAULT_TERMS_SUMMARY)

  const termsFullResolved =
    patch.termsAndConditions ??
    (promo.termsAndConditions?.trim() || DEFAULT_TERMS_FULL)

  return {
    id: promo.id,
    title: promo.title,
    tagline:
      patch.tagline ??
      (promo.subtitle?.trim() || taglineFromPromo(promo)),
    image: promo.image?.trim() || FALLBACK_IMG,
    description,
    benefits: benefitsResolved,
    whyWorthItBulletLines,
    worthCardIncludedItems,
    validUntil:
      patch.validUntil ??
      validDate.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    validUntilShort:
      patch.validUntilShort ??
      validDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    redemptionSteps:
      patch.redemptionSteps ??
      (promo.redemptionSteps && promo.redemptionSteps.length > 0
        ? promo.redemptionSteps
        : defaultRedemptionSteps(promo)),
    included: promotionIncludedItems(promo),
    excluded:
      patch.excluded ??
      (promo.excluded && promo.excluded.length > 0
        ? promo.excluded
        : defaultExcluded()),
    termsSummary: termsSummaryResolved,
    termsAndConditions: termsFullResolved,
    termsBullets: termsBulletsResolved,
    address:
      patch.address ??
      (promo.address?.trim() ||
        [promo.venue, promo.city].filter(Boolean).join(', ') ||
        promo.venue ||
        promo.city ||
        '—'),
    category: patch.category ?? promo.offerType?.trim() ?? 'Club',
    ctaLabel: patch.ctaLabel ?? pickCtaLabel(promo),
    checkoutPrice,
    originalPrice,
    savingsAmount,
    savingsPercentLabel,
    showPriceInSidebar,
    currency: currencyDisplay(promo),
    venue: promo.venue,
    city: promo.city,
    rating: promo.rating,
    badge: promo.badge,
    badgeColor: promo.badgeColor,
    lat,
    lng,
  }
}

export function relatedOfferCards(
  currentId: string,
  promotions: Promotion[],
  limit = 4,
): PromotionOfferCard[] {
  return promotions
    .filter((p) => p.id !== currentId)
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      image: p.image?.trim() || FALLBACK_IMG,
      badge: p.badge,
      badgeColor: p.badgeColor,
      venue: p.venue,
      city: p.city,
      rating: p.rating,
    }))
}
