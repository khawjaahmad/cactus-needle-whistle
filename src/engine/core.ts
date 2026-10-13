/** Needle 3: the engine binding and the call gate. */
import type { NeedleModule } from '../runtime/emscripten.ts';
import { createHeap } from '../runtime/wasm-heap.ts';
import type { NeedleResponse, ToolEntry, ToolSchema, Turn, Verdict } from './types.ts';

const RESPONSE_CAPACITY = 1 << 18;
const MAX_NEW_TOKENS = 512;

const AUTO_THRESHOLD = 0.5;
const HIGH_RISK_THRESHOLD = 0.9;

export type Engine = ReturnType<typeof createEngine>;

/** Wraps an instantiated Emscripten module around one loaded archive. */
export function createEngine(M: NeedleModule, cact: Uint8Array) {
  const heap = createHeap(M);

  const loaded = heap.withBytes(cact, (ptr, length) => M._needle_load(ptr, BigInt(length)));
  if (loaded !== 0) throw new Error(`The engine rejected needle3.cact (code ${loaded}).`);

  const out = M._malloc(RESPONSE_CAPACITY);
  let boundKey: string | null = null;

  /** Binds a system turn and toolset; returns true when it re-initialised (a fresh conversation). */
  function bind(system: string, toolsJson: string) {
    const key = `${system}\n${toolsJson}`;
    if (boundKey === key) return false;
    M._needle_reset();
    boundKey = null;
    const prefix = heap.withStrings([system || null, toolsJson], (s, t) => M._needle_init(s, t, 0));
    if (prefix < 0) throw new Error('The tools and system facts do not fit the context window.');
    boundKey = key;
    return true;
  }

  function complete(input: string, maxNewTokens = MAX_NEW_TOKENS): NeedleResponse {
    M.HEAPU8.fill(0, out, out + RESPONSE_CAPACITY);
    const rc = heap.withStrings([input], (p) => M._needle_complete(p, maxNewTokens, out, RESPONSE_CAPACITY - 1));
    if (rc < 0) throw new Error('The engine failed to complete this turn.');
    return JSON.parse(heap.readString(out));
  }

  return { bind, complete, reset: () => M._needle_reset() };
}

export interface CatalogEntry {
  name: string;
  schema: ToolSchema;
  risky: boolean;
}

/** Tool entries arrive as `{risk, ...schema}`. */
export const loadCatalog = (entries: ToolEntry[]): CatalogEntry[] =>
  entries.map(({ risk, ...schema }) => ({ name: schema.name, schema, risky: risk === 'high' }));

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The gate: act at or above the bar, ask below it, refuse when there is no call. */
export function judge(response: NeedleResponse, risky = new Set<string>(), threshold = AUTO_THRESHOLD): Verdict {
  const validation = response.validation ?? {};
  const calls = response.function_calls ?? [];
  const held = response.suppressed_calls ?? [];
  const ungrounded = validation.ungrounded ?? [];
  const { confidence } = response;
  const isRisky = calls.some((c) => risky.has(c.name));
  const bar = isRisky ? HIGH_RISK_THRESHOLD : threshold;
  const ask = (why: string, shown = calls): Verdict => ({ kind: 'confirm', calls: shown, bar, why });
  const refuse = (why: string): Verdict => ({ kind: 'refuse', calls: [], bar, why });

  if (response.success === false) {
    return refuse(`No call decoded: ${response.error || response.error_code || 'the engine gave no reason'}.`);
  }
  if (!calls.length && !held.length) return refuse('No Acme Admin action covers this step.');
  if (!calls.length) return ask('The engine withheld this call.', held);
  if (validation.negation) return refuse('The engine flagged the step as negated, so nothing runs.');
  if (ungrounded.length) return refuse(`The engine made up ${ungrounded.join(', ')}; the step doesn't give it.`);
  if (confidence == null) return ask('These weights report no calibrated confidence.');
  if (confidence < bar) return ask(`Confidence ${pct(confidence)} is below the ${pct(bar)} bar.`);
  if (isRisky) {
    const why = `Confidence ${pct(confidence)}, but this can't be undone.`;
    return { kind: 'confirm', irreversible: true, calls, bar, why };
  }
  return { kind: 'execute', calls, bar, why: `Confidence ${pct(confidence)} clears the ${pct(bar)} bar.` };
}

/** One standalone request against the page's current tools: bind, fresh conversation, decode, gate. */
export function runTurn(engine: Engine, request: string, facts: string, catalog: CatalogEntry[]): Turn {
  if (!engine.bind(facts, JSON.stringify(catalog.map((t) => t.schema)))) engine.reset();
  const response = engine.complete(request);
  return { response, verdict: judge(response, new Set(catalog.filter((t) => t.risky).map((t) => t.name))) };
}
