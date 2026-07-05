/**
 * Strings encoded in customer-facing entry QRs (must match web + door guard).
 * Reservations: `reservation:<uuid>` — the guard splits on the first `:`
 * (`source` = `reservation`, `id` = UUID). A bare UUID in `qr_code` is NOT valid
 * (no source → ticket path). Always emit the `reservation:` prefix for tables.
 * Paid tickets: `tickets:<payment_id>` (per row in `payments`, not Stripe batch id).
 */

type PaymentLike = { payment_id?: string | null }

/** UUID (any version) — used to tell a DB `qr_code` default apart from human refs like `RES-…`. */
export function looksLikeReservationUuid(s: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s ?? '').trim())
}

/**
 * Supabase rows may use `reservation_id` (legacy/Nest) or `id` (modern) as the UUID PK.
 * Prefer whichever field is a UUID so gate + UI match the real reservation row.
 */
export function canonicalReservationRowId(row: {
  reservation_id?: string | null
  id?: string | null
}): string {
  const a = String(row.reservation_id ?? '').trim()
  const b = String(row.id ?? '').trim()
  if (looksLikeReservationUuid(a)) return a
  if (looksLikeReservationUuid(b)) return b
  return a || b
}

/** UUID for display: bare UUID, or id segment of `reservation:<uuid>`. */
export function uuidFromReservationQrPayload(payload: string | null | undefined): string | null {
  const t = String(payload ?? '').trim()
  if (!t) return null
  if (looksLikeReservationUuid(t)) return t
  if (/^reservation:/i.test(t)) {
    const idPart = t.slice(t.indexOf(':') + 1).trim()
    return looksLikeReservationUuid(idPart) ? idPart : null
  }
  return null
}

export function ticketGatePayload(paymentId: string | null | undefined): string | null {
  const id = String(paymentId ?? '').trim()
  if (!id) return null
  if (/^tickets:/i.test(id)) return id
  return `tickets:${id}`
}

/** Scan string for QR image + human-readable reservation UUID for labels. */
export function reservationGateScanAndDisplay(row: {
  reservation_id?: string | null
  id?: string | null
  qr_code?: string | null
}): { scanPayload: string | null; displayId: string | null } {
  const rowId = canonicalReservationRowId(row)
  const scanPayload = reservationGatePayload(rowId || undefined, row.qr_code)
  const displayId = looksLikeReservationUuid(rowId)
    ? rowId
    : uuidFromReservationQrPayload(scanPayload) ?? (rowId || null)
  return { scanPayload, displayId }
}

export function reservationGatePayload(
  reservationId: string | null | undefined,
  qrCodeFromDb: string | null | undefined,
): string | null {
  const rid = String(reservationId ?? '').trim()
  const raw = String(qrCodeFromDb ?? '').trim()

  if (/^tickets:/i.test(raw)) return raw

  if (/^reservation:/i.test(raw)) {
    const idPart = raw.slice(raw.indexOf(':') + 1).trim()
    if (looksLikeReservationUuid(idPart)) return raw
    if (rid && looksLikeReservationUuid(rid)) return `reservation:${rid}`
    if (idPart) return raw
  }

  // DB default `qr_code` is often a bare UUID — still need `reservation:` for the guard.
  if (raw && looksLikeReservationUuid(raw) && !raw.includes(':')) {
    const canonical = rid && looksLikeReservationUuid(rid) ? rid : raw
    return `reservation:${canonical}`
  }

  if (!rid) return null
  return `reservation:${rid}`
}

export function isTableReservationType(type: string | null | undefined): boolean {
  const t = String(type ?? '').toLowerCase()
  if (t === 'table') return true
  return t.includes('table') || t.includes('vip') || t.includes('reservation')
}

/** One or more payloads for a reservation row (table → one; ticket → one per payment). */
export function reservationRowGatePayloads(row: {
  reservation_id?: string | null
  id?: string | null
  type?: string | null
  qr_code?: string | null
  payments?: PaymentLike | PaymentLike[] | null
}): string[] {
  const rowId = canonicalReservationRowId(row)
  if (isTableReservationType(row.type)) {
    const one = reservationGatePayload(rowId || undefined, row.qr_code)
    return one ? [one] : []
  }
  const p = row.payments
  const list = Array.isArray(p) ? p : p ? [p] : []
  const out = list
    .map((pay) => ticketGatePayload(pay?.payment_id))
    .filter((x): x is string => !!x)
  if (out.length === 0) {
    const raw = String(row.qr_code ?? '').trim()
    if (/^tickets:/i.test(raw)) return [raw]
    if (/^reservation:/i.test(raw)) {
      const one = reservationGatePayload(rowId || undefined, raw)
      return one ? [one] : []
    }
  }
  return out
}
