/** Compares clips by Whistle's encoder output, without decoding a transcript. */

/** The mean of a clip's frames: `vector` is `frames` rows of `dims` floats, flattened. */
export function meanPool(vector: Float32Array, dims: number) {
  const frames = vector.length / dims;
  const pooled = new Float32Array(dims);
  for (let f = 0; f < frames; f += 1) {
    for (let d = 0; d < dims; d += 1) pooled[d] += vector[f * dims + d] / frames;
  }
  return pooled;
}

/** Cosine similarity, -1..1; 0 when either vector is all zeros. */
export function cosine(a: Float32Array, b: Float32Array) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
