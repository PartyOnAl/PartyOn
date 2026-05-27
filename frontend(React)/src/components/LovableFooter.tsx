import { Link } from 'react-router-dom'
import { Instagram, Facebook, Twitter, Youtube, Mail, Send, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PartyOnLogo } from '@/components/PartyOnLogo'
import { useEffect, useRef, useState } from 'react'

type SubscribeStatus = 'success' | 'error' | null

/** Lovable-style footer (renamed to avoid clash with existing `Footer.tsx`) */
export function LovableFooter() {
  const [email, setEmail] = useState('')
  const [subscribeStatus, setSubscribeStatus] = useState<SubscribeStatus>(null)
  const [subscribeMsg, setSubscribeMsg] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showFeedback(status: SubscribeStatus, msg: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSubscribeStatus(status)
    setSubscribeMsg(msg)
    timerRef.current = setTimeout(() => setSubscribeStatus(null), 4000)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  function handleSubscribe() {
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showFeedback('error', 'Please enter a valid email address.')
      return
    }
    showFeedback('success', "You're subscribed! Hottest events coming your way.")
    setEmail('')
  }

  return (
    <footer className="border-t border-border/30 bg-card/30">
      <div className="po-container py-8 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          <div className="space-y-3">
            <Link to="/home" className="inline-flex items-center shrink-0">
              <PartyOnLogo size="sm" showDiscoBall={false} />
            </Link>
            <p className="text-sm text-muted-foreground leading-snug">
              Albania&apos;s premier nightlife platform. Discover clubs, book
              tickets, reserve tables — all in one place. Your night starts here.
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              {[
                { Icon: Instagram, href: 'https://www.instagram.com/partyon.al', label: 'Instagram' },
                { Icon: Facebook, href: 'https://www.facebook.com/partyon.al', label: 'Facebook' },
                { Icon: Twitter, href: 'https://twitter.com/partyonal', label: 'Twitter / X' },
                { Icon: Youtube, href: 'https://www.youtube.com/@partyon', label: 'YouTube' },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-8 h-8 rounded-full bg-secondary/60 border border-border/40 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/10 transition-all"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-display font-semibold text-foreground text-xs uppercase tracking-wider">
              Explore
            </h4>
            <nav className="flex flex-col gap-2">
              {[
                { label: 'Events', to: '/home#events' },
                { label: 'Clubs', to: '/nearby-clubs' },
                { label: 'Promotions', to: '/home#promotions' },
                { label: 'Home', to: '/home' },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="space-y-3">
            <h4 className="font-display font-semibold text-foreground text-xs uppercase tracking-wider">
              Support
            </h4>
            <nav className="flex flex-col gap-2">
              <Link
                to="/help"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Help Center
              </Link>
              <Link
                to="/terms"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                to="/privacy"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Privacy Policy
              </Link>
              <a
                href="mailto:partyonspm@gmail.com"
                className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                partyonspm@gmail.com
              </a>
            </nav>
          </div>

          <div className="space-y-3">
            <h4 className="font-display font-semibold text-foreground text-xs uppercase tracking-wider">
              Stay in the Loop
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Get the hottest events and exclusive promos straight to your inbox.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                className="flex-1 h-9 px-3 rounded-lg bg-secondary/60 border border-border/40 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
              />
              <Button
                size="icon"
                className="h-9 w-9 gradient-primary shrink-0"
                onClick={handleSubscribe}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            {subscribeStatus && (
              <div
                className={`flex items-center gap-1.5 text-xs ${
                  subscribeStatus === 'success' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {subscribeStatus === 'success' ? (
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                )}
                {subscribeMsg}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border/20">
        <div className="po-container py-3 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] sm:text-xs text-muted-foreground">
          <p>© 2026 PartyOn. Albania&apos;s nightlife, simplified.</p>
          <p>Made with 💜 in Tirana</p>
        </div>
      </div>
    </footer>
  )
}
