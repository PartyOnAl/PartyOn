import { Link, useParams } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { useCatalog } from '@/contexts/CatalogContext'

export default function ClubDetail() {
  const { id } = useParams<{ id: string }>()
  const { clubs, loading } = useCatalog()
  const club = clubs.find((c) => c.id === id)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="po-container max-w-lg py-10">
        <Link
          to="/search"
          className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary"
        >
          ← Back to search
        </Link>
        {loading && !club ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : null}
        {!loading && !club ? (
          <p className="text-muted-foreground">Club not found.</p>
        ) : null}
        {club ? (
          <>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <img
                src={club.imageUrl}
                alt=""
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
            <h1 className="mt-6 text-2xl font-bold">{club.name}</h1>
            <p className="mt-2 text-muted-foreground">
              {[club.city, club.address].filter(Boolean).join(' · ') || 'Venue'}
            </p>
          </>
        ) : null}
      </main>
    </div>
  )
}
