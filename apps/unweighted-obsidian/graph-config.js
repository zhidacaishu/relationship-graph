const CONFIG_VERSION = 1;
const DEFAULT_THEME_ID = "obsidian-echo";
const STORAGE_PREFIX = "atlas-graph-config:v1";

const BASE_RENDER_TOKENS = {
  canvasBackground: "#1c1c1b",
  link: "#868581",
  linkFocus: "#c2bad3",
  arrow: "#aaa5b0",
  selection: "#e5dffc",
  pinned: "#b0a3ce",
  label: "#b4b0ab",
  labelFocus: "#e7e3eb",
  labelFaded: "#7e7b78",
  edgeAlpha: 0.115,
  edgeFadedAlpha: 0.018,
  edgeFocusAlpha: 0.62,
  nodeAlpha: 0.86,
  nodeFadedAlpha: 0.12,
  nodeSearchFadedAlpha: 0.17,
  labelAlpha: 0.57,
  labelFadedAlpha: 0.08,
  labelSize: 1,
  selectionAlpha: 0.78,
  nodeFillAlpha: 1,
  rimColor: "#ffffff",
  rimAlpha: 0,
  rimWidth: 0,
  keylineColor: "#000000",
  keylineAlpha: 0,
  keylineWidth: 0,
  coreColor: "#ffffff",
  coreAlpha: 0,
  coreScale: 0.25,
  coreOffsetX: 0,
  coreOffsetY: 0,
  auraAlpha: 0,
  auraScale: 1.5,
  auraOffset: 0,
  ringGap: 2.6,
  ringWidth: 1,
  edgeUnderlay: "#000000",
  edgeUnderlayAlpha: 0,
  edgeUnderlayWidth: 1.8,
  edgeMainWidth: 0.62,
  edgeFocusWidth: 1.16,
  fontFamily: '"Segoe UI Variable Text", "Segoe UI", sans-serif'
};

export const GRAPH_CAPABILITIES = Object.freeze({
  mode: "unweighted",
  supportsWeights: false,
  supportsTimeline: false,
  supportsWeightLayout: false,
  supportsWeightEdgeStyle: false,
  nodeColorModes: ["group", "type", "fixed"],
  nodeSizeModes: ["degree", "fixed"],
  edgeWidthModes: ["fixed"]
});

export const THEMES = Object.freeze({
  "editorial-atlas": {
    id: "editorial-atlas",
    name: "Editorial Atlas",
    shortName: "Editorial",
    description: "Warm paper, ink and cartographic marks.",
    colorScheme: "light",
    themeColor: "#e8e1d2",
    panelOpen: false,
    palette: ["#315e63", "#a65b43", "#7c874d", "#b1833e", "#735b7b", "#4f7481", "#9a6d5e", "#66704b"],
    mutedNode: "#817d70",
    syntheticColors: { tag: "#9b563f", attachment: "#486f73", unresolved: "#8e8778", orphan: "#777267" },
    defaults: { textFade: 0.48, nodeScale: 1.1, linkThickness: 1.05 },
    render: {
      canvasBackground: "#e8e1d2",
      link: "#4e5e58",
      linkFocus: "#8c4735",
      arrow: "#665f53",
      selection: "#7d3528",
      pinned: "#405e60",
      label: "#3c443e",
      labelFocus: "#241f1a",
      labelFaded: "#7b776c",
      edgeAlpha: 0.26,
      edgeFadedAlpha: 0.055,
      edgeFocusAlpha: 0.84,
      nodeAlpha: 0.94,
      nodeFadedAlpha: 0.18,
      nodeSearchFadedAlpha: 0.22,
      labelAlpha: 0.78,
      labelFadedAlpha: 0.14,
      labelSize: 1.12,
      fontFamily: 'Baskerville, "Palatino Linotype", serif'
    }
  },
  "luminous-map": {
    id: "luminous-map",
    name: "Luminous Map",
    shortName: "Luminous",
    description: "A restrained deep-space map with luminous paths.",
    colorScheme: "dark",
    themeColor: "#050b12",
    panelOpen: false,
    palette: ["#72dfce", "#efb64f", "#eb7d72", "#5fb6d4", "#a88adf", "#75c985", "#d68bb6", "#80a9ef"],
    mutedNode: "#68858a",
    syntheticColors: { tag: "#63dbc9", attachment: "#62aecd", unresolved: "#61767b", orphan: "#4c6267" },
    defaults: { textFade: 0.5, nodeScale: 1.13, linkThickness: 1.04 },
    render: {
      canvasBackground: "#050b12",
      link: "#6d9299",
      linkFocus: "#74e6d7",
      arrow: "#94d7d0",
      selection: "#d9fff9",
      pinned: "#f0c76d",
      label: "#b8d2d0",
      labelFocus: "#f1fffc",
      labelFaded: "#648083",
      edgeAlpha: 0.2,
      edgeFadedAlpha: 0.032,
      edgeFocusAlpha: 0.88,
      nodeAlpha: 0.98,
      nodeFadedAlpha: 0.13,
      nodeSearchFadedAlpha: 0.15,
      labelAlpha: 0.69,
      labelFadedAlpha: 0.08,
      labelSize: 1.08,
      fontFamily: "Constantia, Georgia, serif"
    }
  },
  "research-console": {
    id: "research-console",
    name: "Research Console",
    shortName: "Console",
    description: "A dense analytical instrument with measured contrast.",
    colorScheme: "dark",
    themeColor: "#101612",
    panelOpen: true,
    palette: ["#9fbd8b", "#d4b273", "#8aa8a0", "#c78470", "#7996b1", "#b48da3", "#a0a879", "#8d9d87"],
    mutedNode: "#7a897b",
    syntheticColors: { tag: "#a8c991", attachment: "#7da39a", unresolved: "#748078", orphan: "#5f6b61" },
    defaults: { textFade: 0.52, nodeScale: 1.02, linkThickness: 1 },
    render: {
      canvasBackground: "#101612",
      link: "#819083",
      linkFocus: "#bddb9f",
      arrow: "#a8bd9e",
      selection: "#e3f4d5",
      pinned: "#e5bd78",
      label: "#bed0ba",
      labelFocus: "#f0f8e9",
      labelFaded: "#718073",
      edgeAlpha: 0.24,
      edgeFadedAlpha: 0.05,
      edgeFocusAlpha: 0.9,
      nodeAlpha: 0.96,
      nodeFadedAlpha: 0.2,
      nodeSearchFadedAlpha: 0.2,
      labelAlpha: 0.74,
      labelFadedAlpha: 0.12,
      labelSize: 1.02,
      fontFamily: 'Bahnschrift, "Arial Narrow", sans-serif'
    }
  },
  "obsidian-echo": {
    id: "obsidian-echo",
    name: "Obsidian Echo",
    shortName: "Echo",
    description: "A quieter, graph-first interpretation of the Vault.",
    colorScheme: "dark",
    themeColor: "#151419",
    panelOpen: false,
    palette: ["#b091e5", "#73aec4", "#d58eaa", "#d1ab65", "#70b19f", "#da8e74", "#a2b574", "#b18dca"],
    mutedNode: "#9a949d",
    syntheticColors: { tag: "#ad91e4", attachment: "#75abc5", unresolved: "#817c83", orphan: "#676269" },
    defaults: { textFade: 0.5, nodeScale: 1.08, linkThickness: 1 },
    render: {
      canvasBackground: "#151419",
      link: "#9a949f",
      linkFocus: "#d1c1e4",
      arrow: "#bdb1c8",
      selection: "#f1e8ff",
      pinned: "#bbabe0",
      label: "#cbc4cf",
      labelFocus: "#fff9ff",
      labelFaded: "#8f8792",
      edgeAlpha: 0.18,
      edgeFadedAlpha: 0.035,
      edgeFocusAlpha: 0.76,
      nodeAlpha: 0.94,
      nodeFadedAlpha: 0.16,
      nodeSearchFadedAlpha: 0.17,
      labelAlpha: 0.68,
      labelFadedAlpha: 0.1,
      labelSize: 1.08,
      fontFamily: "Constantia, Georgia, serif"
    }
  }
});

export const MATERIALS = Object.freeze({
  none: { id: "none", name: "Untreated", description: "Flat graph marks with no additional surface layers.", render: {} },
  "mineral-glaze": {
    id: "mineral-glaze",
    name: "Mineral Glaze",
    description: "Translucent mineral color with a dark core and soft glaze.",
    render: {
      link: "#7eaaa6", linkFocus: "#a6e8de", selection: "#e3fff8", pinned: "#e2bd78", label: "#bed2cf",
      edgeAlpha: 0.17, edgeFocusAlpha: 0.83, nodeFillAlpha: 0.82, rimColor: "#b9e7de", rimAlpha: 0.38,
      rimWidth: 0.78, keylineColor: "#102429", keylineAlpha: 0.66, keylineWidth: 0.7, coreAlpha: 0.35,
      coreScale: 0.34, auraAlpha: 0.07, auraScale: 1.72, edgeUnderlay: "#02090c", edgeUnderlayAlpha: 0.38,
      edgeUnderlayWidth: 1.85, edgeMainWidth: 0.72, edgeFocusWidth: 1.25, ringGap: 3.2, ringWidth: 1.05
    }
  },
  "enamel-double-line": {
    id: "enamel-double-line",
    name: "Enamel Double-Line",
    description: "Saturated enamel with a dark inner and pale outer line.",
    render: {
      link: "#ad9b96", linkFocus: "#f0cbbb", selection: "#fff1df", pinned: "#9ed0cb", label: "#d8cac6",
      edgeAlpha: 0.19, edgeFocusAlpha: 0.88, nodeFillAlpha: 0.96, rimColor: "#f2ddcc", rimAlpha: 0.7,
      rimWidth: 0.58, keylineColor: "#281c20", keylineAlpha: 0.94, keylineWidth: 0.9, coreAlpha: 0.16,
      coreScale: 0.23, auraAlpha: 0.025, auraScale: 1.46, ringGap: 3.8, ringWidth: 1.35,
      edgeUnderlay: "#100b0e", edgeUnderlayAlpha: 0.55, edgeUnderlayWidth: 2, edgeMainWidth: 0.68, edgeFocusWidth: 1.25
    }
  },
  "ink-bloom": {
    id: "ink-bloom",
    name: "Ink Bloom",
    description: "Muted ink color with a soft, offset bloom.",
    render: {
      link: "#7e9189", linkFocus: "#b2cec0", selection: "#dceae2", pinned: "#c2a77b", label: "#b7c0bb",
      edgeAlpha: 0.15, edgeFocusAlpha: 0.74, nodeFillAlpha: 0.72, rimColor: "#b3c8bd", rimAlpha: 0.18,
      rimWidth: 1.05, keylineColor: "#17221d", keylineAlpha: 0.34, keylineWidth: 0.65, coreAlpha: 0.1,
      coreScale: 0.38, auraAlpha: 0.11, auraScale: 1.88, auraOffset: 0.18, ringGap: 3.6, ringWidth: 0.82,
      edgeUnderlay: "#070c09", edgeUnderlayAlpha: 0.22, edgeUnderlayWidth: 1.55, edgeMainWidth: 0.78, edgeFocusWidth: 1.25
    }
  },
  "precision-metal": {
    id: "precision-metal",
    name: "Precision Metal",
    description: "Cool metal with a sharp inner edge and mirror highlight.",
    render: {
      link: "#829ba6", linkFocus: "#c6e3e8", selection: "#effdff", pinned: "#e4b96b", label: "#c1cdd1",
      edgeAlpha: 0.2, edgeFocusAlpha: 0.92, nodeFillAlpha: 0.88, rimColor: "#d8edf0", rimAlpha: 0.56,
      rimWidth: 0.48, keylineColor: "#121c22", keylineAlpha: 0.9, keylineWidth: 0.86, coreAlpha: 0.46,
      coreScale: 0.2, coreOffsetX: -0.3, coreOffsetY: -0.32, auraAlpha: 0.025, auraScale: 1.48,
      ringGap: 4.1, ringWidth: 0.72, edgeUnderlay: "#05090c", edgeUnderlayAlpha: 0.52,
      edgeUnderlayWidth: 2.15, edgeMainWidth: 0.62, edgeFocusWidth: 1.08
    }
  }
});

function themeConfig(themeId) {
  const theme = THEMES[themeId] ?? THEMES[DEFAULT_THEME_ID];
  return {
    version: CONFIG_VERSION,
    id: `builtin:${theme.id}`,
    name: theme.name,
    semantics: {
      mode: "unweighted",
      weightAffectsLayout: false,
      weightAffectsEdgeStyle: false,
      revealMode: "off"
    },
    theme: { id: theme.id },
    nodeStyle: {
      colorMode: "group",
      paletteId: "theme",
      color: theme.palette[0],
      sizeMode: "degree",
      scale: theme.defaults.nodeScale,
      materialId: "none"
    },
    edgeStyle: {
      colorMode: "theme",
      color: theme.render.link,
      focusColor: theme.render.linkFocus,
      widthMode: "fixed",
      thickness: theme.defaults.linkThickness,
      opacity: null,
      arrows: false
    },
    display: {
      textFade: theme.defaults.textFade,
      labelDensity: "balanced",
      vignette: true
    },
    layout: {
      centerStrength: 0.28,
      repelStrength: 9.5,
      linkStrength: 0.82,
      linkDistance: 72
    }
  };
}

export const BUILTIN_PRESETS = Object.freeze(Object.fromEntries(
  Object.keys(THEMES).map((themeId) => [`builtin:${themeId}`, themeConfig(themeId)])
));

export function normalizeGraphConfig(input) {
  const source = isRecord(input) ? input : {};
  const requestedTheme = String(source.theme?.id ?? DEFAULT_THEME_ID);
  const themeId = THEMES[requestedTheme] ? requestedTheme : DEFAULT_THEME_ID;
  const base = themeConfig(themeId);
  const materialId = MATERIALS[source.nodeStyle?.materialId] ? source.nodeStyle.materialId : "none";
  const opacity = source.edgeStyle?.opacity == null ? null : finiteNumber(source.edgeStyle.opacity, base.edgeStyle.opacity ?? THEMES[themeId].render.edgeAlpha, 0, 1);
  const mode = source.semantics?.mode === "weighted" && GRAPH_CAPABILITIES.supportsWeights ? "weighted" : "unweighted";

  return {
    version: CONFIG_VERSION,
    id: safeId(source.id, base.id),
    name: safeName(source.name, base.name),
    semantics: {
      mode,
      weightAffectsLayout: mode === "weighted" && GRAPH_CAPABILITIES.supportsWeightLayout && Boolean(source.semantics?.weightAffectsLayout),
      weightAffectsEdgeStyle: mode === "weighted" && GRAPH_CAPABILITIES.supportsWeightEdgeStyle && Boolean(source.semantics?.weightAffectsEdgeStyle),
      revealMode: mode === "weighted" && GRAPH_CAPABILITIES.supportsTimeline && source.semantics?.revealMode === "timeline" ? "timeline" : "off"
    },
    theme: { id: themeId },
    nodeStyle: {
      colorMode: enumValue(source.nodeStyle?.colorMode, GRAPH_CAPABILITIES.nodeColorModes, base.nodeStyle.colorMode),
      paletteId: "theme",
      color: safeColor(source.nodeStyle?.color, base.nodeStyle.color),
      sizeMode: enumValue(source.nodeStyle?.sizeMode, GRAPH_CAPABILITIES.nodeSizeModes, base.nodeStyle.sizeMode),
      scale: finiteNumber(source.nodeStyle?.scale, base.nodeStyle.scale, 0.5, 2),
      materialId
    },
    edgeStyle: {
      colorMode: enumValue(source.edgeStyle?.colorMode, ["theme", "fixed"], base.edgeStyle.colorMode),
      color: safeColor(source.edgeStyle?.color, base.edgeStyle.color),
      focusColor: safeColor(source.edgeStyle?.focusColor, base.edgeStyle.focusColor),
      widthMode: enumValue(source.edgeStyle?.widthMode, GRAPH_CAPABILITIES.edgeWidthModes, "fixed"),
      thickness: finiteNumber(source.edgeStyle?.thickness, base.edgeStyle.thickness, 0.25, 3),
      opacity,
      arrows: Boolean(source.edgeStyle?.arrows)
    },
    display: {
      textFade: finiteNumber(source.display?.textFade, base.display.textFade, 0, 1),
      labelDensity: enumValue(source.display?.labelDensity, ["quiet", "balanced", "dense"], "balanced"),
      vignette: source.display?.vignette !== false
    },
    layout: {
      centerStrength: finiteNumber(source.layout?.centerStrength, base.layout.centerStrength, 0, 1),
      repelStrength: finiteNumber(source.layout?.repelStrength, base.layout.repelStrength, 0, 20),
      linkStrength: finiteNumber(source.layout?.linkStrength, base.layout.linkStrength, 0, 2),
      linkDistance: finiteNumber(source.layout?.linkDistance, base.layout.linkDistance, 30, 160)
    }
  };
}

export function resolveVisualConfig(config) {
  const normalized = normalizeGraphConfig(config);
  const theme = THEMES[normalized.theme.id];
  const material = MATERIALS[normalized.nodeStyle.materialId];
  const render = { ...BASE_RENDER_TOKENS, ...theme.render, ...material.render };
  if (normalized.edgeStyle.colorMode === "fixed") {
    render.link = normalized.edgeStyle.color;
    render.linkFocus = normalized.edgeStyle.focusColor;
    render.arrow = normalized.edgeStyle.focusColor;
  }
  if (normalized.edgeStyle.opacity != null) render.edgeAlpha = normalized.edgeStyle.opacity;
  return {
    ...render,
    material: material.id !== "none",
    themeId: theme.id,
    materialId: material.id,
    colorScheme: theme.colorScheme,
    themeColor: theme.themeColor,
    palette: [...theme.palette],
    mutedNode: theme.mutedNode,
    syntheticColors: { ...theme.syntheticColors },
    nodeColorMode: normalized.nodeStyle.colorMode,
    nodeColor: normalized.nodeStyle.color,
    vignette: normalized.display.vignette
  };
}

export function applyDocumentConfig(config, visual = resolveVisualConfig(config)) {
  const normalized = normalizeGraphConfig(config);
  document.body.dataset.theme = normalized.theme.id;
  if (normalized.nodeStyle.materialId === "none") delete document.body.dataset.material;
  else document.body.dataset.material = normalized.nodeStyle.materialId;
  document.body.classList.toggle("is-vignette-disabled", !normalized.display.vignette);
  document.documentElement.style.colorScheme = visual.colorScheme;
  const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (colorSchemeMeta) colorSchemeMeta.content = visual.colorScheme;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.content = visual.themeColor;
  const overrides = document.body.style;
  for (const property of ["--graph-link", "--graph-link-focus", "--graph-arrow", "--graph-edge-alpha"]) overrides.removeProperty(property);
  if (normalized.edgeStyle.colorMode === "fixed") {
    overrides.setProperty("--graph-link", normalized.edgeStyle.color);
    overrides.setProperty("--graph-link-focus", normalized.edgeStyle.focusColor);
    overrides.setProperty("--graph-arrow", normalized.edgeStyle.focusColor);
  }
  if (normalized.edgeStyle.opacity != null) overrides.setProperty("--graph-edge-alpha", String(normalized.edgeStyle.opacity));
}

export function classifyConfigChange(previous, next) {
  const before = normalizeGraphConfig(previous);
  const after = normalizeGraphConfig(next);
  const adapter = before.semantics.mode !== after.semantics.mode;
  const topology = adapter;
  const radii = before.nodeStyle.scale !== after.nodeStyle.scale || before.nodeStyle.sizeMode !== after.nodeStyle.sizeMode;
  const forces = JSON.stringify(before.layout) !== JSON.stringify(after.layout)
    || before.semantics.weightAffectsLayout !== after.semantics.weightAffectsLayout;
  const visual = JSON.stringify({ ...before, id: "", name: "", layout: null, semantics: null })
    !== JSON.stringify({ ...after, id: "", name: "", layout: null, semantics: null });
  return { adapter, topology, radii, forces, visual };
}

export function resolveInitialGraphConfig({ entryPreset, entryMaterial } = {}) {
  const parameters = new URLSearchParams(window.location.search);
  const queryPreset = parameters.get("preset");
  const requestedPreset = queryPreset ? normalizePresetId(queryPreset) : entryPreset ? normalizePresetId(entryPreset) : null;
  const storedUsers = loadUserPresets();
  const requested = requestedPreset ? getPreset(requestedPreset, storedUsers) : null;
  const stored = loadStoredValue(`${STORAGE_PREFIX}:current`, null);
  const initial = requested ?? (stored ? normalizeGraphConfig(stored) : cloneConfig(BUILTIN_PRESETS[`builtin:${DEFAULT_THEME_ID}`]));
  if (entryMaterial && MATERIALS[entryMaterial]) initial.nodeStyle.materialId = entryMaterial;
  return normalizeGraphConfig(initial);
}

export function listPresets() {
  return [...Object.values(BUILTIN_PRESETS).map(cloneConfig), ...loadUserPresets()];
}

export function getPreset(id, presets = loadUserPresets()) {
  const normalizedId = normalizePresetId(id);
  const builtin = BUILTIN_PRESETS[normalizedId];
  if (builtin) return cloneConfig(builtin);
  const user = presets.find((preset) => preset.id === normalizedId);
  return user ? cloneConfig(user) : null;
}

export function saveCurrentConfig(config) {
  const normalized = normalizeGraphConfig(config);
  saveStoredValue(`${STORAGE_PREFIX}:current`, normalized);
  return normalized;
}

export function saveUserPreset(config, name) {
  const preset = normalizeGraphConfig({
    ...config,
    id: `user:${createId()}`,
    name: safeName(name, "Untitled study")
  });
  const presets = loadUserPresets();
  presets.push(preset);
  saveStoredValue(`${STORAGE_PREFIX}:presets`, presets);
  return cloneConfig(preset);
}

export function deleteUserPreset(id) {
  if (!String(id).startsWith("user:")) return false;
  const presets = loadUserPresets();
  const next = presets.filter((preset) => preset.id !== id);
  if (next.length === presets.length) return false;
  saveStoredValue(`${STORAGE_PREFIX}:presets`, next);
  return true;
}

export function loadComparisonSlots() {
  const stored = loadStoredValue(`${STORAGE_PREFIX}:slots`, {});
  return {
    a: stored?.a ? normalizeGraphConfig(stored.a) : null,
    b: stored?.b ? normalizeGraphConfig(stored.b) : null
  };
}

export function saveComparisonSlot(slot, config) {
  if (slot !== "a" && slot !== "b") throw new Error(`Unknown comparison slot: ${slot}`);
  const slots = loadComparisonSlots();
  slots[slot] = normalizeGraphConfig(config);
  saveStoredValue(`${STORAGE_PREFIX}:slots`, slots);
  return slots;
}

export function importGraphConfig(value) {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  if (!isRecord(parsed)) throw new Error("The selected file does not contain a graph configuration.");
  if (Number(parsed.version ?? CONFIG_VERSION) > CONFIG_VERSION) throw new Error("This configuration was created by a newer version of Atlas Graph.");
  return normalizeGraphConfig(parsed);
}

export function exportGraphConfig(config) {
  return JSON.stringify(normalizeGraphConfig(config), null, 2);
}

export function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

export function configFingerprint(config) {
  const normalized = normalizeGraphConfig(config);
  return JSON.stringify({ ...normalized, id: "", name: "" });
}

export function configDisplayName(config) {
  const normalized = normalizeGraphConfig(config);
  const builtin = BUILTIN_PRESETS[normalized.id];
  return builtin && configFingerprint(normalized) !== configFingerprint(builtin)
    ? `${THEMES[normalized.theme.id].name} variation`
    : normalized.name;
}

export function themePanelDefault(themeId) {
  return (THEMES[themeId] ?? THEMES[DEFAULT_THEME_ID]).panelOpen;
}

function loadUserPresets() {
  const stored = loadStoredValue(`${STORAGE_PREFIX}:presets`, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isRecord).map(normalizeGraphConfig).filter((preset) => preset.id.startsWith("user:"));
}

function normalizePresetId(id) {
  const value = String(id ?? "");
  if (BUILTIN_PRESETS[value] || value.startsWith("user:")) return value;
  if (THEMES[value]) return `builtin:${value}`;
  return value;
}

function loadStoredValue(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function saveStoredValue(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function safeId(value, fallback) {
  const candidate = String(value ?? "").trim();
  return candidate && candidate.length <= 120 ? candidate : fallback;
}

function safeName(value, fallback) {
  const candidate = String(value ?? "").trim().replace(/[\x00-\x1f]/g, "").slice(0, 80);
  return candidate || fallback;
}

function safeColor(value, fallback) {
  const candidate = String(value ?? "").trim();
  return /^#[\da-f]{6}$/i.test(candidate) ? candidate.toLowerCase() : fallback;
}

function finiteNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function enumValue(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
