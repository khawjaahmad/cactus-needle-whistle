import type { CreateModule, WhistleModule } from '../../src/runtime/emscripten.ts';

declare const createNeedle: CreateModule<WhistleModule>;
export = createNeedle;
