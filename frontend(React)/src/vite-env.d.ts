/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  /** Legacy anon JWT; optional if publishable key is set */
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Supabase dashboard “publishable” key (sb_publishable_…) */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_API_URL: string
  readonly VITE_API_PROXY_TARGET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
