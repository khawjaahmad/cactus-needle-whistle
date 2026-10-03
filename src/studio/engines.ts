/*
 * The two engines, one worker each, for the page's lifetime. Created on import, outside React, so
 * no re-render or StrictMode double effect can start a second download. They load in parallel:
 * Whistle only transcribes, Needle 3 only decodes, and they are separate builds, so the
 * tool-calling engine the suite is pinned to is untouched by the speech one (speech/core.ts).
 */
import { createAgent } from '../engine/agent.ts';
import { createDictation } from '../speech/dictation.ts';

export const agent = createAgent();
export const dictation = createDictation();
