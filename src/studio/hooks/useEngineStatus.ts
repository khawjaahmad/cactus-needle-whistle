import { useSyncExternalStore } from 'react';
import type { EngineStatus } from '../../runtime/protocol.ts';

interface StatusSource {
  subscribe(listener: () => void): () => void;
  getStatus(): EngineStatus;
}

/** An engine worker's loading status, kept current. */
export const useEngineStatus = (engine: StatusSource) => useSyncExternalStore(engine.subscribe, engine.getStatus);
