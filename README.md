# Atlas Graph Prototype

一个受 Obsidian Graph View 启发的浏览器端交互式知识图谱原型。仓库提供两个独立版本：用于展示关系强弱的**加权文献图谱**，以及将所有关系视为等价连接的**无权重 Vault 图谱**。

![Atlas Graph 界面预览](./atlas-graph-preview.png)

## 两个版本

| 子项目 | 默认数据 | 边的含义 | 开发命令 |
| --- | --- | --- | --- |
| `apps/weighted` | 300 个模拟文献节点、1,032 条相似度边 | 可独立控制相似度是否影响布局和边视觉 | `npm run dev` 或 `npm run dev:weighted` |
| `apps/unweighted-obsidian` | 167 篇模拟 Vault 笔记及其标签、附件和未解析引用 | 每条关系使用相同的基础弹簧公式、距离和线条样式 | `npm run dev:unweighted` |

两个版本都完全运行在浏览器中，不需要后端或数据库，也不会读取或修改真实 Obsidian Vault。

## 功能

两个版本共享以下交互能力：

- Global 与 Local 图谱，以及 1–5 层局部邻域展开；
- 节点悬停、选择、拖拽、固定、双击和右键菜单；
- 画布平移、指针中心缩放、自动适配和节点聚焦；
- 支持键盘导航和屏幕阅读器状态提示的快速搜索、组合过滤和可编辑分组着色；
- 标签、附件、未解析链接和孤立节点显示控制；
- 节点大小、边宽、箭头、标签阈值和力导参数实时调节；
- PixiJS 图形渲染与 Canvas 2D 回退；
- Web Worker 力导布局、四叉树空间索引、Barnes–Hut 斥力近似和碰撞投影；
- 跨源隔离环境下的 `SharedArrayBuffer` 快路径，以及普通环境下的 Transfer 模式。

### 加权版本

加权版本模拟文献相似度网络。每条边的 `similarity` 会保留为规范化权重，并可通过 **Graph semantics** 独立控制：

- Weighted / Unweighted 决定布局和视觉是否消费权重，但不会删除源数据中的权重；
- **Weights affect layout** 控制权重是否改变弹簧距离和强度；
- **Weights affect edge appearance** 控制权重是否映射到边宽和透明度；
- 切换语义时保留相机、筛选、Local/Global、选择、固定节点、坐标和时间线状态；
- 提供按创建年份播放的时间演化动画，语义设置会保存在浏览器 `localStorage` 中。

### 无权重配置工作区

无权重版本模拟 Obsidian Vault，并将视觉实验整合为一个可组合的 Graph Studio：

- 四个内建主题：Editorial Atlas、Luminous Map、Research Console 和 Obsidian Echo；
- 五种节点材质：None、Mineral Glaze、Enamel Double-Line、Ink Bloom 和 Precision Metal；
- 可配置节点颜色模式、固定色、大小模式与缩放；
- 可配置边颜色、聚焦色、粗细、透明度和方向箭头；
- 可配置标签密度、标签衰减、暗角与四个布局参数；
- 内建方案只读，可保存用户副本、重置、删除，并通过 JSON 导入/导出；
- A/B 槽支持保存当前方案和瞬时切换，纯视觉变化不会重建图或重新启动 Worker；
- 当前配置、用户方案和 A/B 槽会保存在浏览器 `localStorage` 中。

图数据仍保持严格无权重语义：所有关系使用固定弹簧公式，笔记半径由 degree 和节点类型决定；tag、attachment、unresolved 和 orphan 从 Vault 元数据推导并使用独立形状或系统色。

### 公平静态对比

启动 `npm run dev:unweighted` 后，可从 Studio 的 **Compare view** 或直接访问 `/comparison.html`：

- 选择 2–4 个主题、用户方案或 A/B 方案；
- 从 Studio 进入时复用当前可见节点、边、世界坐标、相机、参考视口和 DPR；
- 直接打开时只使用一个临时 Worker 求解一次布局，settled 后立即终止；
- 每张卡片只进行静态 Canvas 重绘，不创建独立 Worker，也不带 hover、selection、pin 或动画状态；
- 因此所有卡片的差异只来自配置，而不是随机布局或视口差异。

原有主题页、材质页和 `node-materials.html` 继续作为兼容入口，通过 `theme-entry.js` 映射到统一应用和配置模型。

## 技术栈

- 原生 HTML、CSS、JavaScript ES Modules
- PixiJS 8.16.0
- Vite 7.1.7
- Web Worker
- 自研四叉树、Barnes–Hut 力计算与碰撞处理

## 快速开始

### 环境要求

Vite 7 要求 Node.js `20.19+` 或 `22.12+`，同时需要 npm。

### 安装依赖

```bash
npm install
```

### 开发

```bash
# 默认：加权版本
npm run dev

# 显式启动加权版本
npm run dev:weighted

# 启动无权重 Vault 版本
npm run dev:unweighted
```

开发服务器仅监听 `127.0.0.1`。请打开终端中 Vite 输出的本地地址。

### 构建

```bash
# 默认构建加权版本
npm run build

# 显式构建两个版本
npm run build:weighted
npm run build:unweighted
```

默认的 `dev`、`build` 和 `preview` 命令使用 `weighted` Vite mode；无权重版本需使用带 `:unweighted` 后缀的命令。配置会拒绝未知 mode。

构建产物分别位于：

```text
apps/weighted/dist/
apps/unweighted-obsidian/dist/
```

构建配置会把当前应用的 `graph-data.js` 复制到对应 `dist/`。

### 预览

```bash
npm run preview:weighted
npm run preview:unweighted
```

## 使用说明

### 鼠标操作

| 操作 | 效果 |
| --- | --- |
| 单击节点 | 选中节点并打开详情卡 |
| 拖拽节点 | 调整节点位置；固定节点在释放后保持位置 |
| 拖拽空白区域 | 平移画布 |
| 滚轮 | 以指针位置为中心缩放 |
| 双击节点 | 以该节点打开 Local graph |
| 双击空白区域 | 自动适配当前图谱 |
| 右键节点 | 打开操作菜单，可模拟打开笔记、进入局部图、固定或复制 `[[Obsidian Link]]` |

### 键盘快捷键

| 快捷键 | 效果 |
| --- | --- |
| `Ctrl/Command + F` 或 `/` | 打开快速搜索 |
| `↑` / `↓`（搜索中） | 在搜索结果间移动 |
| `Enter`（搜索中） | 激活当前搜索结果并打开详情卡 |
| `Esc` | 关闭搜索、右键菜单或清除选择 |
| `+` / `-` | 放大 / 缩小 |
| `0` | 适配当前图谱 |
| 方向键 | 平移画布 |
| `Shift + 方向键` | 快速平移画布 |
| `Space` | 仅加权版本：播放或暂停创建时间动画 |

### 控制面板

两个版本均提供 **Filters**、**Groups**、**Display** 和布局力参数；无权重 Studio 另外提供：

1. **Study**：选择内建或用户方案，保存副本、删除、重置、导入/导出 JSON，并管理 A/B 槽和公平对比入口。
2. **Graph semantics**：显示当前数据能力；无权重数据不开放权重映射，加权版本可独立控制权重对布局和边视觉的影响。
3. **Theme**：组合四个背景主题和五种节点材质。
4. **Nodes / Edges**：配置颜色模式、固定色、节点大小、边粗细、透明度和箭头。
5. **Display / Layout**：配置标签密度、标签衰减、暗角，以及中心力、斥力、连边力和连边距离。

无权重版本中的 **Existing files only** 默认开启；关闭后才会显示由 `unresolved[]` 推导的未解析引用节点。

## 查询语法

多个条件采用 AND 关系；字段值包含空格时可使用双引号；在任意条件前添加 `-` 可排除匹配项。

### 无权重 Vault 版本

| 语法 | 示例 | 含义 |
| --- | --- | --- |
| 普通文本 | `atlas` | 匹配名称、别名、路径、文件夹、标签或类型 |
| `path:` | `path:"03 Projects"` | 按路径包含关系匹配 |
| `folder:` | `folder:"03 Projects"` | 按文件夹匹配 |
| `tag:` | `tag:review` | 按标签匹配 |
| `type:` | `type:note` | 按节点类型匹配 |
| `is:` | `is:orphan` | 匹配 orphan、attachment 或 unresolved |
| 排除 | `tag:project -tag:archive` | 保留项目标签并排除归档标签 |

可用类型包括 `note`、`tag`、`attachment`、`unresolved` 和 `orphan`。

### 加权文献版本

加权版本保留 `topic:`、`path:`、`type:`、`year:` 和 `-` 排除语法，例如：

```text
topic:"Knowledge Graph" year:2024 -type:attachment
```

## 图谱数据

两个页面都要求在 `app.js` 之前加载本目录的 `graph-data.js`。数据文件通过 `window.PRECOMPUTED_GRAPH_DATA` 注入，便于替换为其他预计算数据。

### 无权重 Vault schema

```js
window.PRECOMPUTED_GRAPH_DATA = {
  meta: {
    vaultName: "Atlas Vault",
    description: "Unweighted Vault graph"
  },
  nodes: [
    {
      id: "note:project-atlas-brief",
      name: "Project Atlas Brief",
      path: "03 Projects/Project Atlas Brief.md",
      folder: "03 Projects",
      tags: ["project", "atlas"],
      aliases: ["Atlas brief"],
      attachments: ["atlas-map.canvas"],
      unresolved: ["Atlas follow up"]
    }
  ],
  links: [
    {
      source: "note:project-atlas-brief",
      target: "note:project-atlas-architecture",
      type: "wiki"
    }
  ]
};
```

约束：

- `nodes` 必须是非空数组，`links` 必须是数组但可为空；
- `nodes[].id` 必须唯一，且不能与运行时合成节点 ID 冲突；
- `links[].source` 和 `links[].target` 必须引用已存在的基础笔记 ID；
- 边不包含 `weight` 或 `similarity`；
- `tags`、`aliases`、`attachments` 和 `unresolved` 均为可选字符串数组；
- 附件与未解析引用会在运行时转换为独立节点及关系；
- 基础 wiki links 中 degree 为 0 的笔记会被标记为 orphan；
- 数据结构无效或节点 ID 重复时，页面会显示明确的数据错误而不是启动不完整图谱。

### 加权文献 schema

```js
window.PRECOMPUTED_GRAPH_DATA = {
  topics: ["Knowledge Graph"],
  nodes: [
    {
      id: "paper-1",
      name: "Example Paper (2024)",
      group: 0,
      topic: "Knowledge Graph",
      val: 42,
      degree: 1
    }
  ],
  links: [
    {
      source: "paper-1",
      target: "paper-2",
      similarity: 0.9
    }
  ]
};
```

加权版本使用 `similarity` 表达边权，并使用 `topic`、`val`、`degree` 和名称中的年份组织分组、节点重要性与时间动画。

## 项目结构

```text
.
├─ apps/
│  ├─ weighted/
│  │  ├─ index.html
│  │  ├─ styles.css
│  │  ├─ app.js
│  │  ├─ graph-semantics.js
│  │  ├─ graph-renderer.js
│  │  ├─ graph-worker.js
│  │  ├─ graph-quadtree.js
│  │  └─ graph-data.js
│  └─ unweighted-obsidian/
│     ├─ index.html
│     ├─ graph-config.js
│     ├─ comparison.html
│     ├─ comparison.css
│     ├─ comparison.js
│     ├─ node-materials.html
│     ├─ editorial-atlas.html
│     ├─ luminous-map.html
│     ├─ research-console.html
│     ├─ obsidian-echo.html
│     ├─ material-*.html
│     ├─ theme-entry.js
│     ├─ styles.css
│     ├─ styles/
│     │  ├─ themes/
│     │  └─ node-materials.css
│     ├─ app.js
│     ├─ graph-renderer.js
│     ├─ graph-worker.js
│     ├─ graph-quadtree.js
│     └─ graph-data.js
├─ atlas-graph-preview.png
├─ package.json
├─ package-lock.json
├─ README.md
└─ vite.config.js
```

## 渲染与布局架构

1. `graph-data.js` 在页面加载时写入预计算数据。
2. `app.js` 归一化节点，推导可选实体，并根据模式、查询和开关构建当前可见图。
3. 无权重 `graph-config.js` 负责版本化配置、capability normalization、视觉 token、Preset、A/B 和浏览器持久化；旧主题页由 `theme-entry.js` 映射到同一配置入口。
4. 加权 `graph-semantics.js` 统一 Worker、PixiJS 与 Canvas 2D 对权重开关、权重分桶、边宽和透明度的解释。
5. `graph-worker.js` 在独立线程中计算中心力、斥力、连边弹簧和碰撞约束；纯视觉配置不会发送布局消息。
6. 支持跨源隔离时，主线程与 Worker 通过 `SharedArrayBuffer` 共享位置；否则通过可转移数组传递快照。
7. `graph-renderer.js` 使用 PixiJS 绘制节点、边、箭头和标签；初始化失败时由 `app.js` 使用 Canvas 2D 回退渲染。
8. `comparison.js` 从 Studio 接收一次性 `sessionStorage` 快照，或直接使用一个临时 Worker，随后以固定坐标和相机绘制静态比较卡片。

开发和预览服务器已设置：

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

部署静态产物时，如需继续使用 `SharedArrayBuffer`，托管平台也应提供这两个响应头；否则应用会自动使用 Transfer 模式。

## 当前边界

- 这是界面与图谱交互原型，不是 Obsidian 插件；
- 数据为确定性的模拟数据，不连接真实文件系统；
- “打开笔记”只提供界面反馈，复制链接受浏览器剪贴板权限限制；
- 无权重当前配置、用户方案和 A/B 槽，以及加权语义设置会持久化在当前浏览器；节点位置、固定节点、相机、筛选和选择状态不会跨刷新持久化；
- 公平对比的 live graph 快照只在当前标签页的 `sessionStorage` 中保存一次，进入 comparison 后立即删除；
- 当前没有自动化测试脚本、后端服务或数据库；
- 仓库未提供许可证文件，在明确授权前请勿默认代码可自由再分发。
