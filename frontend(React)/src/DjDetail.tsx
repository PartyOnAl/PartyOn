import { Link, useParams } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'

export default function DjDetail() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="po-container max-w-lg py-10">
        <Link
          to={{ pathname: '/', hash: 'events' }}
          className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary"
        >
          ← Back to events
        </Link>
        <p className="text-4xl" aria-hidden>
          🎧
        </p>
        <h1 className="mt-4 text-2xl font-bold">DJ</h1>
        <p className="mt-2 text-sm text-muted-foreground">ID: {id}</p>
        <p className="mt-4 text-muted-foreground">
          Profile details can load here once your DJ catalog is connected.
        </p>
      </main>
    </div>
  )
}
