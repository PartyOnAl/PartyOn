import { useEffect, useState } from 'react'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export type ClubPhotoRow = {
  id: string
  photo_url: string
  sort_order: number
  is_primary: boolean
}

export type ClubData = {
  club_id: string
  club_name: string
  club_address: string | null
  club_description: string | null
  club_email_id: string | null
  club_phone_number: string | null
  club_image: string | null
  club_status: string | null
  club_photos: ClubPhotoRow[]
}

export function useManagerClub() {
  const { profile } = useAuth()
  const [club, setClub] = useState<ClubData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clubId = profile?.club_id ?? null

  useEffect(() => {
    if (!clubId || !supabase || !isSupabaseConfigured) return

    setLoading(true)
    setError(null)

    Promise.all([
      supabase
        .from('clubs')
        .select('club_id, club_name, club_address, club_description, club_email_id, club_phone_number, club_image, club_status')
        .eq('club_id', clubId)
        .single(),
      supabase
        .from('club_photos')
        .select('id, photo_url, sort_order, is_primary')
        .eq('club_id', clubId)
        .order('sort_order', { ascending: true }),
    ]).then(([clubResult, photosResult]) => {
      if (clubResult.error) {
        setError(clubResult.error.message)
      } else if (clubResult.data) {
        setClub({
          ...(clubResult.data as Omit<ClubData, 'club_photos'>),
          club_photos: (photosResult.data as ClubPhotoRow[] | null) ?? [],
        })
      }
      setLoading(false)
    })
  }, [clubId])

  return { club, loading, error, clubId }
}
