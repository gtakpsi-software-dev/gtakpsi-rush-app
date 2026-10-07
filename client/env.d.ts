/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BROADCASTER_API_PREFIX: string;
  readonly VITE_SORTING_BROADCASTER_URL?: string;
  readonly VITE_WEBSOCKET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
