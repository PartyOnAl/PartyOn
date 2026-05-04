import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import loginStyles from './LoginPage.module.css'
import { cn } from '@/lib/utils'

/** Apple-hosted marketing badge — official “Download on the App Store” artwork. */
const APP_STORE_BADGE_URL =
  'https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83'

/** Google-hosted “Get it on Google Play” badge (English). */
const GOOGLE_PLAY_BADGE_URL =
  'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png'

function StoreBadgeLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-block shrink-0 rounded-lg outline-none ring-offset-2 ring-offset-[#06060a] transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/60',
        className,
      )}
    >
      {children}
    </a>
  )
}

export default function StaffMobileOnlyPage() {
  return (
    <div className="relative flex min-h-[100svh] w-full flex-col overflow-hidden bg-[#06060a] text-foreground">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_38%,hsl(330_81%_60%/0.08),transparent_58%),radial-gradient(ellipse_55%_45%_at_50%_42%,hsl(280_65%_55%/0.07),transparent_52%)]"
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div
          className={cn(
            'w-full max-w-[440px] rounded-[18px] border border-white/10 bg-white/[0.04] px-8 py-10 shadow-[0_0_40px_-12px_hsl(330_81%_60%/0.2),0_20px_50px_-20px_rgba(0,0,0,0.65)] backdrop-blur-[12px] sm:px-10 sm:py-11',
          )}
        >
          <div className="mb-8 flex justify-center text-center">
            <div className={loginStyles.logo} style={{ marginBottom: 0 }}>
              Party<span className={loginStyles.logoAccent}>On</span>
            </div>
          </div>

          <div className="text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm font-medium text-primary shadow-[0_0_28px_-6px_hsl(330_81%_60%/0.45)]">
              Mobile app
            </div>

            <h1 className="font-display text-[clamp(1.65rem,4.5vw,2.25rem)] font-extrabold leading-[1.15] tracking-tight text-white">
              This account is <span className="gradient-text">mobile only</span>
            </h1>

            <p className="mx-auto mt-4 max-w-[36ch] text-[0.95rem] leading-relaxed text-muted-foreground md:text-base">
              Hostess and Security accounts can only be accessed via the PartyOn mobile app.
            </p>
          </div>

          <div className="mx-auto mt-9 flex max-w-sm flex-col items-stretch justify-center gap-4 sm:max-w-none sm:flex-row sm:items-start sm:justify-center sm:gap-5">
            <StoreBadgeLink href="https://apps.apple.com/" className="flex justify-center sm:justify-end">
              <img
                src={APP_STORE_BADGE_URL}
                alt="Download on the App Store"
                width={250}
                height={83}
                decoding="async"
                className="h-[44px] w-auto sm:h-[52px]"
              />
            </StoreBadgeLink>
            <StoreBadgeLink href="https://play.google.com/store/apps" className="flex justify-center sm:justify-start">
              <img
                src={GOOGLE_PLAY_BADGE_URL}
                alt="Get it on Google Play"
                width={646}
                height={250}
                decoding="async"
                className="h-[60px] w-auto sm:h-[68px]"
              />
            </StoreBadgeLink>
          </div>

          <div className="mt-10 flex justify-center border-t border-white/[0.06] pt-8">
            <Link
              to="/login"
              replace
              className="text-sm font-medium text-white/50 transition-colors hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060a]"
            >
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
