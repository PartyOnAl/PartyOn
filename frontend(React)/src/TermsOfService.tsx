import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-white/65">{children}</div>
    </section>
  )
}

export default function TermsOfService() {
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
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-white/40">Last updated: May 2026</p>
        </div>

        <div className="space-y-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using the PartyOn platform — including our website, mobile application,
              and any related services (collectively, the "Service") — you agree to be bound by these
              Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
            <p>
              PartyOn is operated by PartyOn SPM. These terms apply to all visitors, users, and
              others who access the Service.
            </p>
          </Section>

          <Section title="2. Account Registration">
            <p>
              To access certain features, you must create an account. You agree to provide accurate,
              complete, and current information and to keep it up to date. You are responsible for
              maintaining the confidentiality of your account credentials and for all activity that
              occurs under your account.
            </p>
            <p>
              You must be at least 18 years old to create an account or purchase tickets on PartyOn,
              in compliance with Albanian law governing access to nightlife venues.
            </p>
            <p>
              PartyOn reserves the right to suspend or terminate accounts that violate these Terms,
              engage in fraudulent activity, or misuse the platform.
            </p>
          </Section>

          <Section title="3. Tickets and Purchases">
            <p>
              All ticket purchases made through PartyOn are subject to availability and are final
              unless otherwise stated. Prices displayed include any applicable fees. PartyOn acts as
              an intermediary between event organisers and ticket buyers; the event organiser is
              solely responsible for the event.
            </p>
            <p>
              Payments are processed securely through Stripe. By completing a purchase, you authorise
              PartyOn to charge the applicable amount to your selected payment method.
            </p>
            <p>
              Tickets are personal and non-transferable unless explicitly permitted by the event
              organiser. Resale of tickets at a price above face value is prohibited.
            </p>
          </Section>

          <Section title="4. Table Reservations">
            <p>
              Table reservations are made directly with the venue through PartyOn. A reservation
              constitutes an agreement between you and the venue — PartyOn facilitates the booking
              but does not guarantee availability or specific seating arrangements.
            </p>
            <p>
              Minimum spend requirements, if stated, are enforced by the venue. Failure to meet
              the minimum spend may result in reallocation of your table.
            </p>
          </Section>

          <Section title="5. Cancellation and Refund Policy">
            <p>
              <strong className="text-white">Tickets:</strong> Refunds are only available if the
              event is cancelled or significantly changed by the organiser. Once purchased, tickets
              are non-refundable unless required by applicable Albanian consumer protection law.
            </p>
            <p>
              <strong className="text-white">Reservations:</strong> Table reservations may be
              cancelled free of charge up to 24 hours before the reservation time. Cancellations
              made within 24 hours may be subject to a no-show fee at the venue's discretion.
            </p>
            <p>
              To request a cancellation or dispute a charge, contact us at{' '}
              <a href="mailto:partyonspm@gmail.com" className="text-primary hover:underline">
                partyonspm@gmail.com
              </a>.
            </p>
          </Section>

          <Section title="6. Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Use the Service for any unlawful purpose or in violation of applicable laws</li>
              <li>Submit false, misleading, or fraudulent information</li>
              <li>Attempt to access another user's account without authorisation</li>
              <li>Scrape, crawl, or otherwise extract data from the platform without prior written consent</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Use the platform to distribute spam or unsolicited communications</li>
            </ul>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              All content on the PartyOn platform — including logos, design, text, graphics, and
              software — is the exclusive property of PartyOn SPM or its licensors and is protected
              by applicable intellectual property laws. You may not reproduce, distribute, or create
              derivative works without our written permission.
            </p>
            <p>
              By uploading content (such as profile pictures), you grant PartyOn a non-exclusive,
              royalty-free licence to use that content solely for the purpose of operating the Service.
            </p>
          </Section>

          <Section title="8. Third-Party Services">
            <p>
              The Service integrates with third-party providers including Stripe (payment processing)
              and Supabase (infrastructure). Your use of those services is governed by their
              respective terms and privacy policies. PartyOn is not responsible for the practices
              of third-party services.
            </p>
          </Section>

          <Section title="9. Disclaimers and Limitation of Liability">
            <p>
              The Service is provided "as is" without warranties of any kind, express or implied.
              PartyOn does not guarantee that the Service will be error-free or uninterrupted.
            </p>
            <p>
              PartyOn is not liable for any damages arising from your use of the Service, including
              but not limited to lost profits, data loss, or damages resulting from events outside
              our reasonable control (including event cancellations by third-party organisers).
            </p>
            <p>
              In no event shall PartyOn's total liability to you exceed the amount you paid for the
              specific transaction giving rise to the claim.
            </p>
          </Section>

          <Section title="10. Governing Law">
            <p>
              These Terms are governed by and construed in accordance with the laws of the Republic
              of Albania. Any disputes shall be subject to the exclusive jurisdiction of the courts
              of Tirana, Albania.
            </p>
          </Section>

          <Section title="11. Changes to These Terms">
            <p>
              We may update these Terms from time to time. When we do, we will revise the "Last
              updated" date at the top of this page. Continued use of the Service after changes
              are posted constitutes your acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>
              For questions about these Terms, contact us at:
            </p>
            <p>
              <a
                href="mailto:partyonspm@gmail.com"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                partyonspm@gmail.com
              </a>
            </p>
          </Section>

        </div>
      </main>
      <LovableFooter />
    </div>
  )
}
