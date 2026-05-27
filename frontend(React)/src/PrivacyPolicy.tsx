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

export default function PrivacyPolicy() {
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
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-white/40">Last updated: May 2026</p>
        </div>

        <div className="space-y-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">

          <Section title="1. Who We Are">
            <p>
              PartyOn is operated by PartyOn SPM, based in Tirana, Albania. We provide a platform
              for discovering nightlife events, purchasing tickets, and reserving tables at clubs
              across Albania.
            </p>
            <p>
              For questions about this Privacy Policy or how we handle your data, contact us at{' '}
              <a href="mailto:partyonspm@gmail.com" className="text-primary hover:underline">
                partyonspm@gmail.com
              </a>.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>We collect the following categories of personal data:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-white">Account information:</strong> name, email address,
                date of birth, and profile picture when you register.
              </li>
              <li>
                <strong className="text-white">Payment information:</strong> billing details
                processed securely by Stripe. We do not store card numbers on our servers.
              </li>
              <li>
                <strong className="text-white">Transaction data:</strong> ticket purchases,
                table reservations, and order history.
              </li>
              <li>
                <strong className="text-white">Usage data:</strong> pages visited, search queries,
                and interactions with the platform (collected via server logs and analytics).
              </li>
              <li>
                <strong className="text-white">Device and technical data:</strong> IP address,
                browser type, operating system, and referral URLs.
              </li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use your personal data to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Create and manage your account</li>
              <li>Process ticket purchases and table reservations</li>
              <li>Send booking confirmations, receipts, and event reminders</li>
              <li>Improve and personalise the platform experience</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations under Albanian law</li>
              <li>
                Send promotional emails and newsletters — only with your explicit consent, which
                you may withdraw at any time
              </li>
            </ul>
          </Section>

          <Section title="4. Legal Basis for Processing">
            <p>We process your personal data on the following legal grounds:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-white">Contract performance:</strong> to fulfil your
                bookings and purchases.
              </li>
              <li>
                <strong className="text-white">Legitimate interests:</strong> to operate and
                improve the platform, and to prevent fraud.
              </li>
              <li>
                <strong className="text-white">Consent:</strong> for marketing communications
                and non-essential cookies.
              </li>
              <li>
                <strong className="text-white">Legal obligation:</strong> where required by
                Albanian law.
              </li>
            </ul>
          </Section>

          <Section title="5. Sharing Your Information">
            <p>
              We do not sell your personal data. We share it only with trusted third parties
              who help us operate the platform:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-white">Stripe</strong> — payment processing. Your card
                data is handled directly by Stripe under their own privacy policy.
              </li>
              <li>
                <strong className="text-white">Supabase</strong> — database and file storage
                infrastructure, hosted within secure cloud environments.
              </li>
              <li>
                <strong className="text-white">Event organisers and venues</strong> — limited
                data (name, booking reference) shared to fulfil your reservation or ticket.
              </li>
            </ul>
            <p>
              We may also disclose data if required by law, court order, or to protect the
              rights and safety of PartyOn, our users, or the public.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your personal data for as long as your account is active or as needed to
              provide services. Transaction records are kept for a minimum of 5 years to comply
              with Albanian tax and accounting regulations.
            </p>
            <p>
              If you delete your account, we will remove or anonymise your personal data within
              30 days, except where retention is required by law.
            </p>
          </Section>

          <Section title="7. Cookies">
            <p>
              We use essential cookies to keep you logged in and remember your preferences.
              We may also use analytics cookies to understand how the platform is used.
              Non-essential cookies are only set with your consent.
            </p>
            <p>
              You can control cookies through your browser settings. Disabling essential cookies
              may affect your ability to use certain features of the platform.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>
              Under applicable data protection law, you have the right to:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data ("right to be forgotten")</li>
              <li>Object to or restrict certain processing</li>
              <li>Withdraw consent at any time (for consent-based processing)</li>
              <li>Lodge a complaint with the relevant supervisory authority in Albania</li>
            </ul>
            <p>
              To exercise any of these rights, email us at{' '}
              <a href="mailto:partyonspm@gmail.com" className="text-primary hover:underline">
                partyonspm@gmail.com
              </a>. We will respond within 30 days.
            </p>
          </Section>

          <Section title="9. Data Security">
            <p>
              We implement appropriate technical and organisational measures to protect your
              personal data against unauthorised access, loss, or disclosure. These include
              encrypted connections (HTTPS), access controls, and secure cloud infrastructure
              provided by Supabase.
            </p>
            <p>
              No system is completely secure. If you believe your account has been compromised,
              contact us immediately at{' '}
              <a href="mailto:partyonspm@gmail.com" className="text-primary hover:underline">
                partyonspm@gmail.com
              </a>.
            </p>
          </Section>

          <Section title="10. Children's Privacy">
            <p>
              PartyOn is not intended for users under the age of 18. We do not knowingly collect
              personal data from minors. If we become aware that a minor has registered, we will
              promptly delete their account and associated data.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise
              the "Last updated" date at the top of this page. We encourage you to review this
              page periodically. Continued use of the platform after changes are posted
              constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>
              For any privacy-related questions or requests, contact us at:
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
