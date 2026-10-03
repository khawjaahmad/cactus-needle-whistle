/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// How both vendored builds end: a UMD export of their factory.
const UMD_EXPORT =
  'if(typeof exports==="object"&&typeof module==="object"){module.exports=createNeedle;module.exports.default=createNeedle}' +
  'else if(typeof define==="function"&&define["amd"])define([],()=>createNeedle);';

/**
 * The vendored Emscripten builds (vendor/needle3-<rev>/needle.js) are classic scripts that export
 * through `module.exports`. They stay untouched on disk; this hands the browser their factory as
 * an ES module default, the way Node's CommonJS interop hands it to the scripts.
 */
function emscriptenModule(): Plugin {
  return {
    name: 'emscripten-module',
    enforce: 'pre',
    transform(code, id) {
      if (!/\/vendor\/needle3-[^/]+\/needle\.js$/.test(id)) return null;
      if (!code.includes(UMD_EXPORT)) this.error(`${id} no longer ends in the UMD export this plugin replaces.`);
      return { code: code.replace(UMD_EXPORT, 'export default createNeedle;'), map: null };
    },
  };
}

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react(), emscriptenModule()],
  // The engines run in module workers; config.plugins don't reach worker bundles.
  worker: { format: 'es', plugins: () => [emscriptenModule()] },
  build: {
    target: 'es2023',
    rolldownOptions: {
      // Two pages: the studio, and Acme Admin, the app under test it loads in a frame.
      input: { studio: page('index.html'), sandbox: page('sandbox/index.html') },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
});
