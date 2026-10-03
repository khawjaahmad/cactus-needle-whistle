/** What Needle 3 takes (tool schemas) and gives back (a response), and the gate's verdict on it. */

export interface PropertySchema {
  type: 'string';
  description?: string;
  enum?: string[];
  minLength?: number;
  pattern?: string;
  default?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  /** Regexes over the request; a match forces this tool (§9). */
  triggers?: string[];
  parameters: { type: 'object'; properties: Record<string, PropertySchema>; required: string[] };
}

/** A tool as the page declares it: the schema, plus `risk`, which only the gate reads. */
export interface ToolEntry extends ToolSchema {
  risk?: 'high';
}

/** Every Acme Admin argument is a string (enums and verbatim text). */
export type CallArguments = Record<string, string>;

export interface FunctionCall {
  name: string;
  arguments: CallArguments;
}

export interface NeedleResponse {
  success?: boolean;
  error?: string;
  error_code?: string;
  function_calls?: FunctionCall[];
  /** Calls the engine decoded but held back. */
  suppressed_calls?: FunctionCall[];
  confidence?: number | null;
  reasoning?: string;
  validation?: { negation?: boolean; ungrounded?: string[] };
}

export interface Verdict {
  kind: 'execute' | 'confirm' | 'refuse';
  calls: FunctionCall[];
  bar: number;
  why: string;
  /** A confident call that can't be undone: an unattended run counts the written step as the confirmation. */
  irreversible?: boolean;
}

/** One gated turn: what the worker answers a `run` request with. */
export interface Turn {
  response: NeedleResponse;
  verdict: Verdict;
}

export interface RunRequest {
  type: 'run';
  text: string;
  facts: string;
  tools: ToolEntry[];
}
