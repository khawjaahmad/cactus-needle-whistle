/** Needle Test Studio: plain-English test cases run against Acme Admin by Needle 3. */
import { useState } from 'react';
import { createAcmeDriver, resetUrl } from '../acme/driver.ts';
import { vocabulary } from '../acme/tools.ts';
import { AppFrame } from './components/AppFrame.tsx';
import { CaseEditor } from './components/CaseEditor.tsx';
import { CaseReport } from './components/CaseReport.tsx';
import { DictateButton, DictationStatus } from './components/Dictation.tsx';
import { Header } from './components/Header.tsx';
import { SuitePanel } from './components/SuitePanel.tsx';
import { Tabs, type TabId } from './components/Tabs.tsx';
import type { AgentMode } from './components/agent/AgentOrb.tsx';
import { WhistlePanel } from './components/WhistlePanel.tsx';
import { agent, whistle } from './engines.ts';
import { useCaseDraft } from './hooks/useCaseDraft.ts';
import { useCaseRunner } from './hooks/useCaseRunner.ts';
import { useDictation } from './hooks/useDictation.ts';
import { useEngineStatus } from './hooks/useEngineStatus.ts';
import { useSuiteRunner } from './hooks/useSuiteRunner.ts';
import { useWhistleLab } from './hooks/useWhistleLab.ts';
import { EXAMPLES } from './lib/examples.ts';

const APP_BASE = new URL('sandbox/#', location.href).href;
const FIRST_LOAD = resetUrl(APP_BASE);

const driver = createAcmeDriver({ baseUrl: APP_BASE, paceMs: 320, typeMs: 24 });

export function App() {
  const engine = useEngineStatus(agent);
  const speechEngine = useEngineStatus(whistle);
  const [tab, setTab] = useState<TabId>('app');

  const draft = useCaseDraft(EXAMPLES[0]);
  const caseRunner = useCaseRunner({
    agent,
    driver,
    onStart: () => setTab('app'),
  });
  const suiteRunner = useSuiteRunner(agent);
  const speech = useDictation({ whistle, vocabulary: () => vocabulary(driver.state()), onSteps: draft.append });
  const lab = useWhistleLab(whistle);

  const busy = caseRunner.running || suiteRunner.running;
  const canRun = engine.state === 'ready' && !busy && !speech.recording;

  const active = caseRunner.report?.steps.find((s) => ['decoding', 'running', 'review'].includes(s.state));
  const mode: AgentMode =
    speech.recording || lab.mode === 'recording' || lab.mode === 'live'
      ? 'listening'
      : active?.state === 'running'
        ? 'acting'
        : active?.state === 'review'
          ? 'waiting'
          : active || suiteRunner.running || speech.transcribing || lab.mode === 'working'
            ? 'thinking'
            : 'idle';

  return (
    <>
      <Header mode={mode} needle={engine} whistle={speechEngine} />
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
            <DictationStatus status={speech.status} peak={speech.level?.peak ?? null} busy={speech.transcribing} />
          </div>
          <CaseReport report={caseRunner.report} onAnswer={caseRunner.answer} />
        </section>

        <section className="pane" aria-label="Output">
          <Tabs active={tab} onSelect={setTab} />
          <AppFrame src={FIRST_LOAD} hidden={tab !== 'app'} driver={driver} onReset={() => void driver.reset()} />
          <SuitePanel report={suiteRunner.report} hidden={tab !== 'suite'} disabled={!canRun} onRun={suiteRunner.run} />
          <WhistlePanel lab={lab} hidden={tab !== 'whistle'} />
        </section>
      </div>
    </>
  );
}
