import { Link } from "react-router-dom";
import { mockClubs } from "@/data/mockData";
import { motion } from "framer-motion";

import club1 from "@/assets/club-1.jpg";
import club2 from "@/assets/club-2.jpg";
import club3 from "@/assets/club-3.jpg";
import club4 from "@/assets/club-4.jpg";

const clubImages: Record<string, string> = {
  "1": club1,
  "2": club2,
  "3": club3,
  "4": club4,
};

export function ClubsSection() {
  const clubs = mockClubs.slice(0, 5);

  return (
    <section className="py-16 border-t border-border/30">
      <div className="container space-y-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-3xl md:text-4xl font-bold"
        >
          Hot Venues
        </motion.h2>

        {/* Masonry-style grid like the reference */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-[200px] md:auto-rows-[240px]">
          {/* Large card - spans 2 cols, 2 rows */}
          {clubs[0] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="col-span-1 md:col-span-2 row-span-2"
            >
              <Link to={`/club/${clubs[0].id}`} className="group block h-full relative rounded-xl overflow-hidden">
                <img
                  src={clubImages[clubs[0].id] || club1}
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

          {/* Top right - spans 2 cols */}
          {clubs[1] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="col-span-1 md:col-span-2 row-span-1"
            >
              <Link to={`/club/${clubs[1].id}`} className="group block h-full relative rounded-xl overflow-hidden">
                <img
                  src={clubImages[clubs[1].id] || club2}
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

          {/* Bottom row - two smaller cards */}
          {clubs[2] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="col-span-1 row-span-1"
            >
              <Link to={`/club/${clubs[2].id}`} className="group block h-full relative rounded-xl overflow-hidden">
                <img
                  src={clubImages[clubs[2].id] || club3}
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
              <Link to={`/club/${clubs[3].id}`} className="group block h-full relative rounded-xl overflow-hidden">
                <img
                  src={clubImages[clubs[3].id] || club4}
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
  );
}
