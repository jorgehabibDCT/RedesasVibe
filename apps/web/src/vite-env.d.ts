/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Public origin of the BFF (e.g. `https://bff.example.com`).
   * Omit or leave empty in local dev so requests stay same-origin and use the Vite `/api` proxy.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
