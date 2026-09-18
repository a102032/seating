// The self-contained demo artifact has no server, so it injects this global to redirect
// every asset path to an inlined data URI. It is absent - and this is all a no-op - in
// the real app.
declare global {
  interface Window {
    __DEMO_ASSET_OVERRIDES__?: Record<string, string>
  }
}

/**
 * Resolves a path under public/ to a URL that works wherever the app is served from.
 * GitHub Pages serves the app under a subpath rather than the domain root, so a bare
 * "/avatars/boy.png" would 404 there; BASE_URL carries whatever prefix the build was
 * configured with.
 */
export function assetUrl(path: string): string {
  const override = typeof window !== 'undefined' ? window.__DEMO_ASSET_OVERRIDES__?.[path] : undefined
  if (override) return override
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}
