import { useState } from "react";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

export function SearchHero() {
  const [focused, setFocused] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <section className="py-10">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative max-w-2xl mx-auto"
        >
          {/* Glow effect behind */}
          <div
            className={`absolute -inset-1 rounded-2xl transition-all duration-500 ${
              focused
                ? "bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 blur-xl opacity-100"
                : "bg-primary/10 blur-lg opacity-0"
            }`}
          />

          <div
            className={`relative flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all duration-300 ${
              focused
                ? "bg-secondary/80 border-primary/40 shadow-[0_0_30px_hsl(var(--primary)/0.15)]"
                : "bg-secondary/60 border-border/40 hover:border-border/60"
            }`}
          >
            <Search className={`h-5 w-5 shrink-0 transition-colors duration-300 ${focused ? "text-primary" : "text-muted-foreground"}`} />
            <input
              type="text"
              placeholder="Search events, clubs, DJs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="w-full bg-transparent text-foreground text-base placeholder:text-muted-foreground/60 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md bg-muted/50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
