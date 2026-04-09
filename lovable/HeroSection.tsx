import { motion } from "framer-motion";
import { Search, MapPin, Music } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  onExplore: () => void;
}

export function HeroSection({ onExplore }: HeroSectionProps) {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent/10 blur-[120px] animate-pulse-glow" style={{ animationDelay: "1s" }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_70%)]" />
      </div>

      <div className="container relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary">
            <Music className="h-3.5 w-3.5" />
            Your Nightlife, Simplified
          </div>

          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[0.95] tracking-tight">
            Discover the
            <br />
            <span className="gradient-text">Night</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Find the best clubs, reserve tables, and book tickets for the hottest events across Albania. Your night starts here.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              className="gradient-primary text-primary-foreground px-8 font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
              onClick={onExplore}
            >
              <Search className="h-4 w-4 mr-2" />
              Explore Events
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-border/50 text-foreground hover:bg-secondary px-8"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Browse Clubs
            </Button>
          </div>

          <div className="flex items-center justify-center gap-8 pt-4 text-sm text-muted-foreground">
            <div><span className="text-foreground font-semibold">50+</span> Clubs</div>
            <div className="w-px h-4 bg-border" />
            <div><span className="text-foreground font-semibold">200+</span> Events</div>
            <div className="w-px h-4 bg-border" />
            <div><span className="text-foreground font-semibold">10K+</span> Users</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
