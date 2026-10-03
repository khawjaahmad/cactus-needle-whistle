/*
 * Needle Test Studio: a manual test case in plain English runs against Acme Admin, one step at a
 * time, with Needle 3 deciding each step's call (case-runner.js). The suite tab runs the
 * environment's frozen 32-case suite in the browser (suite-runner.js), and a case can be
 * dictated with Cactus Whistle (dictation-panel.js).
 *
 * This module only wires the pieces together.
 */
import { createAcmeDriver } from '../acme/driver.js';
import { createAgent } from '../engine/agent.js';
import { byId } from '../shared/dom.js';
import { createDictation } from '../speech/dictation.js';
import { createCaseRunner } from './case-runner.js';
import { createDictationPanel } from './dictation-panel.js';
import { createEditor } from './editor.js';
import { createSession } from './session.js';
import { createSpecPanel } from './spec-panel.js';
import { createStatusLine } from './status.js';
import { createSuiteRunner } from './suite-runner.js';
import { createTabs } from './tabs.js';

// Resolved against the page, not this module: the sandbox sits next to index.html.
const APP_BASE = new URL('sandbox/#', location.href).href;
const SPEC_APP_URL = new URL('sandbox/?reset#', location.href).href;

// ── Engines ──────────────────────────────────────────────────────────────────────────────────

const session = createSession(refreshButtons);

const engineStatus = createStatusLine({ dot: byId('dot'), label: byId('status'), bar: byId('bar') });
const agent = createAgent({
  onStatus: (status) => {
    engineStatus(status);
    refreshButtons();
  },
});

// A second engine, loaded in parallel with the first: Whistle only transcribes, Needle 3 only
// decodes. They are separate workers on separate builds, so the tool-calling engine the suite is
// pinned to is untouched by the speech one (speech/core.js).
const speechStatus = createStatusLine({ dot: byId('speech-dot'), label: byId('speech-status') });
const dictation = createDictation({
  onStatus: (status) => {
    speechStatus(status);
    refreshButtons();
  },
});

function refreshButtons() {
  const { busy, recording, transcribing } = session.state;
  byId('run').disabled = byId('run-suite').disabled = !agent.ready || busy || recording;
  byId('dictate').disabled = !dictation.ready || busy || transcribing;
}

// ── App under test ───────────────────────────────────────────────────────────────────────────

const frame = byId('app');
const driver = createAcmeDriver(frame, { baseUrl: APP_BASE });

const showUrl = () => {
  try {
    byId('app-url').textContent = frame.contentWindow.location.href.replace(location.origin, '');
  } catch {
    // Not loaded yet.
  }
};
frame.addEventListener('load', () => {
  showUrl();
  frame.contentWindow.addEventListener('hashchange', showUrl);
});
driver.reset();
byId('reset-app').addEventListener('click', () => driver.reset());

// ── Studio ───────────────────────────────────────────────────────────────────────────────────

const tabs = createTabs();
const editor = createEditor();
const specPanel = createSpecPanel();

const caseRunner = createCaseRunner({ agent, driver, editor, session, tabs, specPanel, specAppUrl: SPEC_APP_URL });
const suiteRunner = createSuiteRunner({ agent, session });
createDictationPanel({ dictation, driver, editor, session, status: speechStatus });

byId('run').addEventListener('click', caseRunner.run);
byId('run-suite').addEventListener('click', suiteRunner.run);
