import {
  MATERIALS,
  THEMES,
  configDisplayName,
  listPresets,
  loadComparisonSlots,
  normalizeGraphConfig,
  resolveInitialGraphConfig,
  resolveVisualConfig
} from "./graph-config.js";

const SNAPSHOT_KEY = "atlas-graph-comparison:v1:snapshot";
const SNAPSHOT_VERSION = 1;
const WORKER_PROTOCOL_VERSION = 5;
const DIRECT_VIEWPORT = Object.freeze({ width: 1280, height: 800 });
const $ = (selector, root = document) => root.querySelector(selector);

const elements = {
  grid: $("#comparison-grid"),
  count: $("#comparison-count"),
  reset: $("#reset-studies"),
  snapshotStatus: $("#snapshot-status"),
  snapshotDetail: $("#snapshot-detail"),
  footnote: $("#comparison-footnote"),
  loading: $("#comparison-loading"),
  loadingDetail: $("#loading-detail")
};

const state = {
  snapshot: null,
  candidates: [],
  selectedIds: [],
  defaultIds: [],
  cardCount: 4
};

void initialize();

async function initialize() {
  try {
    const liveSnapshot = readLiveSnapshot();
    state.snapshot = liveSnapshot ?? await createDirectSnapshot();
    state.candidates = buildCandidates(state.snapshot);
    state.defaultIds = chooseDefaultStudies(state.snapshot, state.candidates);
    state.cardCount = state.defaultIds.length;
    state.selectedIds = [...state.defaultIds];
    elements.count.value = String(state.cardCount);
    bindControls();
    renderComparison();
    updateSnapshotStatus(liveSnapshot ? "live" : "generated");
    elements.loading.hidden = true;
    document.fonts?.ready.then(renderCanvases);
  } catch (error) {
    console.error("Comparison workspace failed", error);
    elements.loading.hidden = true;
    elements.grid.innerHTML = `<div class="error-state"><strong>Comparison unavailable</strong><span>${escapeHtml(error.message)}</span></div>`;
    elements.snapshotStatus.textContent = "Shared graph state unavailable";
    elements.snapshotDetail.textContent = "Return to the graph studio and open Compare view again.";
  }
}

function bindControls() {
  elements.count.addEventListener("change", () => {
    state.cardCount = Number(elements.count.value);
    fillSelectedStudies();
    renderComparison();
  });
  elements.reset.addEventListener("click", () => {
    state.defaultIds = builtinThemeIds(state.candidates);
    state.cardCount = state.defaultIds.length;
    state.selectedIds = [...state.defaultIds];
    elements.count.value = String(state.cardCount);
    renderComparison();
  });
  elements.grid.addEventListener("change", (event) => {
    const select = event.target.closest("select[data-card-index]");
    if (!select) return;
    state.selectedIds[Number(select.dataset.cardIndex)] = select.value;
    renderCard(Number(select.dataset.cardIndex));
  });
}

function readLiveSnapshot() {
  const parameters = new URLSearchParams(window.location.search);
  if (parameters.get("source") !== "live") return null;
  let parsed;
  try {
    parsed = JSON.parse(window.sessionStorage.getItem(SNAPSHOT_KEY) ?? "null");
    window.sessionStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    return null;
  }
  return normalizeSnapshot(parsed);
}

function normalizeSnapshot(value) {
  if (!value || value.version !== SNAPSHOT_VERSION || !Array.isArray(value.graph?.nodes) || !value.graph.nodes.length) return null;
  const ids = new Set();
  const nodes = [];
  for (const rawNode of value.graph.nodes) {
    const id = String(rawNode?.id ?? "");
    const x = Number(rawNode?.x);
    const y = Number(rawNode?.y);
    if (!id || ids.has(id) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    ids.add(id);
    const naturalRadius = finiteNumber(rawNode.naturalRadius, finiteNumber(rawNode.radius, 3, 1, 12), 1, 12);
    nodes.push({
      id,
      name: String(rawNode.name ?? id).slice(0, 120),
      type: normalizeNodeType(rawNode.type),
      degree: finiteNumber(rawNode.degree, 0, 0, 65535),
      naturalRadius,
      radius: finiteNumber(rawNode.radius, naturalRadius, 1, 12),
      groupIndex: Number.isInteger(rawNode.groupIndex) ? rawNode.groupIndex : -1,
      x,
      y
    });
  }
  const links = Array.isArray(value.graph.links) ? value.graph.links.map((rawLink, index) => ({
    id: String(rawLink?.id ?? `link:${index}`),
    source: nodeId(rawLink?.source),
    target: nodeId(rawLink?.target),
    type: String(rawLink?.type ?? "wiki")
  })).filter((link) => ids.has(link.source) && ids.has(link.target) && link.source !== link.target) : [];
  const width = finiteNumber(value.viewport?.width, DIRECT_VIEWPORT.width, 240, 7680);
  const height = finiteNumber(value.viewport?.height, DIRECT_VIEWPORT.height, 180, 4320);
  const dpr = finiteNumber(value.viewport?.dpr, 1, 0.5, 2);
  const camera = {
    x: finiteNumber(value.camera?.x, width / 2, -100000, 100000),
    y: finiteNumber(value.camera?.y, height / 2, -100000, 100000),
    scale: finiteNumber(value.camera?.scale, 1, 0.05, 10)
  };
  return {
    version: SNAPSHOT_VERSION,
    createdAt: String(value.createdAt ?? ""),
    source: "live",
    graph: { mode: value.graph.mode === "local" ? "local" : "global", nodes, links },
    camera,
    viewport: { width, height, dpr },
    config: normalizeGraphConfig(value.config),
    slots: normalizeSlots(value.slots)
  };
}

async function createDirectSnapshot() {
  const source = window.PRECOMPUTED_GRAPH_DATA;
  if (!Array.isArray(source?.nodes) || !source.nodes.length || !Array.isArray(source.links)) {
    throw new Error("Graph data could not be loaded.");
  }
  elements.loadingDetail.textContent = "Running one temporary layout worker for every study…";
  const initialConfig = resolveInitialGraphConfig();
  const rawIds = new Set(source.nodes.map((node) => String(node.id)));
  const links = source.links.map((link, index) => ({
    id: String(link.id ?? `link:${index}`),
    source: nodeId(link.sourceId ?? link.source),
    target: nodeId(link.targetId ?? link.target),
    type: String(link.type ?? "wiki")
  })).filter((link) => rawIds.has(link.source) && rawIds.has(link.target) && link.source !== link.target);
  const connectedIds = new Set(links.flatMap((link) => [link.source, link.target]));
  const degrees = calculateDegrees(links);
  const folders = [...new Set(source.nodes.map((node) => String(node.folder || folderFromPath(node.path))))]
    .filter((folder) => folder && folder !== "99 Inbox")
    .slice(0, 8);
  const folderIndices = new Map(folders.map((folder, index) => [folder, index]));
  const nodes = source.nodes.filter((node) => connectedIds.has(String(node.id))).map((rawNode) => {
    const id = String(rawNode.id);
    const degree = degrees.get(id) ?? 0;
    const folder = String(rawNode.folder || folderFromPath(rawNode.path));
    const naturalRadius = clamp(2.6 + Math.sqrt(degree) * 0.7, 2.25, 7.2);
    return {
      id,
      name: String(rawNode.name ?? id),
      type: "note",
      degree,
      naturalRadius,
      radius: nodeRadius({ type: "note", naturalRadius }, initialConfig),
      groupIndex: folderIndices.get(folder) ?? -1,
      x: 0,
      y: 0
    };
  });
  const positions = await runSharedLayout(nodes, links, initialConfig);
  nodes.forEach((node, index) => {
    node.x = positions[index * 2];
    node.y = positions[index * 2 + 1];
  });
  const viewport = {
    ...DIRECT_VIEWPORT,
    dpr: Math.min(window.devicePixelRatio || 1, 2)
  };
  return {
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    source: "generated",
    graph: { mode: "global", nodes, links },
    camera: fitCamera(nodes, viewport),
    viewport,
    config: initialConfig,
    slots: normalizeSlots(loadComparisonSlots())
  };
}

function runSharedLayout(nodes, links, config) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./graph-worker.js", import.meta.url), { type: "module" });
    let latestPositions = null;
    let completed = false;
    const finish = (callback, value) => {
      if (completed) return;
      completed = true;
      window.clearTimeout(timeout);
      worker.terminate();
      callback(value);
    };
    const timeout = window.setTimeout(() => {
      if (latestPositions) finish(resolve, latestPositions);
      else finish(reject, new Error("The shared graph layout did not return positions."));
    }, 20000);
    worker.addEventListener("message", ({ data }) => {
      if (data.revision !== 1) return;
      if (data.type === "ready" && data.protocolVersion !== WORKER_PROTOCOL_VERSION) {
        finish(reject, new Error("The graph layout protocol is incompatible."));
      } else if (data.type === "positions") {
        latestPositions = new Float32Array(data.positions);
        if (data.frame && data.frame % 120 === 0) elements.loadingDetail.textContent = `Solving one shared layout · frame ${data.frame.toLocaleString()}…`;
      } else if (data.type === "status" && data.status === "settled" && latestPositions) {
        finish(resolve, latestPositions);
      }
    });
    worker.addEventListener("error", () => finish(reject, new Error("The shared graph layout worker failed.")));
    worker.postMessage({
      type: "init",
      revision: 1,
      nodes: nodes.map((node) => ({
        id: node.id,
        radius: node.radius * config.nodeStyle.scale,
        pinned: false,
        anchored: false
      })),
      links,
      forces: config.layout,
      sharedBuffer: null,
      controlBuffer: null
    });
  });
}

function buildCandidates(snapshot) {
  const candidates = [];
  const add = (id, label, kind, config) => {
    if (!config || candidates.some((candidate) => candidate.id === id)) return;
    candidates.push({ id, label, kind, config: normalizeGraphConfig(config) });
  };
  add("snapshot:current", `Current · ${configDisplayName(snapshot.config)}`, "Current graph", snapshot.config);
  add("snapshot:slot-a", snapshot.slots.a ? `Slot A · ${configDisplayName(snapshot.slots.a)}` : "", "Quick compare A", snapshot.slots.a);
  add("snapshot:slot-b", snapshot.slots.b ? `Slot B · ${configDisplayName(snapshot.slots.b)}` : "", "Quick compare B", snapshot.slots.b);
  for (const preset of listPresets()) {
    add(`preset:${preset.id}`, preset.name, preset.id.startsWith("user:") ? "Saved study" : "Built-in", preset);
  }
  return candidates;
}

function chooseDefaultStudies(snapshot, candidates) {
  if (snapshot.slots.a && snapshot.slots.b) return ["snapshot:slot-a", "snapshot:slot-b"];
  if (snapshot.slots.a || snapshot.slots.b) return ["snapshot:current", snapshot.slots.a ? "snapshot:slot-a" : "snapshot:slot-b"];
  return builtinThemeIds(candidates);
}

function builtinThemeIds(candidates) {
  const ids = Object.keys(THEMES).map((themeId) => `preset:builtin:${themeId}`).filter((id) => candidates.some((candidate) => candidate.id === id));
  return ids.slice(0, 4);
}

function fillSelectedStudies() {
  const available = state.candidates.map((candidate) => candidate.id);
  while (state.selectedIds.length < state.cardCount) {
    state.selectedIds.push(available.find((id) => !state.selectedIds.includes(id)) ?? available[0]);
  }
  state.selectedIds.length = state.cardCount;
}

function renderComparison() {
  fillSelectedStudies();
  elements.grid.dataset.count = String(state.cardCount);
  elements.grid.replaceChildren(...state.selectedIds.map((id, index) => createCard(id, index)));
  renderCanvases();
}

function createCard(candidateId, index) {
  const candidate = findCandidate(candidateId);
  const config = candidate.config;
  const visual = resolveVisualConfig(config);
  const card = document.createElement("article");
  card.className = "comparison-card";
  card.dataset.cardIndex = String(index);
  card.dataset.theme = config.theme.id;
  card.dataset.material = config.nodeStyle.materialId;
  card.dataset.vignette = String(config.display.vignette);
  card.dataset.nodeCount = String(state.snapshot.graph.nodes.length);
  card.dataset.linkCount = String(state.snapshot.graph.links.length);
  card.dataset.coordinateKey = coordinateKey(state.snapshot.graph.nodes);
  card.dataset.cameraKey = cameraKey(state.snapshot.camera, state.snapshot.viewport);
  card.style.setProperty("--surface", visual.canvasBackground);
  card.style.setProperty("--card-accent", visual.palette[0]);
  card.style.setProperty("--viewport-ratio", String(state.snapshot.viewport.width / state.snapshot.viewport.height));

  const bar = document.createElement("header");
  bar.className = "study-bar";
  const number = document.createElement("span");
  number.className = "study-number";
  number.textContent = `0${index + 1}`;
  const title = document.createElement("div");
  title.className = "study-title";
  const name = document.createElement("strong");
  name.textContent = configDisplayName(config);
  const kind = document.createElement("span");
  kind.textContent = candidate.kind;
  title.append(name, kind);
  const select = document.createElement("select");
  select.className = "study-select";
  select.dataset.cardIndex = String(index);
  select.setAttribute("aria-label", `Configuration for study ${index + 1}`);
  select.append(...candidateOptions(candidate.id));
  bar.append(number, title, select);

  const surface = document.createElement("div");
  surface.className = "preview-surface";
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${configDisplayName(config)}, static graph preview with ${state.snapshot.graph.nodes.length} nodes and ${state.snapshot.graph.links.length} links`);
  const vignette = document.createElement("div");
  vignette.className = "preview-vignette";
  vignette.setAttribute("aria-hidden", "true");
  surface.append(canvas, vignette);

  const meta = document.createElement("footer");
  meta.className = "study-meta";
  meta.append(
    metaItem("Theme", THEMES[config.theme.id].shortName),
    metaItem("Nodes", `${nodeMappingName(config)} · ${MATERIALS[config.nodeStyle.materialId].name}`),
    metaItem("Edges", `${config.edgeStyle.colorMode === "fixed" ? "Custom" : "Theme"} · ${config.edgeStyle.thickness.toFixed(2)}× · ${(visual.edgeAlpha * 100).toFixed(0)}%`)
  );
  card.append(bar, surface, meta);
  return card;
}

function renderCard(index) {
  const previous = elements.grid.querySelector(`[data-card-index="${index}"]`);
  const replacement = createCard(state.selectedIds[index], index);
  previous?.replaceWith(replacement);
  drawCard(replacement, findCandidate(state.selectedIds[index]).config);
}

function renderCanvases() {
  elements.grid.querySelectorAll(".comparison-card").forEach((card, index) => {
    const candidate = findCandidate(state.selectedIds[index]);
    if (candidate) drawCard(card, candidate.config);
  });
}

function drawCard(card, configValue) {
  const canvas = $("canvas", card);
  const config = normalizeGraphConfig(configValue);
  const visual = resolveVisualConfig(config);
  const { width, height, dpr } = state.snapshot.viewport;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const context = canvas.getContext("2d", { alpha: true });
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const nodes = state.snapshot.graph.nodes.map((node) => ({
    ...node,
    radius: nodeRadius(node, config),
    color: nodeColor(node, config, visual)
  }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  drawLinks(context, nodeById, state.snapshot.graph.links, config, visual, state.snapshot.camera);
  drawNodes(context, nodes, config, visual, state.snapshot.camera);
  drawLabels(context, nodes, state.snapshot.graph.links, config, visual, state.snapshot.camera, state.snapshot.viewport);
}

function drawLinks(context, nodeById, links, config, visual, camera) {
  context.save();
  context.lineCap = "round";
  for (const link of links) {
    const source = nodeById.get(link.source);
    const target = nodeById.get(link.target);
    if (!source || !target) continue;
    const a = worldToScreen(source, camera);
    const b = worldToScreen(target, camera);
    if (visual.material) {
      context.strokeStyle = colorWithAlpha(visual.edgeUnderlay, visual.edgeUnderlayAlpha);
      context.lineWidth = visual.edgeUnderlayWidth * config.edgeStyle.thickness;
      strokeLine(context, a, b);
    }
    context.strokeStyle = colorWithAlpha(visual.link, visual.edgeAlpha);
    context.lineWidth = Math.max(0.35, config.edgeStyle.thickness * (visual.material ? visual.edgeMainWidth : 0.62));
    strokeLine(context, a, b);
    if (config.edgeStyle.arrows && camera.scale > 1.35) drawArrow(context, a, b, target.radius * config.nodeStyle.scale * camera.scale, visual);
  }
  context.restore();
}

function drawNodes(context, nodes, config, visual, camera) {
  context.save();
  for (const node of nodes) {
    const point = worldToScreen(node, camera);
    const radius = Math.max(1.15, node.radius * config.nodeStyle.scale * camera.scale);
    const alpha = node.type === "orphan" ? 0.48 : visual.nodeAlpha;
    if (visual.material) {
      const offset = materialOffset(node.id, radius * visual.auraOffset);
      if (visual.auraAlpha > 0) {
        context.fillStyle = colorWithAlpha(node.color, alpha * visual.auraAlpha);
        drawNodeShape(context, node, point.x + offset.x, point.y + offset.y, radius * visual.auraScale);
        context.fill();
      }
      context.strokeStyle = colorWithAlpha(visual.rimColor, alpha * visual.rimAlpha);
      context.lineWidth = Math.max(0.45, visual.rimWidth);
      drawNodeShape(context, node, point.x, point.y, radius + visual.rimWidth);
      context.stroke();
      if (node.type === "unresolved") {
        context.strokeStyle = colorWithAlpha(node.color, alpha * visual.nodeFillAlpha);
        context.lineWidth = Math.max(0.65, visual.keylineWidth);
        drawNodeShape(context, node, point.x, point.y, radius);
        context.stroke();
      } else {
        context.fillStyle = colorWithAlpha(node.color, alpha * visual.nodeFillAlpha);
        drawNodeShape(context, node, point.x, point.y, radius);
        context.fill();
        context.strokeStyle = colorWithAlpha(visual.keylineColor, alpha * visual.keylineAlpha);
        context.lineWidth = Math.max(0.45, visual.keylineWidth);
        drawNodeShape(context, node, point.x, point.y, Math.max(1, radius - visual.keylineWidth * 0.5));
        context.stroke();
        if (radius >= 3.2 && visual.coreAlpha > 0) {
          context.fillStyle = colorWithAlpha(visual.coreColor, alpha * visual.coreAlpha);
          context.beginPath();
          context.arc(
            point.x + radius * visual.coreOffsetX,
            point.y + radius * visual.coreOffsetY,
            Math.max(0.55, radius * visual.coreScale),
            0,
            Math.PI * 2
          );
          context.fill();
        }
      }
    } else if (node.type === "attachment") {
      context.fillStyle = colorWithAlpha(node.color, alpha * 0.78);
      drawNodeShape(context, node, point.x, point.y, radius);
      context.fill();
    } else if (node.type === "unresolved") {
      context.strokeStyle = colorWithAlpha(node.color, alpha * 0.82);
      context.lineWidth = 1;
      drawNodeShape(context, node, point.x, point.y, radius);
      context.stroke();
    } else {
      context.fillStyle = colorWithAlpha(node.color, node.type === "tag" ? alpha * 0.86 : alpha);
      drawNodeShape(context, node, point.x, point.y, radius);
      context.fill();
    }
  }
  context.restore();
}

function drawLabels(context, nodes, links, config, visual, camera, viewport) {
  const degree = calculateDegrees(links);
  const threshold = labelThreshold(config);
  const candidates = nodes.map((node) => {
    const typeBonus = node.type === "tag" ? 0.7 : node.type === "note" ? 0.6 : node.type === "attachment" ? 0.42 : node.type === "unresolved" ? 0.36 : 0.28;
    const importance = Math.min(1, (degree.get(node.id) ?? 0) / 12) * 0.8 + typeBonus * 0.2;
    return { node, importance };
  }).filter(({ importance }) => importance + Math.max(0, Math.log2(camera.scale + 0.3)) * 0.22 >= threshold)
    .sort((a, b) => b.importance - a.importance || a.node.id.localeCompare(b.node.id));
  const limit = Math.max(12, Math.ceil(nodes.length * Math.min(0.22, 0.11 + camera.scale * 0.07)));
  const occupied = [];
  let used = 0;
  context.save();
  context.textBaseline = "middle";
  for (const { node } of candidates) {
    if (used >= limit) break;
    const point = worldToScreen(node, camera);
    if (point.x < -80 || point.x > viewport.width + 80 || point.y < -30 || point.y > viewport.height + 30) continue;
    const fontSize = Math.min(10.5, 8.2 + camera.scale * 1.15) * visual.labelSize;
    context.font = `400 ${fontSize}px ${visual.fontFamily}`;
    const label = truncate(node.name, camera.scale > 1.35 ? 38 : 27);
    const radius = Math.max(1.15, node.radius * config.nodeStyle.scale * camera.scale);
    const rect = {
      x: point.x + radius + 4,
      y: point.y - fontSize / 2 - 1,
      width: context.measureText(label).width + 3,
      height: fontSize + 2
    };
    if (occupied.some((other) => rectanglesOverlap(rect, other))) continue;
    occupied.push(rect);
    context.fillStyle = colorWithAlpha(visual.label, visual.labelAlpha);
    context.fillText(label, rect.x, point.y + 0.3);
    used += 1;
  }
  context.restore();
}

function nodeRadius(node, config) {
  if (config.nodeStyle.sizeMode !== "fixed") return node.naturalRadius;
  return node.type === "note" ? 3.5 : node.type === "tag" ? 3.2 : node.type === "attachment" ? 2.7 : 2.5;
}

function nodeColor(node, config, visual) {
  if (config.nodeStyle.colorMode === "fixed") return config.nodeStyle.color;
  if (config.nodeStyle.colorMode === "type") return visual.syntheticColors[node.type] ?? visual.palette[typeColorIndex(node.type) % visual.palette.length];
  if (node.type !== "note") return visual.syntheticColors[node.type] ?? visual.mutedNode;
  return node.groupIndex >= 0 ? visual.palette[node.groupIndex % visual.palette.length] : visual.mutedNode;
}

function nodeMappingName(config) {
  const color = config.nodeStyle.colorMode === "fixed" ? "Fixed" : config.nodeStyle.colorMode === "type" ? "Type" : "Group";
  const size = config.nodeStyle.sizeMode === "fixed" ? "fixed" : "degree";
  return `${color}/${size}`;
}

function candidateOptions(selectedId) {
  return state.candidates.map((candidate) => {
    const option = document.createElement("option");
    option.value = candidate.id;
    option.textContent = candidate.label;
    option.selected = candidate.id === selectedId;
    return option;
  });
}

function metaItem(label, value) {
  const item = document.createElement("div");
  const name = document.createElement("span");
  name.textContent = label;
  const detail = document.createElement("strong");
  detail.textContent = value;
  item.append(name, detail);
  return item;
}

function findCandidate(id) {
  return state.candidates.find((candidate) => candidate.id === id) ?? state.candidates[0];
}

function updateSnapshotStatus(sourceType) {
  const { nodes, links } = state.snapshot.graph;
  const { width, height, dpr } = state.snapshot.viewport;
  elements.snapshotStatus.textContent = sourceType === "live" ? "Live studio snapshot locked" : "Single shared layout locked";
  elements.snapshotDetail.textContent = `${nodes.length.toLocaleString()} nodes · ${links.length.toLocaleString()} links · ${Math.round(width)}×${Math.round(height)} @ ${formatNumber(dpr)}×`;
  elements.footnote.textContent = sourceType === "live"
    ? "Captured from the active studio without changing its graph state."
    : "Direct entry used one temporary worker, then terminated it before rendering.";
}

function fitCamera(nodes, viewport) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }
  const graphWidth = Math.max(80, maxX - minX);
  const graphHeight = Math.max(80, maxY - minY);
  const scale = Math.max(0.22, Math.min(2.4, Math.min((viewport.width - 100) / graphWidth, (viewport.height - 100) / graphHeight) * 0.91));
  return {
    scale,
    x: viewport.width / 2 - (minX + maxX) / 2 * scale,
    y: viewport.height / 2 - (minY + maxY) / 2 * scale
  };
}

function normalizeSlots(value) {
  return {
    a: value?.a ? normalizeGraphConfig(value.a) : null,
    b: value?.b ? normalizeGraphConfig(value.b) : null
  };
}

function calculateDegrees(links) {
  const degree = new Map();
  for (const link of links) {
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
  }
  return degree;
}

function folderFromPath(path = "") {
  return String(path).split("/")[0] || "Inbox";
}

function normalizeNodeType(value) {
  return ["note", "tag", "attachment", "unresolved", "orphan"].includes(value) ? value : "note";
}

function typeColorIndex(type) {
  return type === "note" ? 0 : type === "tag" ? 1 : type === "attachment" ? 2 : type === "unresolved" ? 3 : 4;
}

function labelThreshold(config) {
  const offset = config.display.labelDensity === "quiet" ? 0.16 : config.display.labelDensity === "dense" ? -0.16 : 0;
  return clamp(config.display.textFade + offset, 0, 1);
}

function worldToScreen(node, camera) {
  return { x: node.x * camera.scale + camera.x, y: node.y * camera.scale + camera.y };
}

function strokeLine(context, source, target) {
  context.beginPath();
  context.moveTo(source.x, source.y);
  context.lineTo(target.x, target.y);
  context.stroke();
}

function drawArrow(context, source, target, nodeRadius, visual) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 14) return;
  const ux = dx / distance;
  const uy = dy / distance;
  const tipX = target.x - ux * (nodeRadius + 2);
  const tipY = target.y - uy * (nodeRadius + 2);
  const size = 3.2;
  context.fillStyle = colorWithAlpha(visual.arrow, Math.min(0.7, visual.edgeAlpha + 0.14));
  context.beginPath();
  context.moveTo(tipX, tipY);
  context.lineTo(tipX - ux * size - uy * size * 0.72, tipY - uy * size + ux * size * 0.72);
  context.lineTo(tipX - ux * size + uy * size * 0.72, tipY - uy * size - ux * size * 0.72);
  context.closePath();
  context.fill();
}

function drawNodeShape(context, node, x, y, radius) {
  context.beginPath();
  if (node.type === "attachment") {
    const size = radius * 1.42;
    context.rect(x - size / 2, y - size / 2, size, size);
  } else if (node.type === "tag") {
    for (let corner = 0; corner < 6; corner += 1) {
      const angle = Math.PI / 3 * corner;
      const cornerX = x + Math.cos(angle) * radius;
      const cornerY = y + Math.sin(angle) * radius;
      if (corner === 0) context.moveTo(cornerX, cornerY);
      else context.lineTo(cornerX, cornerY);
    }
    context.closePath();
  } else {
    context.arc(x, y, radius, 0, Math.PI * 2);
  }
}

function materialOffset(id, amount) {
  if (!amount) return { x: 0, y: 0 };
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  const angle = (hash >>> 0) / 0xffffffff * Math.PI * 2;
  return { x: Math.cos(angle) * amount, y: Math.sin(angle) * amount };
}

function rectanglesOverlap(a, b) {
  return a.x < b.x + b.width + 4 && a.x + a.width + 4 > b.x && a.y < b.y + b.height + 2 && a.y + a.height + 2 > b.y;
}

function truncate(value, length) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function colorWithAlpha(color, alpha) {
  if (String(color).startsWith("rgba")) return color;
  const hex = String(color).replace("#", "");
  const normalized = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  const value = Number.parseInt(normalized, 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${clamp(alpha, 0, 1)})`;
}

function coordinateKey(nodes) {
  let hash = 2166136261;
  for (const node of nodes) {
    const value = `${node.id}:${node.x.toFixed(3)}:${node.y.toFixed(3)}`;
    for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function cameraKey(camera, viewport) {
  return [camera.x, camera.y, camera.scale, viewport.width, viewport.height, viewport.dpr].map((value) => Number(value).toFixed(3)).join(":");
}

function nodeId(value) {
  return typeof value === "object" && value ? String(value.id) : String(value ?? "");
}

function finiteNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, minimum, maximum) : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatNumber(value) {
  return Number(value).toFixed(Number.isInteger(Number(value)) ? 0 : 1);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
}
