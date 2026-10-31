import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * The offline app (2026-10-31): writes `sw.js` beside the built page, listing the files every board
 * keeps from the first visit (src/sw/serviceWorker.js has how it serves them). Left out are the photo
 * tools (the face finder, the iPhone photo reader), which only Add Photos fetches, and the pictures,
 * kept as they are first used.
 */
function offlineApp(): Plugin {
  let outDir = 'dist'
  return {
    name: 'offline-app',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const files: string[] = []
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = path.join(dir, name)
          if (statSync(full).isDirectory()) walk(full)
          else files.push(path.relative(outDir, full).split(path.sep).join('/'))
        }
      }
      walk(outDir)
      const keep = files.filter(
        (f) => f !== 'sw.js' && !/^(avatars|tour|face|move-tab|move-extension)\//.test(f) && !/vision_|heic-to|\.map$/.test(f),
      )
      const hash = createHash('sha256')
      for (const f of keep.sort()) hash.update(f).update(readFileSync(path.join(outDir, f)))
      const template = readFileSync(path.resolve(import.meta.dirname, 'src/sw/serviceWorker.js'), 'utf8')
      writeFileSync(
        path.join(outDir, 'sw.js'),
        template
          .replace("'__VERSION__'", JSON.stringify(hash.digest('hex').slice(0, 12)))
          .replace('__PRECACHE__', JSON.stringify(['./', ...keep])),
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this repo under /seating/ rather than the domain root. Overridable
  // via BASE_PATH so the same build can target a root-hosted deploy or the demo artifact.
  base: process.env.BASE_PATH ?? '/seating/',
  plugins: [react(), tailwindcss(), offlineApp()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
