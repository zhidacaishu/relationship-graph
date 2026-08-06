const entryPreset = document.body.dataset.theme;
const entryMaterial = document.body.dataset.material;
const response = await fetch("./index.html");
if (!response.ok) throw new Error(`Unable to load graph shell: ${response.status}`);

const source = new DOMParser().parseFromString(await response.text(), "text/html");
source.querySelectorAll("script").forEach((script) => script.remove());
source.querySelectorAll('link[rel="stylesheet"]').forEach((stylesheet) => {
  const href = new URL(stylesheet.getAttribute("href"), response.url).href;
  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
});
document.body.dataset.entryPreset = entryPreset;
if (entryMaterial) document.body.dataset.entryMaterial = entryMaterial;
document.body.insertAdjacentHTML("beforeend", source.body.innerHTML);

const themeNames = {
  "editorial-atlas": "Editorial Atlas",
  "luminous-map": "Luminous Map",
  "research-console": "Research Console",
  "obsidian-echo": "Obsidian Echo"
};
const materialNames = {
  "mineral-glaze": "Mineral Glaze",
  "enamel-double-line": "Enamel Double-Line",
  "ink-bloom": "Ink Bloom",
  "precision-metal": "Precision Metal"
};
const themeName = themeNames[document.body.dataset.theme];
const materialName = materialNames[document.body.dataset.material];
if (themeName) {
  const displayName = materialName ? `${themeName} · ${materialName}` : themeName;
  document.querySelector(".titlebar-vault small").textContent = displayName;
  document.querySelector(".eyebrow").textContent = displayName;
  const switcher = document.createElement("a");
  switcher.className = "design-switcher";
  switcher.href = materialName ? "./node-materials.html" : "./comparison.html";
  switcher.textContent = materialName ? "All materials" : "All designs";
  document.querySelector(".graph-workspace").append(switcher);
}

await import("./graph-data.js");
await import("./app.js");
