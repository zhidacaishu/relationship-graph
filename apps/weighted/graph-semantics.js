export const GRAPH_CAPABILITIES = Object.freeze({
  mode: "weighted",
  supportsWeights: true,
  supportsTimeline: true,
  supportsWeightLayout: true,
  supportsWeightEdgeStyle: true
});

export const DEFAULT_GRAPH_SEMANTICS = Object.freeze({
  mode: "weighted",
  weightAffectsLayout: true,
  weightAffectsEdgeStyle: true
});

export function normalizeGraphSemantics(value) {
  return {
    mode: value?.mode === "unweighted" ? "unweighted" : "weighted",
    weightAffectsLayout: value?.weightAffectsLayout !== false,
    weightAffectsEdgeStyle: value?.weightAffectsEdgeStyle !== false
  };
}

const DEFAULT_WEIGHT = 0.75;
const STYLE_WEIGHT_MIN = 0.45;
const STYLE_WEIGHT_MAX = 0.95;
const NORMAL_ALPHA = Object.freeze([0.055, 0.085, 0.12, 0.16, 0.215]);
const NORMAL_WIDTH = Object.freeze([0.42, 0.52, 0.62, 0.73, 0.88]);
const FOCUS_ALPHA = Object.freeze([0.5, 0.55, 0.61, 0.66, 0.72]);
const FOCUS_WIDTH = Object.freeze([0.9, 1.02, 1.15, 1.25, 1.34]);

export function weightChannelEnabled(semantics, channel) {
  return semantics?.mode === "weighted" && semantics?.[channel] === true;
}

export function normalizeLinkWeight(value) {
  const weight = Number(value);
  return Number.isFinite(weight) ? Math.max(0, Math.min(1, weight)) : DEFAULT_WEIGHT;
}

export function linkWeightBucket(value) {
  const normalized = (normalizeLinkWeight(value) - STYLE_WEIGHT_MIN) / (STYLE_WEIGHT_MAX - STYLE_WEIGHT_MIN);
  return Math.round(Math.max(0, Math.min(1, normalized)) * (NORMAL_ALPHA.length - 1));
}

export function resolveLinkStroke(link, {
  weightAffectsEdgeStyle = true,
  connected = false,
  faded = false,
  thickness = 1
} = {}) {
  const bucket = weightAffectsEdgeStyle ? linkWeightBucket(link.weight) : -1;
  const widthScale = weightAffectsEdgeStyle
    ? (connected ? FOCUS_WIDTH[bucket] : NORMAL_WIDTH[bucket])
    : (connected ? 1.15 : 0.62);
  let alpha;

  if (faded) alpha = 0.018;
  else if (connected) alpha = weightAffectsEdgeStyle ? FOCUS_ALPHA[bucket] : 0.62;
  else alpha = weightAffectsEdgeStyle ? NORMAL_ALPHA[bucket] : 0.13;

  if (!connected && !faded && link.type !== "internal") alpha *= 0.75;

  const baseThickness = Number(thickness);
  const width = Math.max(0.35, (Number.isFinite(baseThickness) ? baseThickness : 1) * widthScale);
  const color = connected ? 0xc0b5d8 : 0x888682;

  return {
    key: `${color}:${alpha.toFixed(4)}:${width.toFixed(4)}`,
    color,
    alpha,
    width,
    arrowAlpha: faded ? alpha : Math.min(0.7, alpha + 0.14),
    bucket
  };
}
