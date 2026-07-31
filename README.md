# Atlas Graph Prototype

一个受 Obsidian Graph View 启发的交互式知识图谱前端原型。项目当前以**加权文献图谱**为主：使用预计算的模拟数据，在浏览器中展示全局/局部关系、分组过滤、时间演化和可调力导布局。

![Atlas Graph 界面预览](./atlas-graph-preview.png)

## 项目简介

Atlas Graph 用于探索较大规模知识网络在桌面端界面中的展示与交互方式。默认示例包含 300 个文献节点和 1,032 条加权边，主题覆盖表示学习、图神经网络、因果推断、知识图谱等方向。

项目完全运行在浏览器中：

- 无后端服务和数据库；
- 不读取或修改真实 Obsidian Vault；
- 图谱数据由 `apps/weighted/graph-data.js` 预先注入；
- “打开笔记”等操作目前仅模拟界面反馈；界面提供复制 Obsidian 链接的入口，实际写入剪贴板取决于浏览器权限和运行环境。

## 功能亮点

- **全局与局部图谱**：查看完整关系网络，或从任意节点展开指定深度的邻域。
- **加权力导布局**：边的相似度会影响弹簧强度和目标距离。
- **丰富的图谱交互**：支持节点选择、拖拽、固定、画布平移、缩放、聚焦和右键菜单。
- **搜索与组合过滤**：可按名称、主题、路径、节点类型和年份筛选。
- **自定义分组着色**：使用查询表达式创建或修改节点分组。
- **多种节点类型**：可切换显示标签、附件、未解析链接和孤立节点。
- **创建时间动画**：按节点年份依次展示知识网络的演化过程。
- **实时参数调节**：可调整节点大小、边宽、箭头、文字淡出阈值，以及中心力、斥力、连边力和连边距离。
- **面向较大图谱的渲染架构**：PixiJS 负责图形渲染，Web Worker 负责布局计算，并使用四叉树与 Barnes–Hut 近似优化斥力计算。
- **渐进式兼容**：当前优先使用 PixiJS 的 WebGL 渲染；初始化失败时回退到 Canvas 2D。支持跨源隔离时使用 `SharedArrayBuffer`，否则自动切换为消息传输模式。

## 技术栈

- 原生 HTML、CSS、JavaScript（ES Modules）
- [PixiJS](https://pixijs.com/) 8.16.0
- [Vite](https://vite.dev/) 7.1.7
- Web Worker
- 自研四叉树、Barnes–Hut 力计算与碰撞处理

## 快速开始

### 环境要求

Vite 7 要求以下 Node.js 版本之一：

- Node.js `20.19+`
- Node.js `22.12+`

同时需要 npm。

### 安装与运行

```bash
npm install
npm run dev
```

开发服务器启动后，请打开终端中 Vite 输出的本地地址。服务仅监听 `127.0.0.1`。

### 构建与预览

```bash
npm run build
npm run preview
```

加权图谱的构建产物位于：

```text
apps/weighted/dist/
```

## 可用子项目

| 子项目 | 状态 | 开发命令 | 说明 |
| --- | --- | --- | --- |
| `apps/weighted` | 可用，默认入口 | `npm run dev` 或 `npm run dev:weighted` | 加权 Obsidian 风格知识图谱 |
| `apps/unweighted-obsidian` | 预留 | `npm run dev:unweighted` | 当前只有占位页面，图谱功能尚未实现 |

对应构建和预览命令：

| 操作 | 加权图谱 | 无权重占位项目 |
| --- | --- | --- |
| 构建 | `npm run build:weighted` | `npm run build:unweighted` |
| 预览 | `npm run preview:weighted` | `npm run preview:unweighted` |

## 使用说明

### 鼠标操作

| 操作 | 效果 |
| --- | --- |
| 单击节点 | 选中节点并打开详情卡 |
| 拖拽节点 | 调整节点位置；固定节点会在释放后保持位置 |
| 拖拽空白区域 | 平移画布 |
| 滚轮 | 以指针位置为中心缩放 |
| 双击节点 | 以该节点打开局部图谱 |
| 双击空白区域 | 自动适配当前图谱 |
| 右键节点 | 打开操作菜单，可查看、进入局部图、固定或复制 `[[Obsidian Link]]` |

### 键盘快捷键

| 快捷键 | 效果 |
| --- | --- |
| `Ctrl/Command + F` 或 `/` | 打开快速搜索 |
| `Enter` | 聚焦第一个搜索结果 |
| `Esc` | 关闭搜索、右键菜单或清除选择 |
| `+` / `-` | 放大 / 缩小 |
| `0` | 适配当前图谱 |
| `Space` | 播放或暂停创建时间动画 |
| 方向键 | 平移画布 |
| `Shift + 方向键` | 快速平移画布 |

### 控制面板

控制面板分为四组：

1. **Filters**：搜索节点，切换标签、附件、未解析节点和孤立节点；局部模式下还可在 1–5 层之间调整邻域展开深度。
2. **Groups**：启用、停用或修改分组查询，也可添加自定义颜色组。
3. **Display**：控制箭头、文字显示、节点大小、边粗细和时间动画。
4. **Forces**：实时调节中心力、斥力、连边力和连边距离。

## 查询语法

过滤器和自定义分组支持以下字段：

| 语法 | 示例 | 含义 |
| --- | --- | --- |
| 普通文本 | `graph` | 匹配名称、主题、路径或类型中包含该文本的节点 |
| `topic:` | `topic:"Knowledge Graph"` | 按主题匹配 |
| `path:` | `path:Papers` | 按模拟文件路径匹配 |
| `type:` | `type:note` | 按节点类型匹配 |
| `year:` | `year:2024` | 按年份精确匹配 |
| `-` 前缀 | `-type:attachment` | 排除匹配项 |
| 多个条件 | `topic:"Knowledge Graph" year:2024` | 所有条件同时满足 |

可用节点类型包括：

- `note`
- `tag`
- `attachment`
- `unresolved`
- `orphan`

## 自定义图谱数据

默认数据位于 `apps/weighted/graph-data.js`，并必须通过名为 `window.PRECOMPUTED_GRAPH_DATA` 的全局变量在 `app.js` 加载前提供给应用：

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
    },
    {
      id: "paper-2",
      name: "Another Paper (2023)",
      group: 0,
      topic: "Knowledge Graph",
      val: 28,
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

字段说明：

| 字段 | 说明 |
| --- | --- |
| `topics` | 主题列表；节点的 `group` 应对应主题索引 |
| `nodes[].id` | 唯一节点 ID |
| `nodes[].name` | 显示名称；末尾的 `(YYYY)` 会被解析为创建年份，缺失时按 2020 处理 |
| `nodes[].group` | 主题索引 |
| `nodes[].topic` | 主题名称 |
| `nodes[].val` | 搜索结果排序和节点权重相关数值 |
| `nodes[].degree` | 节点度数，用于计算初始半径 |
| `links[].source` / `target` | 起点和终点 ID；也可使用 `sourceId` / `targetId` |
| `links[].similarity` | 边权，影响力导布局；缺失时使用默认值 |

修改数据后重新运行开发服务器或构建即可。构建加权项目时，Vite 配置会把 `graph-data.js` 复制到 `apps/weighted/dist/`。

> 标签、附件、未解析链接和孤立节点目前由 `app.js` 基于基础节点生成，用于演示过滤和视觉编码；它们并非来自真实 Vault。

## 项目结构

```text
.
├─ apps/
│  ├─ weighted/
│  │  ├─ index.html            # 主界面和控制面板结构
│  │  ├─ styles.css            # Obsidian 风格界面样式
│  │  ├─ app.js                # 状态、过滤、交互和布局通信
│  │  ├─ graph-renderer.js     # PixiJS 图谱渲染器
│  │  ├─ graph-worker.js       # Worker 力导布局与碰撞计算
│  │  ├─ graph-quadtree.js     # 四叉树及空间查询
│  │  ├─ graph-data.js         # 预计算模拟图谱数据
│  │  └─ dist/                 # 构建后生成（Git 忽略）
│  └─ unweighted-obsidian/
│     └─ index.html            # 无权重版本占位页
├─ atlas-graph-preview.png      # README 界面预览
├─ README.md                    # 项目说明
├─ .gitignore                   # 本地生成物与临时文件规则
├─ package.json                 # 脚本和依赖
├─ package-lock.json
└─ vite.config.js               # 多入口、构建和跨源隔离配置
```

## 渲染与布局架构

1. `graph-data.js` 在页面加载时写入预计算数据。
2. `app.js` 构建可见节点和边，并根据模式、过滤条件与开关生成当前图谱。
3. `graph-worker.js` 在独立线程中计算中心力、斥力、连边力和碰撞约束。
4. 支持跨源隔离时，主线程和 Worker 通过 `SharedArrayBuffer` 共享位置数据；否则通过可转移数组传递快照。
5. `graph-renderer.js` 使用 PixiJS 绘制节点、边、箭头和标签；初始化失败时由 `app.js` 使用 Canvas 2D 渲染。

开发和预览服务器已设置以下响应头，以启用共享内存快路径：

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

部署静态构建产物时，如需继续使用 `SharedArrayBuffer` 模式，也应在托管平台配置这两个响应头；未配置时应用仍会回退到 Transfer 模式。

## 当前边界

- 这是界面与图谱交互原型，不是 Obsidian 插件。
- 数据为预计算的模拟文献网络，不连接真实文件系统。
- 无权重图谱尚未实现。
- 当前没有自动化测试脚本、后端服务或持久化配置。
- 仓库当前未提供许可证文件；在明确授权前，请勿默认将代码视为可自由再分发。
