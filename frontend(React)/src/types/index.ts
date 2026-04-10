export type Event = {
  id: string
  title: string
  currency: string
  price: number
  date: string
  city: string
  musicType: string
  club: string
  imageUrl: string
}

export type Club = {
  id: string
  name: string
  imageUrl: string
  city?: string
  address?: string
  lat?: number
  lng?: number
}
