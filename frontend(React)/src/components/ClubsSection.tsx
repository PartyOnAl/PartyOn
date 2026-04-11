import { Link } from 'react-router-dom'
import { mockClubs } from '@/data/mockData'
import { motion } from 'framer-motion'

export function ClubsSection({ club }: { club: any[] }) {

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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-[200px] md:auto-rows-[240px]">
          {club.map((club) => (
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
                <img
                  src={club.image}
                  alt={club.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <span className="absolute top-4 left-4 font-display font-bold text-sm uppercase tracking-widest text-white drop-shadow-lg">
                  {club.name}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
