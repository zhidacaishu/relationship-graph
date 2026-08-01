const LEAF_CAPACITY = 4;
const MAX_DEPTH = 18;

export function buildQuadtree(x, y, radii) {
  if (!x.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < x.length; index += 1) {
    minX = Math.min(minX, x[index]);
    minY = Math.min(minY, y[index]);
    maxX = Math.max(maxX, x[index]);
    maxY = Math.max(maxY, y[index]);
  }

  const size = Math.max(1, maxX - minX, maxY - minY) * 1.001;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const half = size / 2;
  const root = createCell(centerX - half, centerY - half, centerX + half, centerY + half);

  for (let index = 0; index < x.length; index += 1) insert(root, index, x, y, 0);
  accumulate(root, x, y, radii);
  return root;
}

export function applyBarnesHut(root, index, x, y, theta, softeningSquared, charge) {
  if (!root) return { x: 0, y: 0, approximate: 0, exact: 0 };

  const px = x[index];
  const py = y[index];
  let forceX = 0;
  let forceY = 0;
  let approximate = 0;
  let exact = 0;
  const stack = [root];

  while (stack.length) {
    const cell = stack.pop();
    if (!cell?.mass) continue;

    if (!cell.children) {
      for (const other of cell.bodies) {
        if (other === index) continue;
        let dx = x[other] - px;
        let dy = y[other] - py;
        let distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < 0.0001) {
          dx = (((index + 1) * 17 + (other + 1) * 13) % 11 - 5) * 0.01;
          dy = (((index + 1) * 7 + (other + 1) * 19) % 13 - 6) * 0.01;
          distanceSquared = dx * dx + dy * dy;
        }
        const strength = charge / Math.max(softeningSquared, distanceSquared);
        forceX -= dx * strength;
        forceY -= dy * strength;
        exact += 1;
      }
      continue;
    }

    const dx = cell.centerX - px;
    const dy = cell.centerY - py;
    const distanceSquared = dx * dx + dy * dy;
    const width = cell.x1 - cell.x0;
    const containsBody = px >= cell.x0 && px <= cell.x1 && py >= cell.y0 && py <= cell.y1;

    if (!containsBody && distanceSquared > 0 && width / Math.sqrt(distanceSquared) < theta) {
      const strength = charge * cell.mass / Math.max(softeningSquared, distanceSquared);
      forceX -= dx * strength;
      forceY -= dy * strength;
      approximate += 1;
    } else {
      for (const child of cell.children) if (child?.mass) stack.push(child);
    }
  }

  return { x: forceX, y: forceY, approximate, exact };
}

export function queryRange(root, x0, y0, x1, y1, visit) {
  if (!root) return;
  const stack = [root];
  while (stack.length) {
    const cell = stack.pop();
    if (!cell || cell.x1 < x0 || cell.x0 > x1 || cell.y1 < y0 || cell.y0 > y1) continue;
    if (cell.children) {
      for (const child of cell.children) if (child) stack.push(child);
    } else {
      for (const index of cell.bodies) visit(index);
    }
  }
}

function createCell(x0, y0, x1, y1) {
  return {
    x0,
    y0,
    x1,
    y1,
    bodies: [],
    children: null,
    mass: 0,
    centerX: 0,
    centerY: 0,
    maxRadius: 0
  };
}

function insert(cell, index, x, y, depth) {
  if (!cell.children && (cell.bodies.length < LEAF_CAPACITY || depth >= MAX_DEPTH)) {
    cell.bodies.push(index);
    return;
  }

  if (!cell.children) {
    subdivide(cell);
    const existing = cell.bodies;
    cell.bodies = [];
    for (const body of existing) insert(childFor(cell, x[body], y[body]), body, x, y, depth + 1);
  }

  insert(childFor(cell, x[index], y[index]), index, x, y, depth + 1);
}

function subdivide(cell) {
  const midX = (cell.x0 + cell.x1) / 2;
  const midY = (cell.y0 + cell.y1) / 2;
  cell.children = [
    createCell(cell.x0, cell.y0, midX, midY),
    createCell(midX, cell.y0, cell.x1, midY),
    createCell(cell.x0, midY, midX, cell.y1),
    createCell(midX, midY, cell.x1, cell.y1)
  ];
}

function childFor(cell, px, py) {
  const midX = (cell.x0 + cell.x1) / 2;
  const midY = (cell.y0 + cell.y1) / 2;
  return cell.children[(py >= midY ? 2 : 0) + (px >= midX ? 1 : 0)];
}

function accumulate(cell, x, y, radii) {
  let mass = 0;
  let weightedX = 0;
  let weightedY = 0;
  let maxRadius = 0;

  if (cell.children) {
    for (const child of cell.children) {
      accumulate(child, x, y, radii);
      mass += child.mass;
      weightedX += child.centerX * child.mass;
      weightedY += child.centerY * child.mass;
      maxRadius = Math.max(maxRadius, child.maxRadius);
    }
  } else {
    for (const index of cell.bodies) {
      mass += 1;
      weightedX += x[index];
      weightedY += y[index];
      maxRadius = Math.max(maxRadius, radii[index] || 0);
    }
  }

  cell.mass = mass;
  cell.centerX = mass ? weightedX / mass : 0;
  cell.centerY = mass ? weightedY / mass : 0;
  cell.maxRadius = maxRadius;
}
