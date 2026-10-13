/** The two engines, one worker each, for the page's lifetime. */
import { createAgent } from '../engine/agent.ts';
import { createWhistle } from '../speech/whistle.ts';

export const agent = createAgent();
export const whistle = createWhistle();
