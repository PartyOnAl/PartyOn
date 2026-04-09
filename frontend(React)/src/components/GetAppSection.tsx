import { motion } from 'framer-motion'
import { Download, Sparkles, Search, Bell, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'

const APP_MOCKUP =
  'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=520&q=80'

const features = [
  { icon: Search, label: 'Book Tickets Instantly', side: 'left' as const },
  { icon: MapPin, label: 'Reserve VIP Tables', side: 'left' as const },
  { icon: Search, label: 'Discover Top Clubs', side: 'right' as const },
  { icon: Bell, label: 'Get Event Alerts', side: 'right' as const },
]

export function GetAppSection() {
  const navigate = useNavigate()
  const leftFeatures = features.filter((f) => f.side === 'left')
  const rightFeatures = features.filter((f) => f.side === 'right')

  return (
    <section className="py-24 border-t border-border/30 overflow-hidden">
      <div className="po-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-4 mb-16"
        >
          <div className="inline-flex items-center gap-2 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            get the app
          </div>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold">
            Your Night Starts Here
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Find events, book tickets, and reserve tables in seconds
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" className="rounded-full px-6 border-border/50">
              <Download className="h-4 w-4 mr-2" />
              Download App
            </Button>
            <Button
              className="rounded-full px-6 gradient-primary text-primary-foreground"
              onClick={() => navigate('/search')}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Explore Events
            </Button>
          </div>
        </motion.div>

        <div className="relative flex items-center justify-center min-h-[500px]">
          <div className="hidden md:flex flex-col gap-6 absolute left-[10%] lg:left-[15%]">
            {leftFeatures.map((feat, i) => {
              const Icon = feat.icon
              return (
                <motion.div
                  key={feat.label}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="flex items-center gap-3 px-5 py-4 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary/80 border border-border/30 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">
                    {feat.label}
                  </span>
                </motion.div>
              )
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative z-10 flex justify-center px-2"
          >
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[min(420px,55vw)] w-[min(420px,85vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[90px]"
              aria-hidden
            />

            <div className="relative w-[min(100%,238px)] md:w-[272px]">
              <div
                className="absolute -left-[3px] top-[20%] z-0 h-9 w-[3px] rounded-l-md bg-gradient-to-b from-zinc-500 to-zinc-700"
                aria-hidden
              />
              <div
                className="absolute -left-[3px] top-[30%] z-0 h-14 w-[3px] rounded-l-md bg-gradient-to-b from-zinc-500 to-zinc-700"
                aria-hidden
              />
              <div
                className="absolute -right-[3px] top-[24%] z-0 h-16 w-[3px] rounded-r-md bg-gradient-to-b from-zinc-500 to-zinc-700"
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
            </div>
          </motion.div>

          <div className="hidden md:flex flex-col gap-6 absolute right-[10%] lg:right-[15%]">
            {rightFeatures.map((feat, i) => {
              const Icon = feat.icon
              return (
                <motion.div
                  key={feat.label}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="flex items-center gap-3 px-5 py-4 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary/80 border border-border/30 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">
                    {feat.label}
                  </span>
                </motion.div>
              )
            })}
          </div>

          <div className="flex md:hidden flex-wrap justify-center gap-3 absolute bottom-0 translate-y-full pt-8">
            {features.map((feat) => {
              const Icon = feat.icon
              return (
                <div
                  key={feat.label}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border/40 bg-card/60 text-sm"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{feat.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
