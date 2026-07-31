import { applyBarnesHut, buildQuadtree, queryRange } from "./graph-quadtree.js";

const PROTOCOL_VERSION = 4;
const CONTROL_SEQUENCE = 0;
const CONTROL_FRAME = 1;
const CONTROL_STATUS = 2;
const STATUS_IDLE = 0;
const STATUS_ACTIVE = 1;
const STATUS_SETTLED = 2;
const COLLISION_PADDING = 2.5;
const COLLISION_EPSILON = 0.02;
const ACTIVE_COLLISION_ITERATIONS = 2;
const SETTLE_COLLISION_ITERATIONS = 12;

let revision = 0;
let ids = [];
let idToIndex = new Map();
let x = new Float32Array(0);
let y = new Float32Array(0);
let vx = new Float32Array(0);
let vy = new Float32Array(0);
let radii = new Float32Array(0);
let degrees = new Uint16Array(0);
let fixed = new Uint8Array(0);
let draggedIndex = -1;
let links = [];
let alpha = 0;
let alphaTarget = 0;
let frame = 0;
let sharedPositions = null;
let sharedControl = null;
let lastStatus = "idle";
let forces = {
  centerStrength: 0.4,
  repelStrength: 8,
  linkStrength: 1,
  linkDistance: 62
};

self.onmessage = ({ data }) => {
  switch (data.type) {
    case "init":
      initialize(data);
      break;
    case "forces":
      forces = { ...forces, ...data.forces };
      alpha = Math.max(alpha, 0.68);
      announceStatus("active");
      break;
    case "radii":
      updateRadii(data);
      break;
    case "reheat":
      alpha = Math.max(alpha, data.alpha ?? 0.8);
      announceStatus("active");
      break;
    case "drag":
      draggedIndex = idToIndex.get(data.id) ?? -1;
      setNodePosition(data.id, data.x, data.y, true);
      alphaTarget = 0.16;
      alpha = Math.max(alpha, 0.34);
      announceStatus("active");
      break;
    case "release":
      releaseNode(data.id, Boolean(data.pinned));
      draggedIndex = -1;
      alphaTarget = 0;
      alpha = Math.max(alpha, 0.2);
      break;
    case "pin":
      setPinned(data.id, Boolean(data.pinned));
      break;
  }
};

function initialize(data) {
  revision = data.revision;
  forces = { ...forces, ...data.forces };
  ids = data.nodes.map((node) => node.id);
  idToIndex = new Map(ids.map((id, index) => [id, index]));
  const count = ids.length;
  x = new Float32Array(count);
  y = new Float32Array(count);
  vx = new Float32Array(count);
  vy = new Float32Array(count);
  radii = new Float32Array(count);
  degrees = new Uint16Array(count);
  fixed = new Uint8Array(count);

  data.nodes.forEach((node, index) => {
    x[index] = Number.isFinite(node.x) ? node.x : seededCoordinate(index, count, 0);
    y[index] = Number.isFinite(node.y) ? node.y : seededCoordinate(index, count, 1);
    radii[index] = node.radius || 3;
    fixed[index] = node.pinned ? 1 : 0;
  });

  links = data.links
    .map((link) => ({
      source: idToIndex.get(link.source),
      target: idToIndex.get(link.target),
      weight: link.weight ?? 1
    }))
    .filter((link) => link.source !== undefined && link.target !== undefined && link.source !== link.target);

  for (const link of links) {
    degrees[link.source] += 1;
    degrees[link.target] += 1;
  }

  draggedIndex = -1;
  sharedPositions = data.sharedBuffer ? new Float32Array(data.sharedBuffer) : null;
  sharedControl = data.controlBuffer ? new Int32Array(data.controlBuffer) : null;
  if (sharedControl) {
    Atomics.store(sharedControl, CONTROL_SEQUENCE, 0);
    Atomics.store(sharedControl, CONTROL_FRAME, 0);
    Atomics.store(sharedControl, CONTROL_STATUS, STATUS_ACTIVE);
  }
  alpha = 1;
  alphaTarget = 0;
  frame = 0;
  announceStatus("active");
  publishPositions(true);
  self.postMessage({
    type: "ready",
    revision,
    protocolVersion: PROTOCOL_VERSION,
    shared: Boolean(sharedPositions && sharedControl)
  });
}

function seededCoordinate(index, count, axis) {
  const angle = pseudoRandom(index * 2 + 17) * Math.PI * 2;
  const radius = Math.sqrt(pseudoRandom(index * 2 + 53)) * Math.sqrt(count) * 17;
  return (axis ? Math.sin(angle) : Math.cos(angle)) * radius;
}

function pseudoRandom(seed) {
  let value = seed + 0x6d2b79f5;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}

function updateRadii(data) {
  if (data.revision !== revision || data.radii?.length !== radii.length) return;
  radii.set(data.radii);
  alpha = Math.max(alpha, 0.24);
  announceStatus("active");
}

function setNodePosition(id, nextX, nextY, shouldFix) {
  const index = idToIndex.get(id);
  if (index === undefined) return;
  x[index] = nextX;
  y[index] = nextY;
  vx[index] = 0;
  vy[index] = 0;
  fixed[index] = shouldFix ? 1 : fixed[index];
  publishPositions(true);
}

function releaseNode(id, pinned) {
  const index = idToIndex.get(id);
  if (index === undefined) return;
  fixed[index] = pinned ? 1 : 0;
}

function setPinned(id, pinned) {
  const index = idToIndex.get(id);
  if (index === undefined) return;
  fixed[index] = pinned ? 1 : 0;
  vx[index] = 0;
  vy[index] = 0;
}

function simulate() {
  const count = ids.length;
  if (!count || lastStatus === "settled" && alpha < 0.0025 && alphaTarget === 0) return;

  const tickStarted = performance.now();
  const dynamicsActive = alpha >= 0.0025 || alphaTarget !== 0;
  let treeMs = 0;
  let approximateChecks = 0;
  let exactChecks = 0;

  if (dynamicsActive) {
    alpha += (alphaTarget - alpha) * 0.08;
    if (alphaTarget === 0) alpha *= 0.992;

    const treeStarted = performance.now();
    const tree = buildQuadtree(x, y, radii);
    treeMs += performance.now() - treeStarted;
    const charge = forces.repelStrength * 2.7 * alpha;

    for (let index = 0; index < count; index += 1) {
      if (fixed[index]) continue;
      const force = applyBarnesHut(tree, index, x, y, 0.72, 32, charge);
      vx[index] += force.x;
      vy[index] += force.y;
      approximateChecks += force.approximate;
      exactChecks += force.exact;
    }

    applyLinkSprings();
    integrate(count);
  } else {
    alpha = 0;
  }

  const collision = resolveCollisions(dynamicsActive ? ACTIVE_COLLISION_ITERATIONS : SETTLE_COLLISION_ITERATIONS);
  treeMs += collision.treeMs;
  const settled = !dynamicsActive && collision.overlapCount === 0;

  frame += 1;
  if (settled || frame % 2 === 0) publishPositions(settled);
  if (settled || frame % 60 === 0) {
    self.postMessage({
      type: "stats",
      revision,
      frame,
      alpha,
      tickMs: performance.now() - tickStarted,
      treeMs,
      approximateChecks,
      exactChecks,
      overlapCount: collision.overlapCount,
      maxOverlap: collision.maxOverlap,
      collisionIterations: collision.iterations
    });
  }
  if (settled) announceStatus("settled");
}

function resolveCollisions(maxIterations) {
  let treeMs = 0;
  let iterations = 0;

  for (; iterations < maxIterations; iterations += 1) {
    const treeStarted = performance.now();
    const tree = buildQuadtree(x, y, radii);
    treeMs += performance.now() - treeStarted;
    const result = projectCollisions(tree);
    if (result.overlapCount === 0) return { ...result, iterations: iterations + 1, treeMs };
  }

  const treeStarted = performance.now();
  const tree = buildQuadtree(x, y, radii);
  treeMs += performance.now() - treeStarted;
  return { ...measureCollisions(tree), iterations, treeMs };
}

function projectCollisions(tree) {
  if (!tree) return { overlapCount: 0, maxOverlap: 0 };
  const searchPadding = tree.maxRadius + COLLISION_PADDING;
  let overlapCount = 0;
  let maxOverlap = 0;

  forEachCollisionPair(tree, searchPadding, (index, other, dx, dy, distance, overlap) => {
    overlapCount += 1;
    maxOverlap = Math.max(maxOverlap, overlap);
    const correction = overlap + COLLISION_EPSILON;
    const unitX = dx / distance;
    const unitY = dy / distance;
    const indexDragged = index === draggedIndex;
    const otherDragged = other === draggedIndex;

    if (indexDragged && !otherDragged) {
      displace(other, unitX * correction, unitY * correction);
    } else if (otherDragged && !indexDragged) {
      displace(index, -unitX * correction, -unitY * correction);
    } else if (fixed[index] && !fixed[other]) {
      displace(other, unitX * correction, unitY * correction);
    } else if (!fixed[index] && fixed[other]) {
      displace(index, -unitX * correction, -unitY * correction);
    } else {
      const half = correction * 0.5;
      displace(index, -unitX * half, -unitY * half);
      displace(other, unitX * half, unitY * half);
    }
  });

  return { overlapCount, maxOverlap };
}

function measureCollisions(tree) {
  if (!tree) return { overlapCount: 0, maxOverlap: 0 };
  const searchPadding = tree.maxRadius + COLLISION_PADDING;
  let overlapCount = 0;
  let maxOverlap = 0;

  forEachCollisionPair(tree, searchPadding, (_index, _other, _dx, _dy, _distance, overlap) => {
    overlapCount += 1;
    maxOverlap = Math.max(maxOverlap, overlap);
  });

  return { overlapCount, maxOverlap };
}

function forEachCollisionPair(tree, searchPadding, visit) {
  for (let index = 0; index < ids.length; index += 1) {
    const range = radii[index] + searchPadding;
    queryRange(tree, x[index] - range, y[index] - range, x[index] + range, y[index] + range, (other) => {
      if (other <= index) return;
      let dx = x[other] - x[index];
      let dy = y[other] - y[index];
      const actualDistance = Math.hypot(dx, dy);
      let directionDistance = actualDistance;
      if (actualDistance < 0.0001) {
        const angle = ((index + 1) * 137 + (other + 1) * 67) % 360 / 180 * Math.PI;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        directionDistance = 1;
      }
      const overlap = radii[index] + radii[other] + COLLISION_PADDING - actualDistance;
      if (overlap > 0) visit(index, other, dx, dy, directionDistance, overlap);
    });
  }
}

function displace(index, deltaX, deltaY) {
  x[index] += deltaX;
  y[index] += deltaY;
  vx[index] *= 0.35;
  vy[index] *= 0.35;
}

function applyLinkSprings() {
  const desiredDistance = forces.linkDistance;
  const springScale = forces.linkStrength * 0.011 * alpha;
  for (const link of links) {
    const source = link.source;
    const target = link.target;
    const dx = x[target] - x[source];
    const dy = y[target] - y[source];
    const distance = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
    const weightedDistance = desiredDistance * (1.12 - Math.min(1, link.weight) * 0.2);
    const spring = (distance - weightedDistance) / distance * springScale * (0.55 + link.weight * 0.65);
    const forceX = dx * spring;
    const forceY = dy * spring;
    if (!fixed[source]) {
      vx[source] += forceX;
      vy[source] += forceY;
    }
    if (!fixed[target]) {
      vx[target] -= forceX;
      vy[target] -= forceY;
    }
  }
}

function integrate(count) {
  let centroidX = 0;
  let centroidY = 0;
  for (let index = 0; index < count; index += 1) {
    centroidX += x[index];
    centroidY += y[index];
  }
  centroidX /= count;
  centroidY /= count;

  const recentering = forces.centerStrength * 0.0045 * alpha;
  const damping = 0.865;
  for (let index = 0; index < count; index += 1) {
    if (fixed[index]) continue;
    const hubGravity = forces.centerStrength * (0.000006 + Math.min(20, degrees[index]) * 0.0000025) * alpha;
    vx[index] = (vx[index] - centroidX * recentering - x[index] * hubGravity) * damping;
    vy[index] = (vy[index] - centroidY * recentering - y[index] * hubGravity) * damping;
    const speed = Math.sqrt(vx[index] * vx[index] + vy[index] * vy[index]);
    if (speed > 10) {
      vx[index] = vx[index] / speed * 10;
      vy[index] = vy[index] / speed * 10;
    }
    x[index] += vx[index];
    y[index] += vy[index];
  }
}

function publishPositions(force) {
  if (!ids.length || !force && frame % 2 !== 0) return;

  if (sharedPositions && sharedControl && sharedPositions.length >= ids.length * 2) {
    Atomics.add(sharedControl, CONTROL_SEQUENCE, 1);
    for (let index = 0; index < ids.length; index += 1) {
      sharedPositions[index * 2] = x[index];
      sharedPositions[index * 2 + 1] = y[index];
    }
    Atomics.store(sharedControl, CONTROL_FRAME, frame);
    Atomics.add(sharedControl, CONTROL_SEQUENCE, 1);
    return;
  }

  const snapshot = new Float32Array(ids.length * 2);
  for (let index = 0; index < ids.length; index += 1) {
    snapshot[index * 2] = x[index];
    snapshot[index * 2 + 1] = y[index];
  }
  self.postMessage({ type: "positions", revision, positions: snapshot.buffer, alpha, frame }, [snapshot.buffer]);
}

function announceStatus(status) {
  lastStatus = status;
  if (sharedControl) {
    const value = status === "active" ? STATUS_ACTIVE : status === "settled" ? STATUS_SETTLED : STATUS_IDLE;
    Atomics.store(sharedControl, CONTROL_STATUS, value);
  }
  self.postMessage({ type: "status", revision, status, alpha });
}

setInterval(simulate, 16);
