export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, '') ||
  'http://192.168.1.52:3000'
