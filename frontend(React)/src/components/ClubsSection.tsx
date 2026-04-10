import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClubCoverImage } from '@/components/ClubCoverImage'
import { useCatalog } from '@/contexts/CatalogContext'

export function ClubsSection() {
  const { clubs: allClubs, loading } = useCatalog()
  const clubs = allClubs.slice(0, 5)

  return (
    <section id="clubs" className="py-16 border-t border-border/30">
      <div className="po-container space-y-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-3xl md:text-4xl font-bold"
        >
          Hot Venues
        </motion.h2>

        {loading && clubs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading venues…</p>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-[200px] md:auto-rows-[240px]">
          {clubs[0] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="col-span-1 md:col-span-2 row-span-2"
            >
              <Link
                to="/nearby-clubs"
                className="group block h-full relative rounded-xl overflow-hidden"
              >
                <ClubCoverImage
                  src={clubs[0].imageUrl}
                  alt={clubs[0].name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <span className="absolute top-4 left-4 font-display font-bold text-sm uppercase tracking-widest text-white drop-shadow-lg">
                  {clubs[0].name}
                </span>
              </Link>
            </motion.div>
          )}

          {clubs[1] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="col-span-1 md:col-span-2 row-span-1"
            >
              <Link
                to="/nearby-clubs"
                className="group block h-full relative rounded-xl overflow-hidden"
              >
                <ClubCoverImage
                  src={clubs[1].imageUrl}
                  alt={clubs[1].name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <span className="absolute top-4 left-4 font-display font-bold text-sm uppercase tracking-widest text-white drop-shadow-lg">
                  {clubs[1].name}
                </span>
              </Link>
            </motion.div>
          )}

          {clubs[2] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="col-span-1 row-span-1"
            >
              <Link
                to="/nearby-clubs"
                className="group block h-full relative rounded-xl overflow-hidden"
              >
                <ClubCoverImage
                  src={clubs[2].imageUrl}
                  alt={clubs[2].name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <span className="absolute top-4 left-4 font-display font-bold text-sm uppercase tracking-widest text-white drop-shadow-lg">
                  {clubs[2].name}
                </span>
              </Link>
            </motion.div>
          )}

          {clubs[3] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="col-span-1 row-span-1"
            >
              <Link
                to="/nearby-clubs"
                className="group block h-full relative rounded-xl overflow-hidden"
              >
                <ClubCoverImage
                  src={clubs[3].imageUrl}
                  alt={clubs[3].name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <span className="absolute top-4 left-4 font-display font-bold text-sm uppercase tracking-widest text-white drop-shadow-lg">
                  {clubs[3].name}
                </span>
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}
