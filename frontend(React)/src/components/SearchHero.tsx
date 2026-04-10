import { useState } from 'react'
import { Search } from 'lucide-react'
import { motion } from 'framer-motion'

const FILTERS = [
  'All',
  'Tonight',
  'This Weekend',
  'Free Entry',
  'Live Music',
  'Clubs',
  'Festivals',
] as const

export function SearchHero() {
  const [focused, setFocused] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('All')

  return (
    <section className="py-6">
      <div className="po-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="w-full max-w-[860px] mx-auto rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-6 py-8"
        >
          <div
            className={`relative flex h-12 items-center gap-3 rounded-full border pl-5 pr-2 transition-all duration-300 ${
              focused
                ? 'bg-secondary/80 border-primary/40 shadow-[0_0_20px_hsl(var(--primary)/0.15)]'
                : 'bg-secondary/60 border-border/40 hover:border-border/60'
            }`}
          >
            <Search
              className={`h-5 w-5 shrink-0 transition-colors duration-300 ${focused ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <input
              type="text"
              placeholder="Search events, clubs, DJs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="w-full bg-transparent text-foreground text-base placeholder:text-muted-foreground/60 outline-none"
            />
            <button
              type="button"
              className="h-9 rounded-full gradient-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Search
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-[10px]">
            {FILTERS.map((filter) => {
              const active = activeFilter === filter
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full px-4 py-1.5 text-[0.8rem] transition-colors ${
                    active
                      ? 'gradient-primary text-primary-foreground border border-transparent'
                      : 'bg-white/8 text-foreground border border-white/10 hover:border-primary/35'
                  }`}
                >
                  {filter}
                </button>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
