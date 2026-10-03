// The build's Emscripten factory. Node loads needle.js as CommonJS; Vite appends a default
// export (vite.config.ts), so both see the factory as the module's default.
import type { CreateModule, NeedleModule } from '../../src/runtime/emscripten.ts';

declare const createNeedle: CreateModule<NeedleModule>;
export = createNeedle;
