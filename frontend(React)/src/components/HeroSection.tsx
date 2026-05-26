import { motion } from 'framer-motion'
import { Search, MapPin, Music } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

type HeroSectionProps = {
  onBrowseClubs?: () => void
}

export function HeroSection({ onBrowseClubs }: HeroSectionProps) {
  return (
    <section className="relative m-0 flex items-center justify-center overflow-hidden h-[100vh] h-[100svh] min-h-[600px] pt-16">
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover object-center blur-[1.2px] scale-[1.02] opacity-80"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/videos/hero-bg.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 z-[1] pointer-events-none">
        <div className="absolute inset-0 bg-black/35 animate-[hero-overlay-breathe_6s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.08)_20%,rgba(0,0,0,0.06)_50%,rgba(0,0,0,0.76)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_38%,rgba(0,0,0,0.5)_100%)]" />
      </div>

      <div className="relative z-[2] w-full max-w-[900px] mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto space-y-4 sm:space-y-6 md:space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs sm:text-sm text-primary">
            <Music className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Your Nightlife, Simplified
          </div>

          <h1 className="font-display text-[1.9rem] sm:text-[2.5rem] md:text-[3rem] lg:text-6xl font-bold leading-[0.95] tracking-tight">
            Discover the
            <br />
            <span className="gradient-text">Night</span>
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed px-2">
            Find the best clubs, reserve tables, and book tickets for the hottest
            events across Albania. Your night starts here.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              className="gradient-primary text-primary-foreground px-8 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow w-[85%] sm:w-auto"
              asChild
            >
              <Link to="/events">
                <Search className="h-4 w-4 mr-2" />
                Explore Events
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-border/50 text-foreground hover:bg-secondary px-8 w-[85%] sm:w-auto"
              onClick={onBrowseClubs}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Browse Clubs
            </Button>
          </div>

          <div className="flex items-center justify-center gap-4 sm:gap-8 pt-2 sm:pt-4 text-xs md:text-sm text-muted-foreground">
            <div>
              <span className="text-foreground font-semibold">50+</span> Clubs
            </div>
            <div className="w-px h-4 bg-border" />
            <div>
              <span className="text-foreground font-semibold">200+</span> Events
            </div>
            <div className="w-px h-4 bg-border" />
            <div>
              <span className="text-foreground font-semibold">10K+</span> Users
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
