// Extend Window with vendor-prefixed Web Audio API for browser compatibility
interface Window {
  webkitAudioContext?: typeof AudioContext;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
