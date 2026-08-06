import { Application, BitmapText, Container, Graphics } from "pixi.js";
import { resolveLinkStroke, weightChannelEnabled } from "./graph-semantics.js";

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
    this.app.renderer.render(this.app.stage);
  }

  destroy() {
    this.app.destroy(true, { children: true, texture: true });
  }

  drawLinks(state) {
    const normal = this.linksGraphics.clear();
    const emphasis = this.emphasisGraphics.clear();
    const arrows = this.arrowsGraphics.clear();
    const focusId = state.hoveredId;
    const nodeById = state.visibleById;
    const weightAffectsEdgeStyle = weightChannelEnabled(state.semantics, "weightAffectsEdgeStyle");
    const strokes = new Map();
    const arrowStyles = new Map();

    for (const link of state.visibleLinks) {
      const source = nodeById.get(link.source);
      const target = nodeById.get(link.target);
      if (!source || !target) continue;
      const sourceProgress = revealProgress(source, state);
      const targetProgress = revealProgress(target, state);
      const progress = Math.min(sourceProgress, targetProgress);
      if (progress <= 0) continue;
      const connected = Boolean(focusId && (link.source === focusId || link.target === focusId));
      const stroke = resolveLinkStroke(link, {
        weightAffectsEdgeStyle,
        connected,
        faded: Boolean(focusId && !connected),
        thickness: state.linkThickness
      });
      const key = `${connected ? "focus" : "normal"}:${stroke.key}`;
      if (!strokes.has(key)) strokes.set(key, { ...stroke, connected, segments: [] });
      strokes.get(key).segments.push({ source, target });

      if (state.arrows && (connected || state.camera.scale > 1.35)) {
        const arrowKey = stroke.arrowAlpha.toFixed(4);
        if (!arrowStyles.has(arrowKey)) arrowStyles.set(arrowKey, { alpha: stroke.arrowAlpha, segments: [] });
        arrowStyles.get(arrowKey).segments.push({ source, target });
      }
    }

    const inverseScale = 1 / Math.max(0.18, state.camera.scale);
    for (const stroke of strokes.values()) {
      const graphics = stroke.connected ? emphasis : normal;
      for (const { source, target } of stroke.segments) {
        graphics.moveTo(source.x, source.y).lineTo(target.x, target.y);
      }
      graphics.stroke({
        color: stroke.color,
        alpha: stroke.alpha,
        width: stroke.width * inverseScale,
        cap: "round"
      });
    }

    for (const style of arrowStyles.values()) {
      for (const { source, target } of style.segments) {
        drawArrow(arrows, source, target, target.radius * state.nodeScale, state.camera.scale);
      }
      arrows.fill({ color: 0xaaa5b0, alpha: style.alpha });
    }
  }

  drawNodes(state) {
    const nodes = this.nodesGraphics.clear();
    const emphasis = this.emphasisGraphics;
    const focusId = state.hoveredId;
    const focusNeighbors = focusId ? state.adjacency.get(focusId) ?? new Set() : null;
    const searchMatches = state.quickQuery
      ? new Set(state.visibleNodes.filter((node) => quickMatch(node, state.quickQuery)).map((node) => node.id))
      : null;

    for (const node of state.visibleNodes) {
      const progress = revealProgress(node, state);
      if (progress <= 0) continue;
      const focused = node.id === focusId;
      const selected = node.id === state.selectedId;
      const neighbor = focusNeighbors?.has(node.id);
      const searchMatch = searchMatches?.has(node.id);
      const faded = focusId && !focused && !neighbor;
      const searchFaded = searchMatches?.size && !searchMatch;
      const alpha = (faded ? 0.13 : searchFaded ? 0.18 : 0.9) * easeOut(progress);
      const radius = Math.max(1.15 / state.camera.scale, node.radius * state.nodeScale * (0.35 + 0.65 * easeOut(progress)));

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
    const graphKey = `${state.workerRevision}:${state.visibleNodes.length}`;
    const scaleChanged = Math.abs(Math.log2(Math.max(0.01, state.camera.scale) / Math.max(0.01, this.lastPlacementScale))) > 0.16;
    if (graphKey !== this.graphKey || scaleChanged) {
      this.labelPlacements.clear();
      this.graphKey = graphKey;
      this.lastPlacementScale = state.camera.scale;
    }

    const candidates = buildLabelCandidates(state);
    const labelLimit = Math.max(12, Math.ceil(state.visibleNodes.length * Math.min(0.22, 0.11 + state.camera.scale * 0.07)));
    const grid = new LabelGrid(84, 24);
    let used = 0;
    for (const candidate of candidates) {
      if (used >= labelLimit && candidate.priority < 8) break;
      const { node, priority } = candidate;
      const progress = revealProgress(node, state);
      if (progress < 0.65) continue;
      const point = {
        x: node.x * state.camera.scale + state.camera.x,
        y: node.y * state.camera.scale + state.camera.y
      };
      if (point.x < -80 || point.x > state.width + 80 || point.y < -30 || point.y > state.height + 30) continue;

      const label = truncate(node.cleanName, priority >= 8 ? 55 : state.camera.scale > 1.35 ? 38 : 27);
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
      text.alpha = (priority >= 8 ? 0.94 : state.hoveredId && node.id !== state.hoveredId && !state.adjacency.get(state.hoveredId)?.has(node.id) ? 0.08 : 0.57) * Math.min(1, (progress - 0.65) / 0.35);
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

  acquireLabel(index) {
    if (!this.labelPool[index]) {
      const label = new BitmapText({
        text: "",
        style: {
          fontFamily: "Arial",
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

function buildLabelCandidates(state) {
  return state.visibleNodes.map((node) => {
    const degree = (state.incoming.get(node.id) ?? 0) + (state.outgoing.get(node.id) ?? 0);
    const importance = Math.min(1, (node.val ?? 10) / 60) * 0.62 + Math.min(1, degree / 14) * 0.38;
    let priority = importance;
    if (node.id === state.hoveredId || node.id === state.selectedId) priority = 10;
    else if (state.quickQuery && quickMatch(node, state.quickQuery)) priority = 9;
    else if (state.mode === "local" && node.id === state.localRoot) priority = 8;
    return { node, importance, priority };
  }).filter(({ importance, priority }) => {
    if (priority > 1) return true;
    const zoomBonus = Math.max(0, Math.log2(state.camera.scale + 0.3)) * 0.22;
    return importance + zoomBonus >= state.textFade;
  }).sort((a, b) => b.priority - a.priority || b.importance - a.importance);
}

function revealProgress(node, state) {
  if (!state.animation.active && state.animation.progress >= 1) return 1;
  const count = Math.max(1, state.visibleNodes.length - 1);
  const index = state.revealIndex.get(node.id) ?? 0;
  const nodeWindow = Math.max(0.035, 280 / state.animation.duration);
  const start = index / count * (1 - nodeWindow);
  return Math.max(0, Math.min(1, (state.animation.progress - start) / nodeWindow));
}

function easeOut(value) {
  return 1 - Math.pow(1 - value, 3);
}

function quickMatch(node, query) {
  const normalized = query.trim().toLowerCase();
  return normalized && `${node.name} ${node.topic} ${node.path}`.toLowerCase().includes(normalized);
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
