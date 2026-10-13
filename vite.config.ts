/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const UMD_EXPORT =
  'if(typeof exports==="object"&&typeof module==="object"){module.exports=createNeedle;module.exports.default=createNeedle}' +
  'else if(typeof define==="function"&&define["amd"])define([],()=>createNeedle);';

/** Serves the vendored CommonJS Emscripten builds to the browser as ES modules. */
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
  worker: { format: 'es', plugins: () => [emscriptenModule()] },
  build: {
    target: 'es2023',
    rolldownOptions: {
      input: { studio: page('index.html'), sandbox: page('sandbox/index.html') },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
});
