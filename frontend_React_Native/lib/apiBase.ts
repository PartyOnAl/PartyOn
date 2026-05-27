export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, '') ||
  'http://192.168.16.102:3000'
