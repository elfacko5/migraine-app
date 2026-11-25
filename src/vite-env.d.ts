/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_VIEWPORT_PROBE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Commit count at build time (vite.config.ts), or null without git. */
declare const __APP_BUILD__: string | null;
