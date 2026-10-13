import type { CreateModule, NeedleModule } from '../../src/runtime/emscripten.ts';

declare const createNeedle: CreateModule<NeedleModule>;
export = createNeedle;
