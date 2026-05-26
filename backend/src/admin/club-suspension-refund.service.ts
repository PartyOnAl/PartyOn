import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import Stripe from 'stripe'
import { Payments } from 'generated-entities/entities/Payments'

export type SuspensionRefundSuccess = {
  paymentId: string
  intent: string | null
  amount: string
  eventName: string
  /** How many `payments` rows shared this PaymentIntent (e.g. quantity split in DB). */
  paymentRowCount: number
}

export type SuspensionRefundFailure = {
  paymentId: string
  reason: string
}

export type SuspensionRefundReport = {
  /** Rows matching club + completed + same-day + event window (before intent filter). */
  eligibleCount: number
  succeeded: SuspensionRefundSuccess[]
  failed: SuspensionRefundFailure[]
  skippedNoIntent: number
}

function normStatus(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function isSameLocalCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Suspension calendar day overlaps the event window [eventStart, eventEnd]. */
function eventCoversSuspensionDay(
  eventStart: Date,
  eventEnd: Date | null,
  suspensionDayStart: Date,
  suspensionDayEnd: Date,
): boolean {
  const end = eventEnd && !Number.isNaN(eventEnd.getTime()) ? eventEnd : eventStart
  return eventStart <= suspensionDayEnd && end >= suspensionDayStart
}

function sumAmountString(rows: Payments[]): string {
  const total = rows.reduce((sum, row) => sum + Number.parseFloat(String(row.amount ?? 0)), 0)
  return Number.isFinite(total) ? total.toFixed(2) : '0.00'
}

@Injectable()
export class ClubSuspensionRefundService {
  private readonly logger = new Logger(ClubSuspensionRefundService.name)
  private stripe: InstanceType<typeof Stripe> | null = null

  constructor(
    @InjectRepository(Payments)
    private readonly paymentsRepo: Repository<Payments>,
  ) {}

  private getStripe(): InstanceType<typeof Stripe> {
    if (this.stripe) return this.stripe
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new InternalServerErrorException('STRIPE_SECRET_KEY is not configured.')
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-03-25.dahlia',
    })
    return this.stripe
  }

  /**
   * When a club is suspended: refund completed ticket payments that
   * - belong to this club's events,
   * - were paid on the same local calendar day as the suspension,
   * - fall on an event whose [start, end] window covers that suspension day,
   * - have a Stripe PaymentIntent id stored on `payments.intent`.
   *
   * One Stripe `refunds.create` per **distinct** PaymentIntent: multi-quantity
   * checkouts often duplicate the same `intent` on several payment rows.
   */
  async refundEligiblePayments(clubId: string, suspendedAt: Date): Promise<SuspensionRefundReport> {
    const report: SuspensionRefundReport = {
      eligibleCount: 0,
      succeeded: [],
      failed: [],
      skippedNoIntent: 0,
    }

    const dayStart = startOfLocalDay(suspendedAt)
    const dayEnd = endOfLocalDay(suspendedAt)

    const candidates = await this.paymentsRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.event', 'e')
      .innerJoin('e.club', 'c')
      .where('c.clubId = :clubId', { clubId })
      .andWhere('p.paymentDate IS NOT NULL')
      .getMany()

    const toProcess: Payments[] = []
    for (const p of candidates) {
      const st = normStatus(p.status)
      if (st === 'refunded') continue
      if (st !== 'completed') continue
      if (!p.event) continue

      const payDate = p.paymentDate ? new Date(p.paymentDate) : null
      if (!payDate || Number.isNaN(payDate.getTime())) continue
      if (!isSameLocalCalendarDay(payDate, suspendedAt)) continue

      const es = new Date(p.event.eventStartingDate)
      const ee = p.event.eventEndingDate ? new Date(p.event.eventEndingDate) : null
      if (Number.isNaN(es.getTime())) continue
      if (!eventCoversSuspensionDay(es, ee, dayStart, dayEnd)) continue

      toProcess.push(p)
    }

    report.eligibleCount = toProcess.length

    const noIntentRows: Payments[] = []
    const withIntent: Payments[] = []
    for (const p of toProcess) {
      const intent = (p.intent ?? '').trim()
      if (!intent) noIntentRows.push(p)
      else withIntent.push(p)
    }

    for (const p of noIntentRows) {
      report.skippedNoIntent += 1
      report.failed.push({
        paymentId: p.paymentId,
        reason: 'No Stripe PaymentIntent on file for this payment; refund skipped.',
      })
    }

    const byIntent = new Map<string, Payments[]>()
    for (const p of withIntent) {
      const intent = (p.intent ?? '').trim()
      const list = byIntent.get(intent) ?? []
      list.push(p)
      byIntent.set(intent, list)
    }

    for (const [intent, group] of byIntent) {
      try {
        await this.getStripe().refunds.create({
          payment_intent: intent,
        })
        const ids = group.map((row) => row.paymentId)
        await this.paymentsRepo.update({ paymentId: In(ids) }, { status: 'refunded' })
        const first = group[0]
        report.succeeded.push({
          paymentId: first.paymentId,
          intent,
          amount: sumAmountString(group),
          eventName: first.event.eventName,
          paymentRowCount: group.length,
        })
        this.logger.log(
          `Refunded PaymentIntent ${intent} (${group.length} payment row(s)) for club ${clubId}`,
        )
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        this.logger.warn(`Refund failed for PaymentIntent ${intent}: ${reason}`)
        report.failed.push({
          paymentId: group[0]?.paymentId ?? '',
          reason: `[${intent}] ${reason}`,
        })
      }
    }

    return report
  }
}
