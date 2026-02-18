import { defineConfig, type UserConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

/**
 * Vite build config for Chrome Extension (Manifest V3).
 *
 * Chrome extensions have a quirk: content scripts cannot use ES module
 * imports (they run in an isolated world), but the service worker CAN
 * (when manifest declares "type": "module"). We solve this by building
 * each entry as a self-contained IIFE — no shared chunks.
 *
 * The build uses three separate Rollup inputs but forces all shared code
 * to be duplicated into each entry via inlineDynamicImports.
 */

const sharedDefine = {
  __REGISTRY_API_BASE__: JSON.stringify(
    process.env.VITE_REGISTRY_API_BASE ?? 'https://registry.arcede.com/v1'
  ),
};

/**
 * We build each entry point separately to avoid code splitting.
 * Content scripts cannot import chunks — they must be fully self-contained.
 */
function createEntryConfig(
  name: string,
  entryPath: string,
  format: 'iife' | 'es' = 'iife',
): UserConfig['build'] {
  return {
    outDir: 'dist',
    emptyOutDir: false, // Don't wipe between entry builds
    rollupOptions: {
      input: { [name]: resolve(__dirname, entryPath) },
      output: {
        entryFileNames: '[name].js',
        format,
        inlineDynamicImports: true,
      },
    },
    target: 'esnext',
    minify: false,
    sourcemap: true,
  };
}

// Default config builds all three entries sequentially via a plugin
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es',
        inlineDynamicImports: true,
      },
    },
    target: 'esnext',
    minify: false,
    sourcemap: true,
  },
  define: sharedDefine,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    {
      name: 'build-content-and-popup',
      async closeBundle() {
        const { build } = await import('vite');

        // Build content script (IIFE — no module imports allowed)
        await build({
          configFile: false,
          build: createEntryConfig('content/index', 'src/content/index.ts', 'iife'),
          define: sharedDefine,
          resolve: { alias: { '@': resolve(__dirname, 'src') } },
        });

        // Build popup script (IIFE — loaded via <script> tag, not module)
        await build({
          configFile: false,
          build: createEntryConfig('popup/popup', 'src/popup/popup.ts', 'iife'),
          define: sharedDefine,
          resolve: { alias: { '@': resolve(__dirname, 'src') } },
        });

        // Copy static assets
        const dist = resolve(__dirname, 'dist');

        // Copy manifest.json
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(dist, 'manifest.json'),
        );

        // Copy popup.html
        mkdirSync(resolve(dist, 'popup'), { recursive: true });
        copyFileSync(
          resolve(__dirname, 'src/popup/popup.html'),
          resolve(dist, 'popup/popup.html'),
        );

        // Copy icons
        const iconsDir = resolve(__dirname, 'icons');
        if (existsSync(iconsDir)) {
          const distIcons = resolve(dist, 'icons');
          mkdirSync(distIcons, { recursive: true });
          for (const file of readdirSync(iconsDir)) {
            if (file.endsWith('.png') || file.endsWith('.svg')) {
              copyFileSync(resolve(iconsDir, file), resolve(distIcons, file));
            }
          }
        }

        console.log('✓ Built all entry points + copied assets to dist/');
      },
    },
  ],
});
