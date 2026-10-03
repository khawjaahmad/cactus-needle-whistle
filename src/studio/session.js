/**
 * What the studio is doing right now. Running a case or the suite, recording and transcribing
 * each lock out some controls; every change goes through set(), so the controls never go stale.
 */
export function createSession(onChange) {
  let state = { busy: false, recording: false, transcribing: false };
  return {
    get state() {
      return state;
    },
    set(patch) {
      state = { ...state, ...patch };
      onChange(state);
    },
  };
}
