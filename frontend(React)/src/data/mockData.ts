import type { Club, Event, Promotion } from '@/types'

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
    isFeatured: true,
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
    isFeatured: true,
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
    isFeatured: true,
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
    isFeatured: true,
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
    isFeatured: true,
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
    isFeatured: true,
  },
]

export const mockClubs: Club[] = [
  {
    id: '1',
    name: 'Folie Terrace',
    city: 'Tirana',
    address: 'Rr. Ibrahim Rugova, Tirana',
    club_lat: 41.3276,
    club_lng: 19.8187,
    imageUrl:
      'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef8?w=1200&q=80',
  },
  {
    id: '2',
    name: 'Dua Club',
    city: 'Durres',
    address: 'Sheshi Liria, Durres',
    club_lat: 41.3231,
    club_lng: 19.4414,
    imageUrl:
      'https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=1200&q=80',
  },
  {
    id: '3',
    name: 'Radio Bar',
    city: 'Tirana',
    address: 'Blloku Area, Tirana',
    club_lat: 41.3198,
    club_lng: 19.8172,
    imageUrl:
      'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200&q=80',
  },
  {
    id: '4',
    name: 'Blok Tirana',
    city: 'Vlore',
    address: 'Lungomare, Vlore',
    club_lat: 40.4508,
    club_lng: 19.4892,
    imageUrl:
      'https://images.unsplash.com/photo-1545128485-c400e7702796?w=1200&q=80',
  },
  {
    id: '5',
    name: 'Sky Lounge',
    city: 'Sarande',
    address: 'Rruga Butrinti, Sarande',
    club_lat: 39.8756,
    club_lng: 20.0054,
    imageUrl:
      'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80',
  },
]

export const mockPromotions: Promotion[] = [
  {
    id: 'demo-free-entry',
    badge: 'Free Entry',
    badgeColor: 'bg-primary',
    image:
      'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=900&q=80',
    title: 'Free entry before midnight',
    description: 'Claim guest-list access and start the night without the door fee.',
    venue: 'Folie Terrace',
    city: 'Tirana',
    rating: 4.8,
    clubId: '1',
    validUntil: '2026-12-31',
    validFrom: '2026-05-28',
    promoPrice: 0,
    offerType: 'free',
  },
  {
    id: 'demo-vip-table',
    badge: 'VIP',
    badgeColor: 'bg-accent',
    image:
      'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=900&q=80',
    title: 'VIP table upgrade',
    description: 'Reserve a table package with priority entry and premium placement.',
    venue: 'Dua Club',
    city: 'Durres',
    rating: 4.7,
    clubId: '2',
    validUntil: '2026-12-31',
    validFrom: '2026-05-28',
    listPrice: 120,
    promoPrice: 89,
    offerType: 'vip',
  },
  {
    id: 'demo-student-night',
    badge: '30% Off',
    badgeColor: 'bg-primary',
    image:
      'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=900&q=80',
    title: 'Student night special',
    description: 'A limited discount on selected tickets and bottle-service packages.',
    venue: 'Radio Bar',
    city: 'Tirana',
    rating: 4.6,
    clubId: '3',
    validUntil: '2026-12-31',
    validFrom: '2026-05-28',
    listPrice: 35,
    promoPrice: 24.5,
    offerType: 'discount',
  },
]
