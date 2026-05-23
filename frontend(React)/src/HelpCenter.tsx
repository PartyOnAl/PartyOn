import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Mail, Ticket, CalendarDays, TableProperties, CreditCard, ShieldCheck } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'

interface FaqItem {
  question: string
  answer: React.ReactNode
}

interface FaqCategory {
  icon: React.ElementType
  title: string
  items: FaqItem[]
}

const categories: FaqCategory[] = [
  {
    icon: Ticket,
    title: 'Tickets',
    items: [
      {
        question: 'How do I buy a ticket?',
        answer: (
          <p>
            Find an event on the platform, open its page, and click <strong>Buy Ticket</strong>.
            Select your ticket type and quantity, then complete the secure checkout via Stripe.
            You'll receive a confirmation email with your ticket details.
          </p>
        ),
      },
      {
        question: 'Where do I find my tickets after purchase?',
        answer: (
          <p>
            All your tickets are available under <strong>My Bookings</strong> in the navigation
            menu. Each ticket shows a unique QR code that will be scanned at the venue entrance.
          </p>
        ),
      },
      {
        question: 'Can I get a refund on my ticket?',
        answer: (
          <p>
            Tickets are generally non-refundable. Refunds are only issued if the event is
            cancelled or significantly changed by the organiser. For disputes, contact us at{' '}
            <a href="mailto:partyonspm@gmail.com" className="text-primary hover:underline">
              partyonspm@gmail.com
            </a>.
          </p>
        ),
      },
      {
        question: 'Can I transfer my ticket to someone else?',
        answer: (
          <p>
            Tickets are personal and non-transferable unless the event organiser explicitly
            allows transfers. Reselling tickets above face value is prohibited on our platform.
          </p>
        ),
      },
    ],
  },
  {
    icon: TableProperties,
    title: 'Table Reservations',
    items: [
      {
        question: 'How do I reserve a table?',
        answer: (
          <p>
            Open any club page and click <strong>Reserve a Table</strong>. Choose your preferred
            table type, date, and party size. Submit the reservation — the venue will confirm
            your booking.
          </p>
        ),
      },
      {
        question: 'What is a minimum spend?',
        answer: (
          <p>
            Some table types (VIP, Premium, Lounge, etc.) require a minimum spend on drinks and
            bottle service during your visit. This amount is set by the venue and is shown clearly
            on the table card before you book.
          </p>
        ),
      },
      {
        question: 'Can I cancel a table reservation?',
        answer: (
          <p>
            Yes. Cancellations made more than 24 hours before the reservation time are free.
            Cancellations within 24 hours may incur a no-show fee at the venue's discretion.
            To cancel, go to <strong>My Bookings</strong> or email us.
          </p>
        ),
      },
      {
        question: 'What if my party size changes?',
        answer: (
          <p>
            Contact the venue directly or email us at{' '}
            <a href="mailto:partyonspm@gmail.com" className="text-primary hover:underline">
              partyonspm@gmail.com
            </a>{' '}
            as soon as possible. Venues do their best to accommodate changes, but seating
            adjustments are at their discretion.
          </p>
        ),
      },
    ],
  },
  {
    icon: CreditCard,
    title: 'Payments',
    items: [
      {
        question: 'What payment methods are accepted?',
        answer: (
          <p>
            Payments are processed by Stripe and support all major credit and debit cards
            (Visa, Mastercard, American Express). Apple Pay and Google Pay may also be
            available depending on your device.
          </p>
        ),
      },
      {
        question: 'Is my payment information secure?',
        answer: (
          <p>
            Yes. PartyOn never stores your card details. All payment data is handled directly
            by Stripe, which is PCI-DSS Level 1 certified — the highest level of security
            in the payment industry.
          </p>
        ),
      },
      {
        question: 'Why was my payment declined?',
        answer: (
          <p>
            Payment declines are handled by your bank or card issuer. Common reasons include
            insufficient funds, incorrect card details, or a bank security block. Try a
            different card or contact your bank. If the issue persists, email us.
          </p>
        ),
      },
      {
        question: "I was charged but didn't receive a confirmation. What do I do?",
        answer: (
          <p>
            First check your spam/junk folder for the confirmation email. If you still can't
            find it, email us at{' '}
            <a href="mailto:partyonspm@gmail.com" className="text-primary hover:underline">
              partyonspm@gmail.com
            </a>{' '}
            with your name and approximate purchase time and we'll look into it right away.
          </p>
        ),
      },
    ],
  },
  {
    icon: CalendarDays,
    title: 'Events & Clubs',
    items: [
      {
        question: 'How do I find events near me?',
        answer: (
          <p>
            Use the search bar at the top of any page to search by event name, club, city, or
            music genre. You can also browse the <strong>Events</strong> section or filter by
            date and category on the home page.
          </p>
        ),
      },
      {
        question: 'Can I save events for later?',
        answer: (
          <p>
            Yes — click the bookmark icon on any event card or event page to save it. Access
            your saved events from your profile.
          </p>
        ),
      },
      {
        question: 'How can I list my club or event on PartyOn?',
        answer: (
          <p>
            We partner with venues and promoters across Albania. If you'd like to list your
            club or event, reach out to us at{' '}
            <a href="mailto:partyonspm@gmail.com" className="text-primary hover:underline">
              partyonspm@gmail.com
            </a>{' '}
            and we'll get back to you with partnership details.
          </p>
        ),
      },
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Account & Privacy',
    items: [
      {
        question: 'How do I change my password?',
        answer: (
          <p>
            Go to <strong>Settings</strong> from your profile menu and select the password
            change option. If you've forgotten your password, use the{' '}
            <strong>Forgot Password</strong> link on the login page.
          </p>
        ),
      },
      {
        question: 'How do I delete my account?',
        answer: (
          <p>
            To request account deletion, email us at{' '}
            <a href="mailto:partyonspm@gmail.com" className="text-primary hover:underline">
              partyonspm@gmail.com
            </a>{' '}
            from the email address associated with your account. We will process your request
            within 30 days.
          </p>
        ),
      },
      {
        question: 'How does PartyOn use my personal data?',
        answer: (
          <p>
            We use your data to manage your account, process bookings, and improve the platform.
            We never sell your data to third parties. For full details, read our{' '}
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>.
          </p>
        ),
      },
    ],
  },
]

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="divide-y divide-white/8">
      {items.map((item, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-white/85 hover:text-white transition-colors"
          >
            <span>{item.question}</span>
            {open === i ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
            )}
          </button>
          {open === i && (
            <div className="pb-4 text-sm leading-relaxed text-white/60">
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function HelpCenter() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-24">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Help Center
          </h1>
          <p className="mt-2 text-sm text-white/40">
            Answers to the most common questions about PartyOn.
          </p>
        </div>

        <div className="space-y-6">
          {categories.map((cat) => (
            <div
              key={cat.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                  <cat.icon className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-base font-bold text-white">{cat.title}</h2>
              </div>
              <FaqAccordion items={cat.items} />
            </div>
          ))}
        </div>

        {/* Contact card */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-base font-bold text-white">Still need help?</h3>
          <p className="mt-1 text-sm text-white/55">
            Can't find what you're looking for? Our team is happy to help.
          </p>
          <a
            href="mailto:partyonspm@gmail.com"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
          >
            <Mail className="h-4 w-4" />
            partyonspm@gmail.com
          </a>
        </div>
      </main>
      <LovableFooter />
    </div>
  )
}
