/*
 * The model archives the studio runs, pinned by revision. A .cact is tied to the engine build that
 * reads it (§12), so each pin names the vendored build it pairs with.
 *
 * A plain script so the workers can importScripts() it and the Node scripts can require() it:
 * the browser and the checks always load the same bytes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Models = factory();
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const pin = ({ name, repo, file, revision, bytes, sha256, engine }) => ({
    name,
    file,
    revision,
    bytes,
    sha256,
    engine,
    url: `https://huggingface.co/Cactus-Compute/${repo}/resolve/${revision}/${file}`,
    cacheName: `${repo}-${revision.slice(0, 7)}`,
  });

  /** Tool calling. Don't bump it without re-running the suite (README, "Deploying"). */
  const NEEDLE3 = pin({
    name: 'the model',
    repo: 'needle3',
    file: 'needle3.cact',
    revision: 'b274efcb211a9eef48c9a88da4b43bd569696a39',
    bytes: 35335380,
    sha256: 'c9d915eca282ed42d1a09b143b592adb4cc6744ffe2d294adf5cfc5548170c38',
    engine: 'needle3-b274efc',
  });

  /** Speech. Its engine build (c7c415a) is the one that exports needle_transcribe. */
  const WHISTLE = pin({
    name: 'Whistle',
    repo: 'whistle',
    file: 'whistle.cact',
    revision: 'b358ddadd89b7a713b5aa131f23032d3cca1b251',
    bytes: 16919407,
    sha256: 'b6e02f048568ac5d01a2042556c658061e699acbc0aa2a1439f52f3d461dffeb',
    engine: 'needle3-c7c415a',
  });

  return { NEEDLE3, WHISTLE };
});
