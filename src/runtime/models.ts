/**
 * The model archives the studio runs, pinned by revision. A .cact is tied to the engine build that
 * reads it (§12), so each pin names the vendored build it pairs with. The workers and the Node
 * scripts import the same pins, so the browser and the checks always load the same bytes.
 */

export interface ModelPin {
  /** What the status line calls it. */
  name: string;
  file: string;
  revision: string;
  bytes: number;
  sha256: string;
  /** The vendored build (vendor/<engine>/) that reads it. */
  engine: string;
  url: string;
  cacheName: string;
}

const pin = ({ repo, ...model }: Omit<ModelPin, 'url' | 'cacheName'> & { repo: string }): ModelPin => ({
  ...model,
  url: `https://huggingface.co/Cactus-Compute/${repo}/resolve/${model.revision}/${model.file}`,
  cacheName: `${repo}-${model.revision.slice(0, 7)}`,
});

/** Tool calling. Don't bump it without re-running the suite (README, "Deploying"). */
export const NEEDLE3 = pin({
  name: 'the model',
  repo: 'needle3',
  file: 'needle3.cact',
  revision: 'b274efcb211a9eef48c9a88da4b43bd569696a39',
  bytes: 35335380,
  sha256: 'c9d915eca282ed42d1a09b143b592adb4cc6744ffe2d294adf5cfc5548170c38',
  engine: 'needle3-b274efc',
});

/** Speech. Its engine build (c7c415a) is the one that exports needle_transcribe. */
export const WHISTLE = pin({
  name: 'Whistle',
  repo: 'whistle',
  file: 'whistle.cact',
  revision: 'b358ddadd89b7a713b5aa131f23032d3cca1b251',
  bytes: 16919407,
  sha256: 'b6e02f048568ac5d01a2042556c658061e699acbc0aa2a1439f52f3d461dffeb',
  engine: 'needle3-c7c415a',
});
