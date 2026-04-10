import type { Club, Event } from '@/types'

export const mockEvents: Event[] = [
  {
    id: '1',
    title: 'SUMMER BASH',
    currency: '€',
    price: 20,
    date: 'Sat, Jul 12 · 22:00',
    city: 'Tirana',
    musicType: 'House',
    club: 'Folie Terrace',
    imageUrl:
      'https://images.unsplash.com/photo-1574391884720-bbc3740c59d8?w=600&q=80',
  },
  {
    id: '2',
    title: 'NEON NIGHT',
    currency: '€',
    price: 25,
    date: 'Fri, Jul 18 · 23:00',
    city: 'Durres',
    musicType: 'Techno',
    club: 'Dua Club',
    imageUrl:
      'https://images.unsplash.com/photo-1566737236500-c8ac43014a8b?w=600&q=80',
  },
  {
    id: '3',
    title: 'BLACKOUT FEST',
    currency: '€',
    price: 30,
    date: 'Sat, Jul 26 · 21:00',
    city: 'Tirana',
    musicType: 'EDM',
    club: 'Radio Bar',
    imageUrl:
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80',
  },
  {
    id: '4',
    title: 'RETRO WAVE',
    currency: '€',
    price: 18,
    date: 'Thu, Aug 1 · 22:30',
    city: 'Vlore',
    musicType: 'Retro',
    club: 'Blok Tirana',
    imageUrl:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
  },
  {
    id: '5',
    title: 'VIP ROOFTOP',
    currency: '€',
    price: 45,
    date: 'Sat, Aug 9 · 20:00',
    city: 'Sarande',
    musicType: 'Afro House',
    club: 'Sky Lounge',
    imageUrl:
      'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=600&q=80',
  },
  {
    id: '6',
    title: 'UNDERGROUND',
    currency: '€',
    price: 15,
    date: 'Fri, Aug 15 · 00:00',
    city: 'Tirana',
    musicType: 'Tech House',
    club: 'Vault Club',
    imageUrl:
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80',
  },
]

export const mockClubs: Club[] = [
  {
    id: '1',
    name: 'Folie Terrace',
    city: 'Tirana',
    address: 'Rr. Ibrahim Rugova, Tirana',
    lat: 41.3276,
    lng: 19.8187,
    imageUrl:
      'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef8?w=1200&q=80',
  },
  {
    id: '2',
    name: 'Dua Club',
    city: 'Durres',
    address: 'Sheshi Liria, Durres',
    lat: 41.3231,
    lng: 19.4414,
    imageUrl:
      'https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=1200&q=80',
  },
  {
    id: '3',
    name: 'Radio Bar',
    city: 'Tirana',
    address: 'Blloku Area, Tirana',
    lat: 41.3198,
    lng: 19.8172,
    imageUrl:
      'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200&q=80',
  },
  {
    id: '4',
    name: 'Blok Tirana',
    city: 'Vlore',
    address: 'Lungomare, Vlore',
    lat: 40.4508,
    lng: 19.4892,
    imageUrl:
      'https://images.unsplash.com/photo-1545128485-c400e7702796?w=1200&q=80',
  },
  {
    id: '5',
    name: 'Sky Lounge',
    city: 'Sarande',
    address: 'Rruga Butrinti, Sarande',
    lat: 39.8756,
    lng: 20.0054,
    imageUrl:
      'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80',
  },
]
