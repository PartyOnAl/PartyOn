import { motion } from "framer-motion";
import { Download, Sparkles, Search, Bell, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import appMockup from "@/assets/app-mockup.jpg";

const features = [
  { icon: Search, label: "Book Tickets Instantly", side: "left" as const },
  { icon: MapPin, label: "Reserve VIP Tables", side: "left" as const },
  { icon: Search, label: "Discover Top Clubs", side: "right" as const },
  { icon: Bell, label: "Get Event Alerts", side: "right" as const },
];

export function GetAppSection() {
  const leftFeatures = features.filter((f) => f.side === "left");
  const rightFeatures = features.filter((f) => f.side === "right");

  return (
    <section className="py-24 border-t border-border/30 overflow-hidden">
      <div className="container">
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
            <Button className="rounded-full px-6 gradient-primary text-primary-foreground">
              <Sparkles className="h-4 w-4 mr-2" />
              Explore Events
            </Button>
          </div>
        </motion.div>

        {/* Phone mockup with feature cards */}
        <div className="relative flex items-center justify-center min-h-[500px]">
          {/* Left features */}
          <div className="hidden md:flex flex-col gap-6 absolute left-[10%] lg:left-[15%]">
            {leftFeatures.map((feat, i) => {
              const Icon = feat.icon;
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
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">{feat.label}</span>
                </motion.div>
              );
            })}
          </div>

          {/* Phone */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative z-10"
          >
            <div className="w-[220px] md:w-[260px] rounded-[2.5rem] overflow-hidden border-2 border-border/30 shadow-2xl shadow-primary/10">
              <img
                src={appMockup}
                alt="PartyOn app"
                loading="lazy"
                width={260}
                height={520}
                className="w-full h-auto"
              />
            </div>
            {/* Glow behind phone */}
            <div className="absolute inset-0 -z-10 blur-[80px] bg-primary/15 rounded-full scale-150" />
          </motion.div>

          {/* Right features */}
          <div className="hidden md:flex flex-col gap-6 absolute right-[10%] lg:right-[15%]">
            {rightFeatures.map((feat, i) => {
              const Icon = feat.icon;
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
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">{feat.label}</span>
                </motion.div>
              );
            })}
          </div>

          {/* Mobile feature list */}
          <div className="flex md:hidden flex-wrap justify-center gap-3 absolute bottom-0 translate-y-full pt-8">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.label} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border/40 bg-card/60 text-sm">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{feat.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
