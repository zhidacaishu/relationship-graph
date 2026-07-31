import { createGraphRenderer } from "./graph-renderer.js";

(() => {
  "use strict";

  const source = window.PRECOMPUTED_GRAPH_DATA;
  if (!source?.nodes?.length || !source?.links?.length) {
    document.body.innerHTML = "<main style='padding:40px;color:#ddd;background:#202020;height:100vh'>Graph data could not be loaded.</main>";
    return;
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const canvas = $("#graph-canvas");
  const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  const topicColors = ["#a992ee", "#72a8db", "#df8ca9", "#d4aa62", "#72baa8", "#dc8c70", "#a3b76d", "#b58bd2"];
  const mutedNode = "#8e8b88";
  const syntheticColors = {
    tag: "#a88ce8",
    attachment: "#77a5c8",
    unresolved: "#767472",
    orphan: "#5e5c5a"
  };

  const elements = {
    panel: $("#control-panel"),
    panelToggle: $("#panel-toggle"),
    panelClose: $("#panel-close"),
    filterSearch: $("#filter-search"),
    quickSearch: $("#quick-search"),
    quickSearchWrap: $(".floating-search"),
    groupList: $("#group-list"),
    addGroup: $("#add-group"),
    tags: $("#toggle-tags"),
    attachments: $("#toggle-attachments"),
    existing: $("#toggle-existing"),
    orphans: $("#toggle-orphans"),
    arrows: $("#toggle-arrows"),
    localDepth: $("#local-depth"),
    localDepthRow: $("#local-depth-row"),
    animate: $("#animate-graph"),
    nodeCard: $("#node-card"),
    nodeCardClose: $("#node-card-close"),
    nodeTitle: $("#node-title"),
    nodeType: $("#node-type"),
    nodePath: $("#node-path"),
    nodeLinks: $("#node-links"),
    nodeBacklinks: $("#node-backlinks"),
    nodeYear: $("#node-year"),
    openLocal: $("#open-local"),
    pinNode: $("#pin-node"),
    hoverLabel: $("#hover-label"),
    contextMenu: $("#context-menu"),
    zoomLevel: $("#zoom-level"),
    workerStatus: $("#worker-status"),
    statusPulse: $(".status-pulse"),
    graphCount: $("#graph-count"),
    viewTitle: $("#view-title"),
    loading: $("#loading-screen"),
    loadingStatus: $("#loading-status"),
    toast: $("#toast")
  };

  const state = {
    width: 1,
    height: 1,
    dpr: 1,
    camera: { x: 0, y: 0, scale: 1 },
    mode: "global",
    localRoot: null,
    localDepth: 2,
    filterQuery: "",
    quickQuery: "",
    showTags: false,
    showAttachments: false,
    existingOnly: true,
    showOrphans: false,
    arrows: false,
    textFade: 0.55,
    nodeScale: 1.1,
    linkThickness: 1,
    forces: {
      centerStrength: 0.4,
      repelStrength: 8,
      linkStrength: 1,
      linkDistance: 62
    },
    groups: source.topics.map((topic, index) => ({
      id: `group-${index}`,
      query: `topic:${topic}`,
      topic,
      color: topicColors[index % topicColors.length],
      enabled: true
    })),
    visibleNodes: [],
    visibleLinks: [],
    layoutLinks: [],
    visibleById: new Map(),
    visibleIndex: new Map(),
    revealIndex: new Map(),
    adjacency: new Map(),
    incoming: new Map(),
    outgoing: new Map(),
    positionCache: new Map(),
    pinned: new Set(),
    hoveredId: null,
    selectedId: null,
    contextId: null,
    pointer: null,
    draggingId: null,
    panning: false,
    dragMoved: false,
    worker: null,
    workerRevision: 0,
    sharedPositions: null,
    sharedSnapshot: null,
    sharedControl: null,
    sharedSequence: 0,
    sharedFrame: 0,
    runtimeMode: "Transfer",
    workerStats: null,
    monitorFrame: 0,
    renderer: null,
    rendererMode: "Canvas",
    renderPending: false,
    hasFitted: false,
    panelOpen: true,
    loadingDismissed: false,
    animation: {
      active: false,
      progress: 1,
      startedAt: 0,
      duration: 8000,
      frame: 0
    }
  };

  const baseNodes = source.nodes.map((rawNode, index) => {
    const yearMatch = rawNode.name.match(/\((\d{4})\)\s*$/);
    const year = yearMatch ? Number(yearMatch[1]) : 2020;
    const cleanName = rawNode.name.replace(/\s*\(\d{4}\)\s*$/, "");
    return {
      id: rawNode.id,
      name: rawNode.name,
      cleanName,
      group: rawNode.group,
      topic: rawNode.topic,
      val: rawNode.val,
      degree: rawNode.degree,
      radius: 2.8 + Math.sqrt(Math.max(1, rawNode.degree)) * 0.72,
      type: "note",
      year,
      createdOrder: year * 1000 + index,
      path: `Papers/${rawNode.topic}/${cleanName}.md`,
      index
    };
  });
  const baseById = new Map(baseNodes.map((node) => [node.id, node]));
  const baseLinks = source.links.map((rawLink, index) => ({
    id: `link-${index}`,
    source: nodeId(rawLink.sourceId ?? rawLink.source),
    target: nodeId(rawLink.targetId ?? rawLink.target),
    weight: rawLink.similarity ?? 0.75,
    type: "internal"
  })).filter((link) => baseById.has(link.source) && baseById.has(link.target));
  const synthetic = createSyntheticGraph();
  const allNodeLookup = new Map([
    ...baseNodes,
    ...synthetic.tags.nodes,
    ...synthetic.attachments.nodes,
    ...synthetic.unresolved.nodes,
    ...synthetic.orphans.nodes
  ].map((node) => [node.id, node]));
  const fullDegrees = calculateDegrees([...baseLinks, ...synthetic.tags.links, ...synthetic.attachments.links, ...synthetic.unresolved.links]);

  initialize();

  async function initialize() {
    state.worker = new Worker(new URL("./graph-worker.js", import.meta.url), { type: "module" });
    state.worker.addEventListener("message", handleWorkerMessage);
    state.worker.addEventListener("error", handleWorkerError);
    bindPanelControls();
    bindCanvasControls();
    renderGroupList();
    updateAllRanges();
    resizeCanvas();
    try {
      state.renderer = await createGraphRenderer(canvas.parentElement, canvas);
      state.rendererMode = state.renderer.backend;
      state.renderer.resize(state.width, state.height, state.dpr);
    } catch (error) {
      console.warn("WebGL renderer unavailable; using Canvas fallback", error);
      state.renderer = null;
      state.rendererMode = "Canvas";
    }
    rebuildGraph({ fit: true });
    monitorSharedPositions();
    new ResizeObserver(resizeCanvas).observe(canvas.parentElement);
    window.addEventListener("beforeunload", () => {
      cancelAnimationFrame(state.monitorFrame);
      state.renderer?.destroy();
      state.worker?.terminate();
    });
    setTimeout(() => {
      if (!state.loadingDismissed) dismissLoading();
    }, 2200);
  }

  function nodeId(value) {
    return typeof value === "object" && value ? value.id : String(value);
  }

  function createSyntheticGraph() {
    const tags = { nodes: [], links: [] };
    const attachments = { nodes: [], links: [] };
    const unresolved = { nodes: [], links: [] };
    const orphans = { nodes: [], links: [] };

    source.topics.forEach((topic, group) => {
      const id = `tag:${slugify(topic)}`;
      tags.nodes.push({
        id,
        name: `#${slugify(topic)}`,
        cleanName: `#${slugify(topic)}`,
        group,
        topic,
        val: 28,
        degree: 0,
        radius: 3.5,
        type: "tag",
        year: null,
        createdOrder: 2027000 + group,
        path: `Tags/${topic}`,
        index: baseNodes.length + group
      });
      baseNodes.filter((node) => node.group === group && node.index % 3 === group % 3).forEach((node, index) => {
        tags.links.push({ id: `tag-link-${group}-${index}`, source: node.id, target: id, weight: 0.82, type: "tag" });
      });
    });

    const attachmentNames = ["latent-space.svg", "evaluation-matrix.csv", "system-map.canvas", "training-curve.png", "interview-notes.pdf", "benchmark-table.csv", "causal-model.svg", "retrieval-pipeline.canvas", "survey-results.pdf", "prototype-flow.png", "poster-draft.pdf", "dataset-card.md"];
    attachmentNames.forEach((name, index) => {
      const sourceNode = baseNodes[(index * 23 + 11) % baseNodes.length];
      const id = `attachment:${index}`;
      attachments.nodes.push({
        id,
        name,
        cleanName: name,
        group: sourceNode.group,
        topic: sourceNode.topic,
        val: 16,
        degree: 1,
        radius: 2.6,
        type: "attachment",
        year: 2016 + index % 10,
        createdOrder: (2016 + index % 10) * 1000 + 500 + index,
        path: `Attachments/${name}`,
        index: baseNodes.length + 20 + index
      });
      attachments.links.push({ id: `attachment-link-${index}`, source: sourceNode.id, target: id, weight: 0.92, type: "attachment" });
    });

    const unresolvedNames = ["Graph Alignment Notes", "Untitled Experiment", "Reading Queue", "Missing Appendix", "Future Work", "Visual Analytics", "Theory Sketch", "Open Questions", "Replication Log", "Dataset Provenance"];
    unresolvedNames.forEach((name, index) => {
      const sourceNode = baseNodes[(index * 29 + 7) % baseNodes.length];
      const id = `unresolved:${index}`;
      unresolved.nodes.push({
        id,
        name,
        cleanName: name,
        group: -1,
        topic: "Unresolved",
        val: 10,
        degree: 1,
        radius: 2.25,
        type: "unresolved",
        year: null,
        createdOrder: 2028000 + index,
        path: `${name}.md`,
        index: baseNodes.length + 40 + index
      });
      unresolved.links.push({ id: `unresolved-link-${index}`, source: sourceNode.id, target: id, weight: 0.68, type: "unresolved" });
    });

    ["Scratchpad", "Inbox fragment", "Loose hypothesis", "Meeting stub", "Temporary note", "Citation fragment", "Idea seed"].forEach((name, index) => {
      orphans.nodes.push({
        id: `orphan:${index}`,
        name,
        cleanName: name,
        group: -1,
        topic: "Orphan",
        val: 6,
        degree: 0,
        radius: 2,
        type: "orphan",
        year: 2020 + index % 6,
        createdOrder: (2020 + index % 6) * 1000 + 900 + index,
        path: `Inbox/${name}.md`,
        index: baseNodes.length + 60 + index
      });
    });

    return { tags, attachments, unresolved, orphans };
  }

  function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function calculateDegrees(links) {
    const incoming = new Map();
    const outgoing = new Map();
    links.forEach((link) => {
      outgoing.set(link.source, (outgoing.get(link.source) ?? 0) + 1);
      incoming.set(link.target, (incoming.get(link.target) ?? 0) + 1);
    });
    return { incoming, outgoing };
  }

  function bindPanelControls() {
    elements.panelToggle.addEventListener("click", () => setPanelOpen(!state.panelOpen));
    elements.panelClose.addEventListener("click", () => setPanelOpen(false));

    $$(".section-heading").forEach((button) => {
      button.addEventListener("click", () => {
        const section = button.closest(".control-section");
        const open = !section.classList.contains("is-open");
        section.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", String(open));
      });
    });

    elements.filterSearch.addEventListener("input", debounce(() => {
      state.filterQuery = elements.filterSearch.value.trim();
      rebuildGraph({ fit: true });
    }, 160));

    elements.quickSearch.addEventListener("input", () => {
      state.quickQuery = elements.quickSearch.value.trim().toLowerCase();
      scheduleRender();
    });
    elements.quickSearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter") focusFirstSearchResult();
      if (event.key === "Escape") closeQuickSearch();
    });

    elements.tags.addEventListener("change", () => {
      state.showTags = elements.tags.checked;
      rebuildGraph({ fit: false });
    });
    elements.attachments.addEventListener("change", () => {
      state.showAttachments = elements.attachments.checked;
      rebuildGraph({ fit: false });
    });
    elements.existing.addEventListener("change", () => {
      state.existingOnly = elements.existing.checked;
      rebuildGraph({ fit: false });
    });
    elements.orphans.addEventListener("change", () => {
      state.showOrphans = elements.orphans.checked;
      rebuildGraph({ fit: false });
    });
    elements.arrows.addEventListener("change", () => {
      state.arrows = elements.arrows.checked;
      scheduleRender();
    });
    elements.localDepth.addEventListener("input", () => {
      state.localDepth = Number(elements.localDepth.value);
      $("#depth-value").value = state.localDepth;
      updateRangeFill(elements.localDepth);
      if (state.mode === "local") rebuildGraph({ fit: true });
    });

    bindRange("#text-fade", "#fade-value", (value) => {
      state.textFade = value;
      return value.toFixed(2);
    }, scheduleRender);
    bindRange("#node-size", "#node-size-value", (value) => {
      state.nodeScale = value;
      return value.toFixed(2);
    }, updateNodeScale);
    bindRange("#link-thickness", "#link-thickness-value", (value) => {
      state.linkThickness = value;
      return value.toFixed(2);
    }, scheduleRender);
    bindRange("#center-force", "#center-value", (value) => {
      state.forces.centerStrength = value;
      return value.toFixed(2);
    }, updateForces);
    bindRange("#repel-force", "#repel-value", (value) => {
      state.forces.repelStrength = value;
      return value.toFixed(1);
    }, updateForces);
    bindRange("#link-force", "#link-force-value", (value) => {
      state.forces.linkStrength = value;
      return value.toFixed(2);
    }, updateForces);
    bindRange("#link-distance", "#link-distance-value", (value) => {
      state.forces.linkDistance = value;
      return value.toFixed(0);
    }, updateForces);

    elements.animate.addEventListener("click", toggleAnimation);
    elements.addGroup.addEventListener("click", addGroup);
    $$(".mode-button").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));

    elements.nodeCardClose.addEventListener("click", clearSelection);
    elements.openLocal.addEventListener("click", () => {
      if (state.selectedId) openLocalGraph(state.selectedId);
    });
    elements.pinNode.addEventListener("click", () => {
      if (state.selectedId) togglePin(state.selectedId);
    });

    $(".ribbon-button[aria-label='Search']").addEventListener("click", openQuickSearch);
    $(".ribbon-button[aria-label='Graph view']").addEventListener("click", () => setMode("global"));
    $(".ribbon-button[aria-label='Settings']").addEventListener("click", () => setPanelOpen(true));
  }

  function bindRange(inputSelector, outputSelector, update, after) {
    const input = $(inputSelector);
    const output = $(outputSelector);
    input.addEventListener("input", () => {
      const value = Number(input.value);
      output.value = update(value);
      updateRangeFill(input);
      after();
    });
  }

  function updateAllRanges() {
    $$('input[type="range"]').forEach(updateRangeFill);
  }

  function updateRangeFill(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const progress = (Number(input.value) - min) / (max - min) * 100;
    input.style.setProperty("--range-fill", `${progress}%`);
  }

  function updateForces() {
    state.worker.postMessage({ type: "forces", forces: state.forces });
    setWorkerStatus("active");
  }

  function updateNodeScale() {
    const radii = new Float32Array(state.visibleNodes.length);
    state.visibleNodes.forEach((node, index) => {
      radii[index] = node.radius * state.nodeScale;
    });
    state.worker.postMessage({
      type: "radii",
      revision: state.workerRevision,
      radii
    }, [radii.buffer]);
    setWorkerStatus("active");
    scheduleRender();
  }

  function bindCanvasControls() {
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.addEventListener("pointerleave", () => {
      if (!state.draggingId && !state.panning) setHovered(null);
    });
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("dblclick", (event) => {
      const node = hitTest(event.clientX, event.clientY);
      if (node) openLocalGraph(node.id);
      else fitGraph(true);
    });
    canvas.addEventListener("contextmenu", handleContextMenu);

    $("#zoom-in").addEventListener("click", () => zoomAt(1.2, state.width / 2, state.height / 2));
    $("#zoom-out").addEventListener("click", () => zoomAt(1 / 1.2, state.width / 2, state.height / 2));
    elements.zoomLevel.addEventListener("click", () => {
      state.camera.scale = 1;
      state.camera.x = state.width / 2;
      state.camera.y = state.height / 2;
      updateZoomLabel();
      scheduleRender();
    });
    $("#fit-graph").addEventListener("click", () => fitGraph(true));

    elements.contextMenu.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button || !state.contextId) return;
      handleContextAction(button.dataset.action, state.contextId);
      hideContextMenu();
    });

    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("#context-menu") && event.target !== canvas) hideContextMenu();
    });
    document.addEventListener("keydown", handleKeyDown);
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    hideContextMenu();
    const point = canvasPoint(event.clientX, event.clientY);
    const node = hitTest(event.clientX, event.clientY);
    state.pointer = { id: event.pointerId, startX: point.x, startY: point.y, lastX: point.x, lastY: point.y };
    state.dragMoved = false;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");

    if (node) {
      state.draggingId = node.id;
      const world = screenToWorld(point.x, point.y);
      updateNodePosition(node.id, world.x, world.y);
      state.worker.postMessage({ type: "drag", id: node.id, x: world.x, y: world.y });
    } else {
      state.panning = true;
    }
  }

  function handlePointerMove(event) {
    const point = canvasPoint(event.clientX, event.clientY);
    if (state.pointer?.id === event.pointerId) {
      const dx = point.x - state.pointer.lastX;
      const dy = point.y - state.pointer.lastY;
      if (Math.hypot(point.x - state.pointer.startX, point.y - state.pointer.startY) > 3) state.dragMoved = true;
      state.pointer.lastX = point.x;
      state.pointer.lastY = point.y;

      if (state.draggingId) {
        const world = screenToWorld(point.x, point.y);
        updateNodePosition(state.draggingId, world.x, world.y);
        state.worker.postMessage({ type: "drag", id: state.draggingId, x: world.x, y: world.y });
      } else if (state.panning) {
        state.camera.x += dx;
        state.camera.y += dy;
      }
      scheduleRender();
      return;
    }

    const node = hitTest(event.clientX, event.clientY);
    setHovered(node?.id ?? null, point);
  }

  function handlePointerUp(event) {
    if (!state.pointer || state.pointer.id !== event.pointerId) return;
    const releasedId = state.draggingId;
    const wasMoved = state.dragMoved;
    if (releasedId) {
      state.worker.postMessage({ type: "release", id: releasedId, pinned: state.pinned.has(releasedId) });
      if (!wasMoved) selectNode(releasedId);
    } else if (!wasMoved) {
      clearSelection();
    }

    state.pointer = null;
    state.draggingId = null;
    state.panning = false;
    state.dragMoved = false;
    canvas.classList.remove("is-dragging");
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  function handleWheel(event) {
    event.preventDefault();
    const point = canvasPoint(event.clientX, event.clientY);
    const factor = Math.exp(-event.deltaY * 0.0013);
    zoomAt(factor, point.x, point.y);
  }

  function handleContextMenu(event) {
    event.preventDefault();
    const node = hitTest(event.clientX, event.clientY);
    if (!node) {
      hideContextMenu();
      return;
    }
    state.contextId = node.id;
    const point = canvasPoint(event.clientX, event.clientY);
    const menuWidth = 190;
    const menuHeight = 132;
    elements.contextMenu.style.left = `${Math.min(point.x, state.width - menuWidth - 8)}px`;
    elements.contextMenu.style.top = `${Math.min(point.y, state.height - menuHeight - 8)}px`;
    const pinLabel = $("[data-action='pin'] span", elements.contextMenu);
    pinLabel.textContent = state.pinned.has(node.id) ? "Unpin node" : "Pin node";
    elements.contextMenu.hidden = false;
  }

  function handleContextAction(action, id) {
    const node = state.visibleById.get(id) ?? allNodeLookup.get(id);
    if (!node) return;
    if (action === "open") {
      selectNode(id);
      showToast(`Opened “${node.cleanName}”`);
    } else if (action === "local") {
      openLocalGraph(id);
    } else if (action === "pin") {
      togglePin(id);
    } else if (action === "copy") {
      const link = `[[${node.cleanName}]]`;
      navigator.clipboard?.writeText(link).catch(() => {});
      showToast(`Copied ${link}`);
    }
  }

  function handleKeyDown(event) {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openQuickSearch();
      return;
    }
    if (typing) return;

    if (event.key === "/") {
      event.preventDefault();
      openQuickSearch();
    } else if (event.key === "Escape") {
      hideContextMenu();
      if (state.quickQuery || elements.quickSearchWrap.classList.contains("is-visible")) closeQuickSearch();
      else clearSelection();
    } else if (event.key === "+" || event.key === "=") {
      zoomAt(1.18, state.width / 2, state.height / 2);
    } else if (event.key === "-") {
      zoomAt(1 / 1.18, state.width / 2, state.height / 2);
    } else if (event.key === "0") {
      fitGraph(true);
    } else if (event.key === " ") {
      event.preventDefault();
      toggleAnimation();
    } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      const amount = event.shiftKey ? 80 : 28;
      if (event.key === "ArrowLeft") state.camera.x += amount;
      if (event.key === "ArrowRight") state.camera.x -= amount;
      if (event.key === "ArrowUp") state.camera.y += amount;
      if (event.key === "ArrowDown") state.camera.y -= amount;
      scheduleRender();
    }
  }

  function rebuildGraph({ fit = false } = {}) {
    cacheCurrentPositions();
    const poolNodes = [...baseNodes];
    const poolLinks = [...baseLinks];

    if (state.showTags) {
      poolNodes.push(...synthetic.tags.nodes);
      poolLinks.push(...synthetic.tags.links);
    }
    if (state.showAttachments) {
      poolNodes.push(...synthetic.attachments.nodes);
      poolLinks.push(...synthetic.attachments.links);
    }
    if (!state.existingOnly) {
      poolNodes.push(...synthetic.unresolved.nodes);
      poolLinks.push(...synthetic.unresolved.links);
    }
    if (state.showOrphans) poolNodes.push(...synthetic.orphans.nodes);

    const poolById = new Map(poolNodes.map((node) => [node.id, node]));
    let allowedIds = new Set(poolById.keys());

    if (state.mode === "local") {
      const root = state.localRoot && poolById.has(state.localRoot) ? state.localRoot : baseNodes[0].id;
      state.localRoot = root;
      allowedIds = collectNeighborhood(root, state.localDepth, poolLinks, allowedIds);
    }

    if (state.filterQuery) {
      allowedIds = new Set([...allowedIds].filter((id) => id === state.localRoot || matchesQuery(poolById.get(id), state.filterQuery)));
    }

    if (!state.showOrphans) {
      const connected = new Set();
      poolLinks.forEach((link) => {
        if (allowedIds.has(link.source) && allowedIds.has(link.target)) {
          connected.add(link.source);
          connected.add(link.target);
        }
      });
      allowedIds = new Set([...allowedIds].filter((id) => connected.has(id) || id === state.localRoot));
    }

    state.visibleNodes = [...allowedIds].map((id) => ({ ...poolById.get(id) }));
    state.visibleLinks = poolLinks.filter((link) => allowedIds.has(link.source) && allowedIds.has(link.target));
    state.visibleById = new Map(state.visibleNodes.map((node) => [node.id, node]));
    state.visibleIndex = new Map(state.visibleNodes.map((node, index) => [node.id, index]));
    state.revealIndex = new Map([...state.visibleNodes]
      .sort((a, b) => a.createdOrder - b.createdOrder)
      .map((node, index) => [node.id, index]));
    buildAdjacency();
    applyGroupColors();

    state.layoutLinks = [...state.visibleLinks];

    if (state.selectedId && !state.visibleById.has(state.selectedId)) clearSelection();
    if (state.hoveredId && !state.visibleById.has(state.hoveredId)) setHovered(null);
    initializeWorkerLayout();
    updateCounts();
    renderGroupList();
    state.hasFitted = !fit && state.hasFitted;
    if (fit) state.hasFitted = false;
    scheduleRender();
  }

  function collectNeighborhood(root, depth, links, available) {
    const adjacency = new Map();
    links.forEach((link) => {
      if (!available.has(link.source) || !available.has(link.target)) return;
      if (!adjacency.has(link.source)) adjacency.set(link.source, new Set());
      if (!adjacency.has(link.target)) adjacency.set(link.target, new Set());
      adjacency.get(link.source).add(link.target);
      adjacency.get(link.target).add(link.source);
    });
    const visited = new Set([root]);
    let frontier = [root];
    for (let level = 0; level < depth; level += 1) {
      const next = [];
      frontier.forEach((id) => {
        adjacency.get(id)?.forEach((neighbor) => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            next.push(neighbor);
          }
        });
      });
      frontier = next;
      if (!frontier.length) break;
    }
    return visited;
  }

  function matchesQuery(node, query) {
    if (!node) return false;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    const terms = normalized.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
    return terms.every((term) => {
      let negate = false;
      if (term.startsWith("-")) {
        negate = true;
        term = term.slice(1);
      }
      term = term.replace(/^"|"$/g, "");
      let matched;
      if (term.startsWith("topic:")) matched = node.topic.toLowerCase().includes(term.slice(6).replace(/^"|"$/g, ""));
      else if (term.startsWith("path:")) matched = node.path.toLowerCase().includes(term.slice(5).replace(/^"|"$/g, ""));
      else if (term.startsWith("type:")) matched = node.type === term.slice(5);
      else if (term.startsWith("year:")) matched = String(node.year) === term.slice(5);
      else matched = `${node.name} ${node.topic} ${node.path} ${node.type}`.toLowerCase().includes(term);
      return negate ? !matched : matched;
    });
  }

  function buildAdjacency() {
    state.adjacency = new Map(state.visibleNodes.map((node) => [node.id, new Set()]));
    state.incoming = new Map(state.visibleNodes.map((node) => [node.id, 0]));
    state.outgoing = new Map(state.visibleNodes.map((node) => [node.id, 0]));
    state.visibleLinks.forEach((link) => {
      state.adjacency.get(link.source)?.add(link.target);
      state.adjacency.get(link.target)?.add(link.source);
      state.outgoing.set(link.source, (state.outgoing.get(link.source) ?? 0) + 1);
      state.incoming.set(link.target, (state.incoming.get(link.target) ?? 0) + 1);
    });
  }

  function applyGroupColors() {
    state.visibleNodes.forEach((node) => {
      const matching = state.groups.find((group) => group.enabled && groupMatches(group, node));
      node.color = matching?.color ?? syntheticColors[node.type] ?? mutedNode;
    });
  }

  function groupMatches(group, node) {
    if (group.topic) return node.topic === group.topic;
    return matchesQuery(node, group.query);
  }

  function initializeWorkerLayout() {
    state.workerRevision += 1;
    const revision = state.workerRevision;
    let sharedBuffer = null;
    let controlBuffer = null;
    if (typeof SharedArrayBuffer !== "undefined" && window.crossOriginIsolated) {
      sharedBuffer = new SharedArrayBuffer(state.visibleNodes.length * 2 * Float32Array.BYTES_PER_ELEMENT);
      controlBuffer = new SharedArrayBuffer(3 * Int32Array.BYTES_PER_ELEMENT);
      state.sharedPositions = new Float32Array(sharedBuffer);
      state.sharedSnapshot = new Float32Array(state.sharedPositions.length);
      state.sharedControl = new Int32Array(controlBuffer);
      state.sharedSequence = 0;
      state.sharedFrame = 0;
      state.runtimeMode = "Shared";
    } else {
      state.sharedPositions = null;
      state.sharedSnapshot = null;
      state.sharedControl = null;
      state.runtimeMode = "Transfer";
    }

    const nodes = state.visibleNodes.map((node) => {
      const cached = state.positionCache.get(node.id) ?? initialPosition(node);
      node.x = cached.x;
      node.y = cached.y;
      return { id: node.id, x: node.x, y: node.y, radius: node.radius * state.nodeScale, pinned: state.pinned.has(node.id) };
    });

    state.worker.postMessage({
      type: "init",
      revision,
      nodes,
      links: state.layoutLinks,
      forces: state.forces,
      sharedBuffer,
      controlBuffer
    });
    setWorkerStatus("active");
  }

  function initialPosition(node) {
    if (state.mode === "local" && node.id === state.localRoot) return { x: 0, y: 0 };
    const angleRandom = hashString(`${node.id}:angle`) / 0xffffffff;
    const radiusRandom = hashString(`${node.id}:radius`) / 0xffffffff;
    const degree = state.adjacency.get(node.id)?.size ?? 0;
    const hubBias = 1 - Math.min(0.58, degree / 24);
    const spread = state.mode === "local" ? 135 : 300;
    const radius = Math.sqrt(radiusRandom) * spread * hubBias;
    const angle = angleRandom * Math.PI * 2;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    };
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function handleWorkerMessage({ data }) {
    if (data.revision !== state.workerRevision) return;
    if (data.type === "positions") {
      consumePositions(new Float32Array(data.positions), data.frame);
    } else if (data.type === "status") {
      setWorkerStatus(data.status);
    } else if (data.type === "stats") {
      state.workerStats = data;
      elements.workerStatus.title = `Barnes–Hut ${data.tickMs.toFixed(2)}ms · tree ${data.treeMs.toFixed(2)}ms · ${data.exactChecks.toLocaleString()} exact checks · ${data.overlapCount.toLocaleString()} overlaps · max ${data.maxOverlap.toFixed(2)}px · ${data.collisionIterations} collision passes`;
    } else if (data.type === "ready") {
      state.runtimeMode = data.shared ? "Shared" : "Transfer";
      setWorkerStatus("active");
    }
  }

  function monitorSharedPositions() {
    if (state.sharedPositions && state.sharedSnapshot && state.sharedControl) {
      const sequenceBefore = Atomics.load(state.sharedControl, 0);
      if (sequenceBefore !== state.sharedSequence && sequenceBefore % 2 === 0) {
        state.sharedSnapshot.set(state.sharedPositions);
        const frame = Atomics.load(state.sharedControl, 1);
        const sequenceAfter = Atomics.load(state.sharedControl, 0);
        if (sequenceBefore === sequenceAfter) {
          state.sharedSequence = sequenceAfter;
          state.sharedFrame = frame;
          consumePositions(state.sharedSnapshot, frame);
        }
      }
    }
    state.monitorFrame = requestAnimationFrame(monitorSharedPositions);
  }

  function consumePositions(positions, frame) {
    if (!positions || positions.length < state.visibleNodes.length * 2) return;
    state.visibleNodes.forEach((node, index) => {
      node.x = positions[index * 2];
      node.y = positions[index * 2 + 1];
      state.positionCache.set(node.id, { x: node.x, y: node.y });
    });
    if (!state.hasFitted && frame >= 6) {
      fitGraph(false);
      state.hasFitted = true;
    }
    if (!state.loadingDismissed && frame >= 4) dismissLoading();
    scheduleRender();
  }

  function handleWorkerError(error) {
    console.error("Graph worker failed", error);
    elements.workerStatus.textContent = "Layout unavailable";
    elements.statusPulse.classList.remove("is-active");
    dismissLoading();
  }

  function cacheCurrentPositions() {
    state.visibleNodes.forEach((node) => {
      if (Number.isFinite(node.x) && Number.isFinite(node.y)) state.positionCache.set(node.id, { x: node.x, y: node.y });
    });
  }

  function updateNodePosition(id, x, y) {
    const node = state.visibleById.get(id);
    if (!node) return;
    node.x = x;
    node.y = y;
    state.positionCache.set(id, { x, y });
  }

  function setWorkerStatus(status) {
    const active = status === "active";
    elements.workerStatus.textContent = `${active ? "Layout active" : "Layout settled"} · ${state.rendererMode}/${state.runtimeMode}`;
    elements.statusPulse.classList.toggle("is-active", active);
  }

  function resizeCanvas() {
    const bounds = canvas.parentElement.getBoundingClientRect();
    const previousWidth = state.width;
    const previousHeight = state.height;
    state.width = Math.max(1, bounds.width);
    state.height = Math.max(1, bounds.height);
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    state.renderer?.resize(state.width, state.height, state.dpr);
    if (previousWidth > 1) {
      state.camera.x += (state.width - previousWidth) / 2;
      state.camera.y += (state.height - previousHeight) / 2;
    } else {
      state.camera.x = state.width / 2;
      state.camera.y = state.height / 2;
    }
    scheduleRender();
  }

  function scheduleRender() {
    if (state.renderPending) return;
    state.renderPending = true;
    requestAnimationFrame(render);
  }

  function render() {
    state.renderPending = false;
    if (state.renderer) {
      context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      context.clearRect(0, 0, state.width, state.height);
      if (!state.visibleNodes.length) renderEmptyState();
      else state.renderer.render(state);
      return;
    }

    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    context.clearRect(0, 0, state.width, state.height);
    if (!state.visibleNodes.length) {
      renderEmptyState();
      return;
    }

    const revealCutoff = getRevealCutoff();
    const revealed = new Set(state.visibleNodes.filter((node) => node.createdOrder <= revealCutoff).map((node) => node.id));
    const focusId = state.hoveredId;
    const focusNeighbors = focusId ? state.adjacency.get(focusId) ?? new Set() : null;
    renderLinks(revealed, focusId, focusNeighbors);
    renderNodes(revealed, focusId, focusNeighbors);
    renderLabels(revealed, focusId, focusNeighbors);
  }

  function renderEmptyState() {
    context.save();
    context.textAlign = "center";
    context.fillStyle = "#6d6a66";
    context.font = '500 13px "DM Sans", sans-serif';
    context.fillText("No notes match the current filters", state.width / 2, state.height / 2 - 3);
    context.fillStyle = "#4f4d4a";
    context.font = '400 10px "DM Sans", sans-serif';
    context.fillText("Clear the search query to restore the graph", state.width / 2, state.height / 2 + 17);
    context.restore();
  }

  function renderLinks(revealed, focusId, focusNeighbors) {
    context.save();
    context.lineCap = "round";
    for (const link of state.visibleLinks) {
      if (!revealed.has(link.source) || !revealed.has(link.target)) continue;
      const sourceNode = state.visibleById.get(link.source);
      const targetNode = state.visibleById.get(link.target);
      if (!sourceNode || !targetNode) continue;
      const sourcePoint = worldToScreen(sourceNode.x, sourceNode.y);
      const targetPoint = worldToScreen(targetNode.x, targetNode.y);
      if (!lineIntersectsViewport(sourcePoint, targetPoint, 40)) continue;

      const connected = focusId && (link.source === focusId || link.target === focusId);
      const faded = focusId && !connected;
      let alpha = 0.12 + Math.max(0, link.weight - 0.75) * 0.26;
      if (link.type !== "internal") alpha *= 0.75;
      if (connected) alpha = 0.62;
      if (faded) alpha = 0.018;
      context.strokeStyle = colorWithAlpha(connected ? "#c0b5d8" : "#888682", alpha);
      context.lineWidth = Math.max(0.35, state.linkThickness * (connected ? 1.15 : 0.62));
      context.beginPath();
      context.moveTo(sourcePoint.x, sourcePoint.y);
      context.lineTo(targetPoint.x, targetPoint.y);
      context.stroke();

      if (state.arrows && (connected || state.camera.scale > 1.35)) drawArrow(sourcePoint, targetPoint, targetNode, alpha);
    }
    context.restore();
  }

  function drawArrow(sourcePoint, targetPoint, targetNode, alpha) {
    const dx = targetPoint.x - sourcePoint.x;
    const dy = targetPoint.y - sourcePoint.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 14) return;
    const ux = dx / distance;
    const uy = dy / distance;
    const nodeRadius = Math.max(2.5, targetNode.radius * state.nodeScale * state.camera.scale);
    const tipX = targetPoint.x - ux * (nodeRadius + 2);
    const tipY = targetPoint.y - uy * (nodeRadius + 2);
    const size = 3.2;
    context.fillStyle = colorWithAlpha("#aaa5b0", Math.min(0.7, alpha + 0.14));
    context.beginPath();
    context.moveTo(tipX, tipY);
    context.lineTo(tipX - ux * size - uy * size * 0.72, tipY - uy * size + ux * size * 0.72);
    context.lineTo(tipX - ux * size + uy * size * 0.72, tipY - uy * size - ux * size * 0.72);
    context.closePath();
    context.fill();
  }

  function renderNodes(revealed, focusId, focusNeighbors) {
    const searchMatches = state.quickQuery ? new Set(state.visibleNodes.filter((node) => matchesQuickSearch(node)).map((node) => node.id)) : null;
    context.save();
    for (const node of state.visibleNodes) {
      if (!revealed.has(node.id)) continue;
      const point = worldToScreen(node.x, node.y);
      const radius = Math.max(1.15, node.radius * state.nodeScale * state.camera.scale);
      if (!pointInViewport(point, radius + 14)) continue;
      const isFocus = node.id === focusId;
      const isSelected = node.id === state.selectedId;
      const isNeighbor = focusNeighbors?.has(node.id);
      const isSearchMatch = searchMatches?.has(node.id);
      const faded = focusId && !isFocus && !isNeighbor;
      const searchFaded = searchMatches && searchMatches.size && !isSearchMatch;
      const alpha = faded ? 0.13 : searchFaded ? 0.18 : 0.9;

      if (isFocus || isSelected || isSearchMatch) {
        const glowRadius = radius * (isSelected ? 3.8 : 3.1) + 5;
        const glow = context.createRadialGradient(point.x, point.y, radius * 0.3, point.x, point.y, glowRadius);
        glow.addColorStop(0, colorWithAlpha(node.color, isSelected ? 0.28 : 0.21));
        glow.addColorStop(1, colorWithAlpha(node.color, 0));
        context.fillStyle = glow;
        context.beginPath();
        context.arc(point.x, point.y, glowRadius, 0, Math.PI * 2);
        context.fill();
      }

      if (node.type === "attachment") {
        const size = radius * 1.42;
        context.fillStyle = colorWithAlpha(node.color, alpha * 0.78);
        context.beginPath();
        context.rect(point.x - size / 2, point.y - size / 2, size, size);
        context.fill();
      } else if (node.type === "unresolved") {
        context.strokeStyle = colorWithAlpha(node.color, alpha * 0.82);
        context.lineWidth = 1;
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.stroke();
      } else if (node.type === "tag") {
        context.fillStyle = colorWithAlpha(node.color, alpha * 0.86);
        context.beginPath();
        for (let corner = 0; corner < 6; corner += 1) {
          const angle = Math.PI / 3 * corner;
          const x = point.x + Math.cos(angle) * radius;
          const y = point.y + Math.sin(angle) * radius;
          if (corner === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.closePath();
        context.fill();
      } else {
        context.fillStyle = colorWithAlpha(node.color, alpha);
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();
      }

      if (isSelected || state.pinned.has(node.id)) {
        context.strokeStyle = colorWithAlpha(isSelected ? "#e5dffc" : "#b0a3ce", isSelected ? 0.78 : 0.52);
        context.lineWidth = isSelected ? 1.15 : 0.8;
        context.beginPath();
        context.arc(point.x, point.y, radius + 2.6, 0, Math.PI * 2);
        context.stroke();
      }
    }
    context.restore();
  }

  function renderLabels(revealed, focusId, focusNeighbors) {
    const candidates = state.visibleNodes.filter((node) => revealed.has(node.id)).map((node) => {
      const importance = Math.min(1, (node.val ?? 10) / 60) * 0.62 + Math.min(1, ((state.incoming.get(node.id) ?? 0) + (state.outgoing.get(node.id) ?? 0)) / 14) * 0.38;
      const priority = node.id === focusId || node.id === state.selectedId ? 10 : matchesQuickSearch(node) && state.quickQuery ? 8 : importance;
      return { node, importance, priority };
    }).filter(({ node, importance, priority }) => {
      if (priority > 1) return true;
      const zoomBonus = Math.max(0, Math.log2(state.camera.scale + 0.3)) * 0.22;
      return importance + zoomBonus >= state.textFade;
    }).sort((a, b) => b.priority - a.priority);

    const occupied = [];
    context.save();
    context.textBaseline = "middle";
    for (const { node, priority } of candidates) {
      const point = worldToScreen(node.x, node.y);
      if (!pointInViewport(point, 40)) continue;
      const focused = node.id === focusId || node.id === state.selectedId;
      const neighbor = focusNeighbors?.has(node.id);
      const faded = focusId && !focused && !neighbor;
      const fontSize = focused ? 11.5 : Math.min(10.5, 8.2 + state.camera.scale * 1.15);
      context.font = `${focused ? 500 : 400} ${fontSize}px "DM Sans", "Segoe UI", sans-serif`;
      const label = truncateLabel(node.cleanName, focused ? 55 : state.camera.scale > 1.35 ? 38 : 27);
      const width = context.measureText(label).width;
      const radius = Math.max(1.15, node.radius * state.nodeScale * state.camera.scale);
      const rect = { x: point.x + radius + 4, y: point.y - fontSize / 2 - 1, width: width + 3, height: fontSize + 2 };
      if (priority <= 1 && occupied.some((other) => rectanglesOverlap(rect, other))) continue;
      occupied.push(rect);
      context.fillStyle = focused ? "rgba(231,227,235,.94)" : faded ? "rgba(126,123,120,.08)" : "rgba(180,176,171,.57)";
      context.fillText(label, rect.x, point.y + 0.3);
    }
    context.restore();
  }

  function getRevealCutoff() {
    if (state.animation.progress >= 1) return Infinity;
    const orders = state.visibleNodes.map((node) => node.createdOrder).sort((a, b) => a - b);
    const index = Math.min(orders.length - 1, Math.floor(state.animation.progress * orders.length));
    return orders[index] ?? Infinity;
  }

  function lineIntersectsViewport(a, b, margin) {
    return !(Math.max(a.x, b.x) < -margin || Math.min(a.x, b.x) > state.width + margin || Math.max(a.y, b.y) < -margin || Math.min(a.y, b.y) > state.height + margin);
  }

  function pointInViewport(point, margin) {
    return point.x >= -margin && point.x <= state.width + margin && point.y >= -margin && point.y <= state.height + margin;
  }

  function colorWithAlpha(color, alpha) {
    if (color.startsWith("rgba")) return color;
    const hex = color.replace("#", "");
    const normalized = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
    const value = Number.parseInt(normalized, 16);
    return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${Math.max(0, Math.min(1, alpha))})`;
  }

  function truncateLabel(label, length) {
    return label.length > length ? `${label.slice(0, length - 1)}…` : label;
  }

  function rectanglesOverlap(a, b) {
    return a.x < b.x + b.width + 4 && a.x + a.width + 4 > b.x && a.y < b.y + b.height + 2 && a.y + a.height + 2 > b.y;
  }

  function canvasPoint(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  }

  function worldToScreen(x, y) {
    return { x: x * state.camera.scale + state.camera.x, y: y * state.camera.scale + state.camera.y };
  }

  function screenToWorld(x, y) {
    return { x: (x - state.camera.x) / state.camera.scale, y: (y - state.camera.y) / state.camera.scale };
  }

  function hitTest(clientX, clientY) {
    const point = canvasPoint(clientX, clientY);
    let best = null;
    let bestDistance = Infinity;
    for (const node of state.visibleNodes) {
      if (node.createdOrder > getRevealCutoff()) continue;
      const screen = worldToScreen(node.x, node.y);
      const distance = Math.hypot(point.x - screen.x, point.y - screen.y);
      const hitRadius = Math.max(7, node.radius * state.nodeScale * state.camera.scale + 3);
      if (distance <= hitRadius && distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }
    return best;
  }

  function setHovered(id, point) {
    if (state.hoveredId === id) {
      if (id && point) positionHoverLabel(point);
      return;
    }
    state.hoveredId = id;
    if (!id) {
      elements.hoverLabel.hidden = true;
      canvas.style.cursor = state.panning ? "grabbing" : "grab";
    } else {
      const node = state.visibleById.get(id);
      elements.hoverLabel.textContent = node.name;
      elements.hoverLabel.hidden = false;
      if (point) positionHoverLabel(point);
      canvas.style.cursor = "pointer";
    }
    scheduleRender();
  }

  function positionHoverLabel(point) {
    const width = elements.hoverLabel.offsetWidth;
    const x = Math.min(point.x + 12, state.width - width - 8);
    const y = Math.max(8, point.y - 31);
    elements.hoverLabel.style.left = `${x}px`;
    elements.hoverLabel.style.top = `${y}px`;
  }

  function selectNode(id) {
    const node = state.visibleById.get(id);
    if (!node) return;
    state.selectedId = id;
    elements.nodeType.textContent = node.type.toUpperCase();
    elements.nodeTitle.textContent = node.cleanName;
    elements.nodePath.textContent = node.path;
    elements.nodeLinks.textContent = state.outgoing.get(id) ?? fullDegrees.outgoing.get(id) ?? 0;
    elements.nodeBacklinks.textContent = state.incoming.get(id) ?? fullDegrees.incoming.get(id) ?? 0;
    elements.nodeYear.textContent = node.year ?? "—";
    updatePinButton();
    elements.nodeCard.hidden = false;
    scheduleRender();
  }

  function clearSelection() {
    state.selectedId = null;
    elements.nodeCard.hidden = true;
    scheduleRender();
  }

  function togglePin(id) {
    if (state.pinned.has(id)) state.pinned.delete(id);
    else state.pinned.add(id);
    state.worker.postMessage({ type: "pin", id, pinned: state.pinned.has(id) });
    updatePinButton();
    showToast(state.pinned.has(id) ? "Node pinned" : "Node unpinned");
    scheduleRender();
  }

  function updatePinButton() {
    const pinned = state.selectedId && state.pinned.has(state.selectedId);
    elements.pinNode.classList.toggle("is-pinned", Boolean(pinned));
    $("span", elements.pinNode).textContent = pinned ? "Unpin" : "Pin";
  }

  function openLocalGraph(id) {
    state.localRoot = id;
    setMode("local");
    selectNode(id);
  }

  function setMode(mode) {
    if (mode === state.mode && mode === "global") return;
    if (mode === "local" && !state.localRoot) state.localRoot = state.selectedId ?? baseNodes[0].id;
    state.mode = mode;
    $$(".mode-button").forEach((button) => button.classList.toggle("is-active", button.dataset.mode === mode));
    elements.localDepthRow.hidden = mode !== "local";
    elements.viewTitle.textContent = mode === "local" ? "Local graph" : "Graph view";
    rebuildGraph({ fit: true });
  }

  function fitGraph(animate) {
    const positioned = state.visibleNodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
    if (!positioned.length) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    positioned.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    });
    const graphWidth = Math.max(80, maxX - minX);
    const graphHeight = Math.max(80, maxY - minY);
    const panelSpace = state.panelOpen && state.width > 640 ? 276 : 0;
    const availableWidth = Math.max(240, state.width - panelSpace - 80);
    const availableHeight = Math.max(200, state.height - 100);
    const targetScale = Math.max(0.22, Math.min(2.4, Math.min(availableWidth / graphWidth, availableHeight / graphHeight) * 0.91));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const visibleCenterX = (state.width - panelSpace) / 2;
    const target = {
      scale: targetScale,
      x: visibleCenterX - centerX * targetScale,
      y: state.height / 2 - centerY * targetScale
    };
    if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) animateCamera(target);
    else {
      Object.assign(state.camera, target);
      updateZoomLabel();
      scheduleRender();
    }
  }

  function animateCamera(target) {
    const start = { ...state.camera };
    const startedAt = performance.now();
    const duration = 320;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      state.camera.scale = lerp(start.scale, target.scale, eased);
      state.camera.x = lerp(start.x, target.x, eased);
      state.camera.y = lerp(start.y, target.y, eased);
      updateZoomLabel();
      scheduleRender();
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function centerOnNode(id) {
    const node = state.visibleById.get(id);
    if (!node) return;
    const panelSpace = state.panelOpen && state.width > 640 ? 276 : 0;
    animateCamera({
      scale: Math.max(1.2, state.camera.scale),
      x: (state.width - panelSpace) / 2 - node.x * Math.max(1.2, state.camera.scale),
      y: state.height / 2 - node.y * Math.max(1.2, state.camera.scale)
    });
  }

  function zoomAt(factor, screenX, screenY) {
    const oldScale = state.camera.scale;
    const nextScale = Math.max(0.18, Math.min(5, oldScale * factor));
    const worldX = (screenX - state.camera.x) / oldScale;
    const worldY = (screenY - state.camera.y) / oldScale;
    state.camera.scale = nextScale;
    state.camera.x = screenX - worldX * nextScale;
    state.camera.y = screenY - worldY * nextScale;
    updateZoomLabel();
    scheduleRender();
  }

  function updateZoomLabel() {
    elements.zoomLevel.textContent = `${Math.round(state.camera.scale * 100)}%`;
  }

  function toggleAnimation() {
    if (state.animation.active) {
      state.animation.active = false;
      cancelAnimationFrame(state.animation.frame);
      updateAnimateButton();
      return;
    }
    state.animation.active = true;
    if (state.animation.progress >= 1) state.animation.progress = 0;
    state.animation.startedAt = performance.now() - state.animation.progress * state.animation.duration;
    updateAnimateButton();
    state.animation.frame = requestAnimationFrame(tickAnimation);
  }

  function tickAnimation(now) {
    if (!state.animation.active) return;
    state.animation.progress = Math.min(1, (now - state.animation.startedAt) / state.animation.duration);
    scheduleRender();
    const visible = Math.max(1, Math.floor(state.visibleNodes.length * state.animation.progress));
    elements.graphCount.textContent = `${visible} / ${state.visibleNodes.length} nodes · timeline`;
    if (state.animation.progress < 1) state.animation.frame = requestAnimationFrame(tickAnimation);
    else {
      state.animation.active = false;
      updateAnimateButton();
      updateCounts();
    }
  }

  function updateAnimateButton() {
    const use = $("use", elements.animate);
    const label = $("span", elements.animate);
    use.setAttribute("href", state.animation.active ? "#i-pause" : "#i-play");
    label.textContent = state.animation.active ? "Pause" : state.animation.progress < 1 ? "Resume" : "Animate";
  }

  function renderGroupList() {
    elements.groupList.replaceChildren(...state.groups.map((group) => {
      const row = document.createElement("div");
      row.className = "group-row";
      const count = state.visibleNodes.filter((node) => groupMatches(group, node)).length;
      row.innerHTML = `<button class="group-swatch" style="--swatch:${group.color}" aria-label="Toggle group color"></button><input class="group-query" aria-label="Group query" value="${escapeAttribute(group.query)}"><span class="group-count">${count}</span>`;
      const swatch = $(".group-swatch", row);
      const query = $(".group-query", row);
      swatch.style.opacity = group.enabled ? "1" : ".25";
      swatch.addEventListener("click", () => {
        group.enabled = !group.enabled;
        swatch.style.opacity = group.enabled ? "1" : ".25";
        applyGroupColors();
        scheduleRender();
      });
      query.addEventListener("change", () => {
        group.query = query.value.trim() || group.query;
        group.topic = null;
        applyGroupColors();
        renderGroupList();
        scheduleRender();
      });
      return row;
    }));
  }

  function addGroup() {
    const palette = ["#e4be66", "#67c4a3", "#dd7d9b", "#78a4e3", "#c488df"];
    const index = state.groups.length;
    state.groups.push({ id: `custom-${index}`, query: "year:2026", topic: null, color: palette[index % palette.length], enabled: true });
    renderGroupList();
    const section = elements.groupList.closest(".control-section");
    section.classList.add("is-open");
    $(".section-heading", section).setAttribute("aria-expanded", "true");
    const inputs = $$(".group-query", elements.groupList);
    inputs.at(-1)?.focus();
    inputs.at(-1)?.select();
    applyGroupColors();
    scheduleRender();
  }

  function escapeAttribute(value) {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function setPanelOpen(open) {
    state.panelOpen = open;
    elements.panel.classList.toggle("is-closed", !open);
    elements.panelToggle.setAttribute("aria-expanded", String(open));
    elements.panelToggle.setAttribute("aria-label", open ? "Hide graph controls" : "Show graph controls");
    setTimeout(() => fitGraph(true), 210);
  }

  function openQuickSearch() {
    elements.quickSearchWrap.classList.add("is-visible");
    elements.quickSearch.focus();
    elements.quickSearch.select();
  }

  function closeQuickSearch() {
    state.quickQuery = "";
    elements.quickSearch.value = "";
    elements.quickSearchWrap.classList.remove("is-visible");
    elements.quickSearch.blur();
    scheduleRender();
  }

  function focusFirstSearchResult() {
    const result = state.visibleNodes
      .filter(matchesQuickSearch)
      .sort((a, b) => (b.val ?? 0) - (a.val ?? 0))[0];
    if (!result) {
      showToast("No matching note");
      return;
    }
    selectNode(result.id);
    centerOnNode(result.id);
  }

  function matchesQuickSearch(node) {
    if (!state.quickQuery) return false;
    return `${node.name} ${node.topic} ${node.path}`.toLowerCase().includes(state.quickQuery);
  }

  function hideContextMenu() {
    elements.contextMenu.hidden = true;
    state.contextId = null;
  }

  function updateCounts() {
    elements.graphCount.textContent = `${state.visibleNodes.length.toLocaleString()} nodes · ${state.visibleLinks.length.toLocaleString()} links`;
  }

  function dismissLoading() {
    if (state.loadingDismissed) return;
    state.loadingDismissed = true;
    elements.loadingStatus.textContent = `${state.visibleNodes.length} notes indexed`;
    setTimeout(() => elements.loading.classList.add("is-hidden"), 180);
  }

  let toastTimer = 0;
  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 1900);
  }

  function debounce(callback, delay) {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => callback(...args), delay);
    };
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }
})();
