/*
 * Needle Test Studio: a manual test case in plain English runs against Acme Admin, one step at a
 * time, with Needle 3 deciding each step's call (lib/run-case.ts). The suite tab runs the
 * environment's frozen 32-case suite in the browser, and a case can be dictated with Cactus
 * Whistle. This component wires the pieces together; the logic lives in hooks/ and lib/.
 */
import { useState } from 'react';
import { createAcmeDriver, resetUrl } from '../acme/driver.ts';
import { vocabulary } from '../acme/tools.ts';
import { AppFrame } from './components/AppFrame.tsx';
import { CaseEditor } from './components/CaseEditor.tsx';
import { CaseReport } from './components/CaseReport.tsx';
import { DictateButton, DictationStatus } from './components/Dictation.tsx';
import { Header } from './components/Header.tsx';
import { SpecPanel } from './components/SpecPanel.tsx';
import { SuitePanel } from './components/SuitePanel.tsx';
import { Tabs, type TabId } from './components/Tabs.tsx';
import { agent, dictation } from './engines.ts';
import { useCaseDraft } from './hooks/useCaseDraft.ts';
import { useCaseRunner } from './hooks/useCaseRunner.ts';
import { useDictation } from './hooks/useDictation.ts';
import { useEngineStatus } from './hooks/useEngineStatus.ts';
import { useSuiteRunner } from './hooks/useSuiteRunner.ts';
import { EXAMPLES } from './lib/examples.ts';

// Resolved against the page, not this module: the sandbox page sits next to index.html.
const APP_BASE = new URL('sandbox/#', location.href).href;
const SPEC_APP_URL = new URL('sandbox/?reset#', location.href).href;
const FIRST_LOAD = resetUrl(APP_BASE);

// One app frame for the page's lifetime; the driver picks it up from its first load.
const driver = createAcmeDriver({ baseUrl: APP_BASE });

export function App() {
  const engine = useEngineStatus(agent);
  const [tab, setTab] = useState<TabId>('app');
  const [spec, setSpec] = useState('');

  const draft = useCaseDraft(EXAMPLES[0]);
  const caseRunner = useCaseRunner({
    agent,
    driver,
    specAppUrl: SPEC_APP_URL,
    onStart: () => setTab('app'),
    onPassed: setSpec,
  });
  const suiteRunner = useSuiteRunner(agent);
  const speech = useDictation({ dictation, vocabulary: () => vocabulary(driver.state()), onSteps: draft.append });

  const busy = caseRunner.running || suiteRunner.running;
  const canRun = engine.state === 'ready' && !busy && !speech.recording;

  return (
    <>
      <Header status={engine} />
      <div className="studio">
        <section className="pane" aria-label="Test case">
          <div className="section">
            <CaseEditor draft={draft} />
            <div className="row">
              <button
                className="btn btn-primary"
                id="run"
                type="button"
                disabled={!canRun}
                onClick={() => caseRunner.run(draft.read())}
              >
                Run in sandbox
              </button>
              <DictateButton
                recording={speech.recording}
                level={speech.level}
                disabled={!speech.ready || busy || speech.transcribing}
                onClick={speech.toggle}
              />
            </div>
            <DictationStatus status={speech.status} level={speech.level} />
          </div>
          <CaseReport report={caseRunner.report} onAnswer={caseRunner.answer} onViewSpec={() => setTab('spec')} />
        </section>

        <section className="pane" aria-label="Output">
          <Tabs active={tab} onSelect={setTab} />
          <AppFrame
            src={FIRST_LOAD}
            hidden={tab !== 'app'}
            onLoad={driver.attach}
            onReset={() => void driver.reset()}
          />
          <SuitePanel report={suiteRunner.report} hidden={tab !== 'suite'} disabled={!canRun} onRun={suiteRunner.run} />
          <SpecPanel spec={spec} hidden={tab !== 'spec'} />
        </section>
      </div>
    </>
  );
}
