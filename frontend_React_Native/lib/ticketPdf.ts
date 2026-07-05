import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import {
  looksLikeReservationUuid,
  reservationGatePayload,
  ticketGatePayload,
  uuidFromReservationQrPayload,
} from '@/lib/gateQrPayload'

export type TicketPdfAttendee = {
  name: string
  qr_code: string
}

type TicketPdfInput = {
  reservationId: string
  eventName: string
  ticketTypeName: string
  quantity: string
  total?: string | number | null
  isReservation: boolean
  qrCode?: string | null
  attendees?: TicketPdfAttendee[]
  status?: string
  venue?: string | null
  dateText?: string | null
}

function qrFor(code: string, size = 260) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(code)}&bgcolor=ffffff&color=000000&margin=16`
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0)
  return amount > 0 ? `€${amount.toFixed(2)}` : 'Free'
}

function attendeeBlocks(input: TicketPdfInput) {
  if (input.attendees && input.attendees.length > 0) {
    return input.attendees.map((attendee, index) => {
      const scan = ticketGatePayload(attendee.qr_code) ?? attendee.qr_code
      return `
      <section class="qrBlock">
        <div class="guestRow">
          <div class="guestIndex">${index + 1}</div>
          <div>
            <div class="guestName">${esc(attendee.name || `Guest ${index + 1}`)}</div>
            <div class="guestRole">${index === 0 ? 'Buyer' : 'Guest'}</div>
          </div>
        </div>
        <img class="qr" src="${qrFor(scan)}" />
        <div class="code">${esc(scan)}</div>
      </section>
    `
    }).join('')
  }

  if (input.isReservation) {
    const rid = String(input.reservationId ?? '').trim()
    const scan =
      (looksLikeReservationUuid(rid) ? `reservation:${rid}` : null) ??
      reservationGatePayload(rid, input.qrCode) ??
      input.qrCode
    const displayId =
      (looksLikeReservationUuid(rid) ? rid : null) ??
      uuidFromReservationQrPayload(scan) ??
      rid
    if (scan) {
      return `
      <section class="qrBlock">
        <img class="qr" src="${qrFor(scan)}" />
        <div class="code">Reservation ID: ${esc(displayId)}</div>
      </section>
    `
    }
  } else if (input.qrCode) {
    const scan = ticketGatePayload(input.qrCode) ?? input.qrCode
    return `
      <section class="qrBlock">
        <img class="qr" src="${qrFor(scan)}" />
        <div class="code">${esc(scan)}</div>
      </section>
    `
  }

  return `<section class="qrBlock"><div class="bookingId">Booking ID: ${esc(input.reservationId)}</div></section>`
}

function buildTicketHtml(input: TicketPdfInput) {
  const title = input.isReservation ? 'Table Reservation' : 'Ticket'
  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 28px; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0b0b10; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .page { min-height: 100%; padding: 30px; background: linear-gradient(160deg, #11101a 0%, #0b0b10 58%, #171126 100%); }
    .brand { color: #a78bfa; font-size: 18px; font-weight: 800; margin-bottom: 24px; }
    .ticket { background: #171720; border: 1px solid #2a2a36; border-radius: 18px; overflow: hidden; }
    .head { padding: 28px; border-bottom: 1px dashed #3a3a46; }
    .label { color: #a78bfa; font-size: 12px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 10px; }
    h1 { font-size: 30px; line-height: 1.15; margin: 0 0 8px; }
    .sub { color: #c4c4d0; font-size: 15px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; padding: 24px 28px; border-bottom: 1px solid #2a2a36; }
    .item { background: #101018; border: 1px solid #2a2a36; border-radius: 12px; padding: 14px; }
    .itemLabel { color: #8d8da0; font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 5px; }
    .itemValue { color: #fff; font-size: 15px; font-weight: 700; }
    .qrArea { padding: 22px 28px 28px; }
    .qrTitle { color: #c4c4d0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; text-align: center; }
    .qrBlock { page-break-inside: avoid; background: #fff; color: #111; border-radius: 16px; padding: 18px; margin-bottom: 16px; text-align: center; }
    .guestRow { display: flex; align-items: center; gap: 10px; text-align: left; margin-bottom: 12px; }
    .guestIndex { width: 28px; height: 28px; border-radius: 14px; background: #ede9fe; color: #7c3aed; font-weight: 900; display: flex; align-items: center; justify-content: center; }
    .guestName { font-size: 15px; font-weight: 800; }
    .guestRole { color: #666; font-size: 11px; margin-top: 2px; }
    .qr { width: 210px; height: 210px; display: block; margin: 0 auto; }
    .code { color: #555; font-size: 10px; margin-top: 10px; overflow-wrap: anywhere; }
    .bookingId { font-size: 16px; font-weight: 800; }
    .foot { color: #8d8da0; font-size: 11px; text-align: center; margin-top: 18px; }
  </style>
</head>
<body>
  <main class="page">
    <div class="brand">PartyOn</div>
    <article class="ticket">
      <section class="head">
        <div class="label">${title}</div>
        <h1>${esc(input.eventName)}</h1>
        <div class="sub">${esc(input.ticketTypeName)}</div>
      </section>
      <section class="grid">
        <div class="item"><div class="itemLabel">Quantity</div><div class="itemValue">${esc(input.quantity)}</div></div>
        <div class="item"><div class="itemLabel">Status</div><div class="itemValue">${esc(input.status ?? 'Confirmed')}</div></div>
        <div class="item"><div class="itemLabel">${input.isReservation ? 'Cost' : 'Paid'}</div><div class="itemValue">${input.isReservation ? 'Free' : money(input.total)}</div></div>
        <div class="item"><div class="itemLabel">Booking ID</div><div class="itemValue">${esc(input.reservationId)}</div></div>
        ${input.dateText ? `<div class="item"><div class="itemLabel">Date</div><div class="itemValue">${esc(input.dateText)}</div></div>` : ''}
        ${input.venue ? `<div class="item"><div class="itemLabel">Venue</div><div class="itemValue">${esc(input.venue)}</div></div>` : ''}
      </section>
      <section class="qrArea">
        <div class="qrTitle">Show at the door</div>
        ${attendeeBlocks(input)}
      </section>
    </article>
    <div class="foot">Generated by PartyOn. Keep this PDF available for entry.</div>
  </main>
</body>
</html>
`
}

export async function downloadTicketPdf(input: TicketPdfInput) {
  const { uri } = await Print.printToFileAsync({
    html: buildTicketHtml(input),
    base64: false,
  })

  if (!(await Sharing.isAvailableAsync())) {
    return uri
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Download ticket PDF',
    UTI: 'com.adobe.pdf',
  })

  return uri
}
