/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `static` のときは楽天連携なしの静的版としてビルドする（納品物の `app-static/`）。 */
  readonly VITE_DEPLOY_MODE?: 'static' | 'worker' | 'desktop';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
