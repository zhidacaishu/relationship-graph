(() => {
  "use strict";

  const sharedTags = ["reference", "idea", "review", "workflow", "writing", "learning", "design", "research"];
  const folderSpecs = [
    {
      folder: "00 Meta",
      tags: ["meta", "moc"],
      titles: [
        "Home",
        "Maps of Content",
        "Graph Guide",
        "Search Playbook",
        "Tag Taxonomy",
        "Folder Conventions",
        "Linking Principles",
        "Note Lifecycle",
        "Review Dashboard",
        "Capture Workflow",
        "Knowledge Garden",
        "Vault Roadmap",
        "Templates Index",
        "Reading Index",
        "Project Index",
        "People Index"
      ]
    },
    {
      folder: "01 Daily",
      tags: ["daily", "journal"],
      titles: [
        "Daily Notes",
        "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05",
        "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10",
        "2026-07-11", "2026-07-12", "2026-07-13", "2026-07-14", "2026-07-15",
        "2026-07-16", "2026-07-17", "2026-07-18", "2026-07-19", "2026-07-20"
      ]
    },
    {
      folder: "02 Areas",
      tags: ["area", "ongoing"],
      titles: [
        "Areas Dashboard",
        "Personal Knowledge Management",
        "Writing Practice",
        "Learning Systems",
        "Health Routines",
        "Creative Coding",
        "Product Thinking",
        "Team Leadership",
        "Research Methods",
        "Design Systems",
        "Financial Planning",
        "Reading Practice",
        "Public Speaking",
        "Home Studio",
        "Open Source",
        "Career Development",
        "Community Building",
        "Digital Gardening",
        "Attention Management",
        "Decision Making"
      ]
    },
    {
      folder: "03 Projects",
      tags: ["project", "active"],
      titles: [
        "Projects Dashboard",
        "Project Atlas Brief",
        "Project Atlas Research",
        "Project Atlas Architecture",
        "Project Atlas Milestones",
        "Project Atlas Retrospective",
        "Project Lantern Brief",
        "Project Lantern User Interviews",
        "Project Lantern Prototype",
        "Project Lantern Launch Plan",
        "Project Orchard Brief",
        "Project Orchard Content Model",
        "Project Orchard Design Review",
        "Project Orchard Metrics",
        "Course Notes Refresh",
        "Course Notes Curriculum",
        "Course Notes Recording Plan",
        "Course Notes Publishing Checklist",
        "Studio Website Brief",
        "Studio Website Information Architecture",
        "Studio Website Visual Direction",
        "Studio Website Build Log",
        "Community Handbook",
        "Community Handbook Editorial Plan"
      ]
    },
    {
      folder: "04 Resources",
      tags: ["resource", "library"],
      titles: [
        "Resources Library",
        "Graph Visualization Patterns",
        "Force Directed Layout Notes",
        "Information Retrieval Primer",
        "Local First Software",
        "Progressive Disclosure",
        "Search Interface Patterns",
        "Knowledge Graph Vocabulary",
        "Obsidian Workflow Notes",
        "Canvas Interaction Patterns",
        "Typography for Dense Interfaces",
        "Color in Network Diagrams",
        "Web Worker Field Notes",
        "Rendering Performance Checklist",
        "Accessibility for Canvas Apps",
        "Research Interview Guide",
        "Product Discovery Toolkit",
        "Writing Systems Handbook",
        "Learning Science Highlights",
        "Digital Garden Examples",
        "Meeting Facilitation Guide",
        "Decision Log Template",
        "Project Retrospective Prompts",
        "Reference Management Workflow"
      ]
    },
    {
      folder: "05 People",
      tags: ["person", "network"],
      titles: [
        "People Directory",
        "Avery Chen",
        "Mina Patel",
        "Noah Williams",
        "Sofia Alvarez",
        "Eli Thompson",
        "Leah Kim",
        "Owen Brooks",
        "Nora Singh",
        "Theo Martin",
        "Iris Walker",
        "Luca Rossi",
        "Maya Johnson",
        "Samira Haddad",
        "Jonas Berg",
        "Rina Sato",
        "Caleb Green",
        "Amara Okafor"
      ]
    },
    {
      folder: "06 Meetings",
      tags: ["meeting", "collaboration"],
      titles: [
        "Meeting Notes",
        "Atlas Kickoff",
        "Atlas Architecture Review",
        "Atlas Weekly Sync 01",
        "Atlas Weekly Sync 02",
        "Atlas Research Readout",
        "Lantern Interview Debrief",
        "Lantern Prototype Critique",
        "Lantern Launch Review",
        "Orchard Content Workshop",
        "Orchard Design Critique",
        "Course Planning Session",
        "Course Recording Retrospective",
        "Studio Website Critique",
        "Community Handbook Workshop",
        "Monthly Area Review",
        "Reading Group - Local First",
        "Reading Group - Knowledge Graphs",
        "Mentoring Notes - July",
        "Open Source Maintainers Call"
      ]
    },
    {
      folder: "07 Archive",
      tags: ["archive", "inactive"],
      titles: [
        "Archive Index",
        "2025 Annual Review",
        "Old Capture Workflow",
        "Retired Tag Scheme",
        "Project Compass Retrospective",
        "Project Mosaic Retrospective",
        "Previous Website Notes",
        "Deprecated Templates",
        "Reading List 2024",
        "Workshop Notes 2025",
        "Old Research Queue",
        "Legacy Dashboard",
        "Abandoned App Concepts",
        "Completed Experiments"
      ]
    }
  ];

  const orphanTitles = [
    "Unsorted Thought",
    "Book Quote Fragment",
    "Sketch for Later",
    "Temporary Packing List",
    "Untitled Voice Memo",
    "Coffee Shop Observation",
    "Loose Color Palette",
    "One Line Story",
    "Weekend Idea",
    "Draft Without Context"
  ];

  const nodes = [];
  const links = [];
  const idsByFolder = new Map();
  const idsByTitle = new Map();
  const linkKeys = new Set();
  let globalIndex = 0;

  const slugify = (value) => value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const addLink = (source, target, type = "wiki") => {
    if (!source || !target || source === target) return;
    const key = `${source}>${target}`;
    if (linkKeys.has(key)) return;
    linkKeys.add(key);
    links.push({ source, target, type });
  };

  for (const [folderIndex, spec] of folderSpecs.entries()) {
    const folderIds = [];
    for (const [titleIndex, title] of spec.titles.entries()) {
      const id = `note:${slugify(`${spec.folder}-${title}`)}`;
      const tags = [...new Set([
        ...spec.tags,
        sharedTags[(globalIndex + folderIndex) % sharedTags.length],
        ...(titleIndex === 0 ? ["index"] : []),
        ...(title.includes("Atlas") ? ["atlas"] : []),
        ...(title.includes("Review") || title.includes("Retrospective") ? ["review"] : [])
      ])];
      const attachments = [];
      if (globalIndex % 8 === 0 && titleIndex !== 0) attachments.push(`${slugify(title)}-map.canvas`);
      if (globalIndex % 13 === 0 && titleIndex !== 0) attachments.push(`${slugify(title)}-notes.pdf`);
      const unresolved = globalIndex % 11 === 0 && titleIndex !== 0
        ? [`${title} - Follow up`]
        : [];

      nodes.push({
        id,
        name: title,
        path: `${spec.folder}/${title}.md`,
        folder: spec.folder,
        tags,
        aliases: titleIndex === 0 ? [`${spec.folder} index`] : [],
        attachments,
        unresolved
      });
      folderIds.push(id);
      idsByTitle.set(title, id);
      globalIndex += 1;
    }
    idsByFolder.set(spec.folder, folderIds);
  }

  orphanTitles.forEach((title) => {
    const id = `note:${slugify(`99 Inbox-${title}`)}`;
    nodes.push({
      id,
      name: title,
      path: `99 Inbox/${title}.md`,
      folder: "99 Inbox",
      tags: ["inbox"],
      aliases: [],
      attachments: [],
      unresolved: []
    });
    idsByTitle.set(title, id);
  });

  for (const spec of folderSpecs) {
    const folderIds = idsByFolder.get(spec.folder);
    const hub = folderIds[0];
    for (let index = 1; index < folderIds.length; index += 1) {
      addLink(folderIds[index], hub);
      if (index > 1) addLink(folderIds[index], folderIds[index - 1]);
      if (index >= 4 && index % 3 === 0) addLink(folderIds[index], folderIds[index - 3]);
      if (index >= 7 && index % 5 === 0) addLink(folderIds[index], folderIds[index - 7]);
    }
  }

  const home = idsByTitle.get("Home");
  for (const spec of folderSpecs.slice(1)) addLink(home, idsByFolder.get(spec.folder)[0]);

  [
    ["Maps of Content", "Areas Dashboard"],
    ["Maps of Content", "Projects Dashboard"],
    ["Maps of Content", "Resources Library"],
    ["Project Index", "Projects Dashboard"],
    ["People Index", "People Directory"],
    ["Reading Index", "Resources Library"],
    ["Graph Guide", "Graph Visualization Patterns"],
    ["Graph Guide", "Force Directed Layout Notes"],
    ["Search Playbook", "Information Retrieval Primer"],
    ["Linking Principles", "Knowledge Graph Vocabulary"],
    ["Capture Workflow", "Daily Notes"],
    ["Knowledge Garden", "Digital Gardening"],
    ["Project Atlas Brief", "Graph Visualization Patterns"],
    ["Project Atlas Research", "Research Methods"],
    ["Project Atlas Architecture", "Web Worker Field Notes"],
    ["Project Atlas Architecture", "Rendering Performance Checklist"],
    ["Project Lantern User Interviews", "Research Interview Guide"],
    ["Project Lantern Prototype", "Canvas Interaction Patterns"],
    ["Project Orchard Content Model", "Knowledge Graph Vocabulary"],
    ["Course Notes Curriculum", "Learning Systems"],
    ["Studio Website Visual Direction", "Design Systems"],
    ["Community Handbook", "Community Building"],
    ["Atlas Architecture Review", "Project Atlas Architecture"],
    ["Atlas Research Readout", "Project Atlas Research"],
    ["Lantern Interview Debrief", "Project Lantern User Interviews"],
    ["Orchard Design Critique", "Project Orchard Design Review"],
    ["Reading Group - Local First", "Local First Software"],
    ["Reading Group - Knowledge Graphs", "Knowledge Graph Vocabulary"],
    ["Monthly Area Review", "Areas Dashboard"],
    ["2025 Annual Review", "Archive Index"],
    ["Project Compass Retrospective", "Project Retrospective Prompts"]
  ].forEach(([sourceTitle, targetTitle]) => addLink(idsByTitle.get(sourceTitle), idsByTitle.get(targetTitle)));

  const dailyIds = idsByFolder.get("01 Daily").slice(1);
  const areaIds = idsByFolder.get("02 Areas").slice(1);
  const projectIds = idsByFolder.get("03 Projects").slice(1);
  const peopleIds = idsByFolder.get("05 People").slice(1);
  const meetingIds = idsByFolder.get("06 Meetings").slice(1);

  dailyIds.forEach((id, index) => {
    addLink(id, areaIds[index % areaIds.length]);
    if (index % 2 === 0) addLink(id, projectIds[(index * 3) % projectIds.length]);
  });
  meetingIds.forEach((id, index) => {
    addLink(id, peopleIds[index % peopleIds.length]);
    if (index > 0) addLink(id, projectIds[(index * 2) % projectIds.length]);
  });

  window.PRECOMPUTED_GRAPH_DATA = {
    meta: {
      vaultName: "Atlas Vault",
      generatedAt: "2026-08-01",
      description: "Deterministic mock Obsidian-style vault graph with unweighted relationships."
    },
    nodes,
    links
  };
})();
