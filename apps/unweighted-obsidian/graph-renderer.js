import { Application, BitmapText, Container, Graphics } from "pixi.js";

const LABEL_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, 1],
  [0.72, -0.72],
  [0.72, 0.72]
];

export async function createGraphRenderer(host, interactionCanvas) {
  const renderer = new GraphRenderer(host, interactionCanvas);
  await renderer.initialize();
  return renderer;
}

class GraphRenderer {
  constructor(host, interactionCanvas) {
    this.host = host;
    this.interactionCanvas = interactionCanvas;
    this.app = new Application();
    this.cameraRoot = new Container();
    this.linksLayer = new Container();
    this.arrowsLayer = new Container();
    this.nodesLayer = new Container();
    this.emphasisLayer = new Container();
    this.labelsLayer = new Container();
    this.linksGraphics = new Graphics();
    this.arrowsGraphics = new Graphics();
    this.nodesGraphics = new Graphics();
    this.emphasisGraphics = new Graphics();
    this.labelPool = [];
    this.labelPlacements = new Map();
    this.lastPlacementScale = 0;
    this.graphKey = "";
    this.baseCandidatesKey = "";
    this.baseCandidates = [];
    this.searchCacheKey = "";
    this.searchMatches = null;
    this.searchTextById = new Map();
    this.backend = "WebGL";
  }

  async initialize() {
    const bounds = this.host.getBoundingClientRect();
    await this.app.init({
      preference: "webgl",
      antialias: true,
      autoStart: false,
      backgroundAlpha: 0,
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true
    });

    this.app.canvas.className = "pixi-graph-canvas";
    this.app.canvas.setAttribute("aria-hidden", "true");
    this.host.insertBefore(this.app.canvas, this.interactionCanvas);
    this.linksLayer.addChild(this.linksGraphics);
    this.arrowsLayer.addChild(this.arrowsGraphics);
    this.nodesLayer.addChild(this.nodesGraphics);
    this.emphasisLayer.addChild(this.emphasisGraphics);
    this.cameraRoot.addChild(this.linksLayer, this.arrowsLayer, this.nodesLayer, this.emphasisLayer, this.labelsLayer);
    this.app.stage.addChild(this.cameraRoot);
    this.backend = this.app.renderer.type === 1 ? "WebGL" : this.app.renderer.type === 2 ? "WebGPU" : "Canvas";
    this.interactionCanvas.classList.add("is-interaction-layer");
  }

  render(state) {
    const { camera } = state;
    this.cameraRoot.position.set(camera.x, camera.y);
    this.cameraRoot.scale.set(camera.scale);
    this.prepareCaches(state);
    this.drawLinks(state);
    this.drawNodes(state);
    this.drawLabels(state);
    this.app.renderer.render(this.app.stage);
  }

  resize(width, height, resolution) {
    this.app.renderer.resolution = resolution;
    this.app.renderer.resize(Math.max(1, width), Math.max(1, height));
  }

  clear() {
    this.linksGraphics.clear();
    this.arrowsGraphics.clear();
    this.nodesGraphics.clear();
    this.emphasisGraphics.clear();
    for (const label of this.labelPool) label.visible = false;
    this.labelPlacements.clear();
    this.graphKey = "";
    this.lastPlacementScale = 0;
    this.baseCandidatesKey = "";
    this.baseCandidates = [];
    this.searchCacheKey = "";
    this.searchMatches = null;
    this.searchTextById.clear();
    this.app.renderer.render(this.app.stage);
  }

  destroy() {
    this.app.destroy(true, { children: true, texture: true });
  }

  prepareCaches(state) {
    const revisionKey = `${state.workerRevision}:${state.visibleNodes.length}`;
    if (revisionKey !== this.baseCandidatesKey) {
      this.searchTextById.clear();
      this.baseCandidates = state.visibleNodes.map((node) => {
        const degree = (state.incoming.get(node.id) ?? 0) + (state.outgoing.get(node.id) ?? 0);
        const typeBonus = node.type === "tag" ? 0.7 : node.type === "note" ? 0.6 : node.type === "attachment" ? 0.42 : node.type === "unresolved" ? 0.36 : 0.28;
        const importance = Math.min(1, degree / 12) * 0.8 + typeBonus * 0.2;
        this.searchTextById.set(node.id, buildSearchText(node));
        return { node, importance };
      }).sort((a, b) => b.importance - a.importance || String(a.node.id).localeCompare(String(b.node.id)));
      this.baseCandidatesKey = revisionKey;
      this.searchCacheKey = "";
    }

    const normalizedQuery = state.quickQuery.trim().toLowerCase();
    const searchKey = `${revisionKey}:${normalizedQuery}`;
    if (searchKey !== this.searchCacheKey) {
      this.searchMatches = normalizedQuery
        ? new Set(this.baseCandidates.filter(({ node }) => this.searchTextById.get(node.id)?.includes(normalizedQuery)).map(({ node }) => node.id))
        : null;
      this.searchCacheKey = searchKey;
    }
  }

  drawLinks(state) {
    const normal = this.linksGraphics.clear();
    const emphasis = this.emphasisGraphics.clear();
    const arrows = this.arrowsGraphics.clear();
    const focusId = state.hoveredId ?? state.selectedId;
    const nodeById = state.visibleById;
    let hasNormal = false;
    let hasEmphasis = false;
    let hasArrows = false;

    for (const link of state.visibleLinks) {
      const source = nodeById.get(link.source);
      const target = nodeById.get(link.target);
      if (!source || !target) continue;
      const connected = focusId && (link.source === focusId || link.target === focusId);
      const graphics = connected ? emphasis : normal;
      graphics.moveTo(source.x, source.y).lineTo(target.x, target.y);
      if (connected) hasEmphasis = true;
      else hasNormal = true;

      if (state.arrows && (connected || state.camera.scale > 1.35)) {
        drawArrow(arrows, source, target, target.radius * state.nodeScale, state.camera.scale);
        hasArrows = true;
      }
    }

    const inverseScale = 1 / Math.max(0.18, state.camera.scale);
    if (hasNormal) {
      normal.stroke({
        color: 0x868581,
        alpha: focusId ? 0.018 : 0.115,
        width: Math.max(0.36, state.linkThickness * 0.62) * inverseScale,
        cap: "round"
      });
    }
    if (hasEmphasis) {
      emphasis.stroke({
        color: 0xc2bad3,
        alpha: 0.62,
        width: state.linkThickness * 1.16 * inverseScale,
        cap: "round"
      });
    }
    if (hasArrows) arrows.fill({ color: 0xaaa5b0, alpha: focusId ? 0.7 : 0.3 });
  }

  drawNodes(state) {
    const nodes = this.nodesGraphics.clear();
    const emphasis = this.emphasisGraphics;
    const focusId = state.hoveredId ?? state.selectedId;
    const focusNeighbors = focusId ? state.adjacency.get(focusId) ?? new Set() : null;
    const searchMatches = this.searchMatches;

    for (const node of state.visibleNodes) {
      const focused = node.id === focusId;
      const selected = node.id === state.selectedId;
      const neighbor = focusNeighbors?.has(node.id);
      const searchMatch = searchMatches?.has(node.id);
      const faded = focusId && !focused && !neighbor;
      const searchFaded = searchMatches?.size && !searchMatch;
      const alpha = faded ? 0.12 : searchFaded ? 0.17 : node.type === "orphan" ? 0.48 : 0.86;
      const radius = Math.max(1.1 / state.camera.scale, node.radius * state.nodeScale);

      if (node.type === "attachment") {
        const size = radius * 1.42;
        nodes.rect(node.x - size / 2, node.y - size / 2, size, size).fill({ color: node.color, alpha: alpha * 0.78 });
      } else if (node.type === "unresolved") {
        nodes.circle(node.x, node.y, radius).stroke({ color: node.color, alpha: alpha * 0.82, width: 1 / state.camera.scale });
      } else if (node.type === "tag") {
        nodes.regularPoly(node.x, node.y, radius, 6).fill({ color: node.color, alpha: alpha * 0.86 });
      } else {
        nodes.circle(node.x, node.y, radius).fill({ color: node.color, alpha });
      }

      if (focused || selected || searchMatch) {
        emphasis.circle(node.x, node.y, radius * (selected ? 2.25 : 1.9) + 2 / state.camera.scale)
          .fill({ color: node.color, alpha: selected ? 0.13 : 0.09 });
      }
      if (selected || state.pinned.has(node.id)) {
        emphasis.circle(node.x, node.y, radius + 2.6 / state.camera.scale).stroke({
          color: selected ? 0xe5dffc : 0xb0a3ce,
          alpha: selected ? 0.78 : 0.52,
          width: (selected ? 1.15 : 0.8) / state.camera.scale
        });
      }
    }
  }

  drawLabels(state) {
    const nodeScaleBucket = Math.round(state.nodeScale * 8);
    const viewportBucket = `${Math.round(state.width / 160)}:${Math.round(state.height / 120)}`;
    const graphKey = `${state.workerRevision}:${state.visibleNodes.length}:${nodeScaleBucket}:${viewportBucket}`;
    const scaleChanged = Math.abs(Math.log2(Math.max(0.01, state.camera.scale) / Math.max(0.01, this.lastPlacementScale))) > 0.16;
    if (graphKey !== this.graphKey || scaleChanged) {
      this.labelPlacements.clear();
      this.graphKey = graphKey;
      this.lastPlacementScale = state.camera.scale;
    }

    const candidates = this.buildLabelCandidates(state);
    const labelLimit = Math.max(12, Math.ceil(state.visibleNodes.length * Math.min(0.22, 0.11 + state.camera.scale * 0.07)));
    const grid = new LabelGrid(84, 24);
    let used = 0;
    for (const candidate of candidates) {
      if (used >= labelLimit && candidate.priority < 8) break;
      const { node, priority } = candidate;
      const point = {
        x: node.x * state.camera.scale + state.camera.x,
        y: node.y * state.camera.scale + state.camera.y
      };
      if (point.x < -80 || point.x > state.width + 80 || point.y < -30 || point.y > state.height + 30) continue;

      const label = truncate(node.name, priority >= 8 ? 55 : state.camera.scale > 1.35 ? 38 : 27);
      const fontSize = priority >= 8 ? 11.5 : Math.min(10.5, 8.2 + state.camera.scale * 1.15);
      const width = estimateLabelWidth(label, fontSize);
      const height = fontSize + 3;
      const nodeRadius = Math.max(2, node.radius * state.nodeScale * state.camera.scale);
      const cached = this.labelPlacements.get(node.id);
      const attempts = cached === undefined
        ? LABEL_OFFSETS.map((_, index) => index)
        : [cached, ...LABEL_OFFSETS.map((_, index) => index).filter((index) => index !== cached)];
      let placement = null;

      for (const index of attempts) {
        const rect = labelRect(point, width, height, nodeRadius, index);
        if (priority < 8 && grid.overlaps(rect)) continue;
        placement = { index, rect };
        break;
      }
      if (!placement) continue;

      this.labelPlacements.set(node.id, placement.index);
      grid.add(placement.rect);
      const text = this.acquireLabel(used);
      text.text = label;
      text.style.fontSize = fontSize;
      text.style.fill = priority >= 8 ? 0xe7e3eb : 0xb4b0ab;
      const focusId = state.hoveredId ?? state.selectedId;
      text.alpha = priority >= 8 ? 0.94 : focusId && node.id !== focusId && !state.adjacency.get(focusId)?.has(node.id) ? 0.08 : 0.55;
      text.position.set(
        (placement.rect.x - state.camera.x) / state.camera.scale,
        (placement.rect.y + height / 2 - state.camera.y) / state.camera.scale
      );
      text.scale.set(1 / state.camera.scale);
      text.anchor.set(0, 0.5);
      text.visible = true;
      used += 1;
    }

    for (let index = used; index < this.labelPool.length; index += 1) this.labelPool[index].visible = false;
  }

  buildLabelCandidates(state) {
    const candidates = [];
    const added = new Set();
    const addPriority = (id, priority) => {
      if (!id || added.has(id)) return;
      const node = state.visibleById.get(id);
      if (!node) return;
      candidates.push({ node, importance: 0, priority });
      added.add(id);
    };

    addPriority(state.hoveredId, 10);
    addPriority(state.selectedId, 10);
    if (this.searchMatches) {
      for (const { node } of this.baseCandidates) {
        if (this.searchMatches.has(node.id)) addPriority(node.id, 9);
      }
    }
    if (state.mode === "local") addPriority(state.localRoot, 8);

    const zoomBonus = Math.max(0, Math.log2(state.camera.scale + 0.3)) * 0.22;
    for (const candidate of this.baseCandidates) {
      if (added.has(candidate.node.id) || candidate.importance + zoomBonus < state.textFade) continue;
      candidates.push({ ...candidate, priority: candidate.importance });
    }
    return candidates;
  }

  acquireLabel(index) {
    if (!this.labelPool[index]) {
      const label = new BitmapText({
        text: "",
        style: {
          fontFamily: "Segoe UI Variable Text",
          fontSize: 10,
          fill: 0xb4b0ab
        }
      });
      label.eventMode = "none";
      this.labelPool.push(label);
      this.labelsLayer.addChild(label);
    }
    return this.labelPool[index];
  }
}

function drawArrow(graphics, source, target, radius, scale) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy);
  if (distance * scale < 14) return;
  const ux = dx / distance;
  const uy = dy / distance;
  const tipX = target.x - ux * (radius + 2 / scale);
  const tipY = target.y - uy * (radius + 2 / scale);
  const size = 3.2 / scale;
  graphics.poly([
    tipX,
    tipY,
    tipX - ux * size - uy * size * 0.72,
    tipY - uy * size + ux * size * 0.72,
    tipX - ux * size + uy * size * 0.72,
    tipY - uy * size - ux * size * 0.72
  ]);
}

function buildSearchText(node) {
  return [node.name, node.path, node.folder, node.type, ...(node.tags ?? []), ...(node.aliases ?? [])].join(" ").toLowerCase();
}

function truncate(value, length) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function estimateLabelWidth(value, fontSize) {
  let units = 0;
  for (const character of value) units += character.charCodeAt(0) > 255 ? 1 : 0.56;
  return units * fontSize + 3;
}

function labelRect(point, width, height, radius, index) {
  const [dx, dy] = LABEL_OFFSETS[index];
  const gap = radius + 4;
  let x = point.x + dx * gap;
  let y = point.y + dy * gap - height / 2;
  if (dx < 0) x -= width;
  else if (dx === 0) x -= width / 2;
  if (dy > 0) y += height / 2;
  if (dy < 0) y -= height / 2;
  return { x, y, width, height };
}

class LabelGrid {
  constructor(cellWidth, cellHeight) {
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.cells = new Map();
  }

  overlaps(rect) {
    for (const key of this.keys(rect)) {
      for (const other of this.cells.get(key) ?? []) {
        if (rect.x < other.x + other.width + 4 && rect.x + rect.width + 4 > other.x && rect.y < other.y + other.height + 2 && rect.y + rect.height + 2 > other.y) return true;
      }
    }
    return false;
  }

  add(rect) {
    for (const key of this.keys(rect)) {
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(rect);
    }
  }

  keys(rect) {
    const keys = [];
    const minX = Math.floor(rect.x / this.cellWidth);
    const maxX = Math.floor((rect.x + rect.width) / this.cellWidth);
    const minY = Math.floor(rect.y / this.cellHeight);
    const maxY = Math.floor((rect.y + rect.height) / this.cellHeight);
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) keys.push(`${x}:${y}`);
    }
    return keys;
  }
}
