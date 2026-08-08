# Workout Route View

一个本地、只读的 Apple 健康户外运动轨迹查看器。项目使用 React、Vite 和 Leaflet 展示跑步、骑车、徒步及登山路线，并按运动时间联动心率、海拔和地图位置。

> 本仓库不提供示例数据。使用者需要自行从 Apple“健康”App 导出数据，在本机处理后加载。

## 项目截图

![Workout Route View 项目截图](docs/project-screenshot.png)

截图展示当前版本的心率、海拔与地图联动效果，使用项目作者的真实路线数据；路线 JSON 不会随仓库发布。

## 2026-07 更新

- 心率与海拔合并到同一张图，共享运动时间轴和联动游标
- 图表游标同步更新经过时间、距离、心率、海拔及 Leaflet 地图位置
- 心率、海拔当前值使用与曲线一致的颜色
- Apple 健康数据解析迁移到独立的 [Workout Route Importer](https://github.com/SamXP2004/workout-route-importer)，Web 查看器只负责加载和展示处理后的本地数据

## 功能

- 按运动类型、年份、日期或数据来源筛选轨迹
- 查看距离、时长、爬升和配速
- 高亮所选路线以及起点、终点
- 一键适应当前路线或查看全部路线
- 在一张图中同步查看心率与海拔曲线，并与地图位置按运动时间联动
- Apple 健康数据只在本机解析

## FEATURE：心率、海拔与路线联动

处理 Apple 健康导出数据后，项目可以：

- 从 Apple 健康 Workout 及独立心率记录中提取平均、最低、最高心率和心率曲线
- 从 GPX 海拔点生成最低/最高海拔、累计爬升、累计下降和海拔曲线
- 在同一张图中以运动经过时间 `elapsedSec` 为统一时间轴，对齐心率、海拔和路线位置
- 在图表中悬停、拖动或使用方向键时，同步高亮 Leaflet 地图上的对应位置
- 点击所选地图路线时，把图表定位到最近的轨迹时间
- 显示当前位置对应的经过时间、距离、心率和海拔
- 心率或海拔缺失时明确显示无数据，不使用 `0` 或推测值补齐
- 列表仅加载指标摘要，展开指标面板后再按路线加载曲线文件

这里的“联动/同步”只指同一次运动内的数据时间轴对齐，不代表实时运动同步或跨设备云同步。指标和精确轨迹仍只在本机处理，默认不上传到云端。更完整的数据契约与后续架构见[导入工具、运动指标与用户隔离规划](docs/IMPORT_AND_USER_ISOLATION_PLAN.md)。

## 环境要求

- Node.js 20 或更高版本
- Python 3.10 或更高版本
- iPhone“健康”App 导出的 Apple 健康数据

## 一、导出 Apple 健康数据

Apple 官方导出步骤：

1. 在 iPhone 上打开“健康”App。
2. 进入“摘要”，轻点右上角头像或姓名首字母。
3. 轻点“导出所有健康数据”。
4. 等待导出完成，然后选择“存储到文件”、隔空投送或其他本地传输方式。

官方说明：[在 iPhone 上的“健康”中共享你的数据](https://support.apple.com/zh-cn/guide/iphone/iph5ede58c3d/ios)

导出文件包含完整健康记录和精确位置，属于高度敏感数据。不要把 ZIP、XML、GPX 或处理后的 JSON 放进 Git、公开网盘或聊天附件。

将导出的 ZIP 解压后，目录通常类似：

```text
apple_health_export/
  export.xml
  workout-routes/
    route_*.gpx
```

中文系统也可能生成 `导出.xml`。运行脚本时，应传入直接包含 `export.xml` 或 `导出.xml` 的目录。

## 二、安装项目

```bash
git clone https://github.com/SamXP2004/workoutRouteView.git
cd workoutRouteView
npm ci
```

## 三、处理健康数据

Web 查看器不包含数据导入功能，只读取已经生成的 JSON。请另行安装独立的 [Workout Route Importer](https://github.com/SamXP2004/workout-route-importer)，然后把处理结果输出到查看器的 `public/data`：

```bash
workout-route-importer import \
  "/绝对路径/apple_health_export" \
  --output "/绝对路径/workoutRouteView/public/data"
```

CLI 会：

1. 流式读取大型 `export.xml` 或 `导出.xml`，不把完整 XML 加载进内存。
2. 查找包含 `WorkoutRoute/FileReference` 的户外运动。
3. 读取对应 GPX，提取经纬度、海拔和轨迹时间。
4. 读取 Workout 心率统计，并把独立心率记录按运动时间和来源匹配到路线。
5. 统一距离和能量单位，保留运动时间的原始时区。
6. 分别简化地图轨迹、心率曲线和海拔曲线。
7. 计算心率摘要、最低/最高海拔、累计爬升和累计下降。
8. 生成路线索引、按路线拆分的指标文件和 `import-report.json`。
9. 完整校验后原子替换 `public/data`；失败时保留上一次可用数据。

需要调整路线匹配容差时：

```bash
workout-route-importer import \
  "/绝对路径/apple_health_export" \
  --output "/绝对路径/workoutRouteView/public/data" \
  --tolerance 0.00006
```

可以在正式导入前运行 `workout-route-importer inspect`，导入后运行 `workout-route-importer validate public/data`。`routes.json`、`metrics/*.json` 和导入报告已被 Git 忽略。

## 四、加载并查看

```bash
npm run dev
```

打开终端显示的 `http://127.0.0.1:5173/`。页面不会自动上传健康数据。

地图瓦片默认来自 CARTO，底层地图数据来自 OpenStreetMap。浏览地图时，瓦片服务仍可通过请求的瓦片区域、IP 和时间推断大致查看区域，但不会收到完整 GPX 文件。可以复制 `.env.example` 为 `.env.local`，配置自己的 Leaflet 瓦片服务：

```dotenv
VITE_TILE_URL=https://your-tile-provider.example/{z}/{x}/{y}.png
VITE_TILE_ATTRIBUTION=&copy; Your tile provider
VITE_TILE_SUBDOMAINS=
VITE_TILE_MAX_ZOOM=20
```

使用第三方瓦片服务前，请自行确认其许可、归属标注、流量限制和隐私政策。CARTO 对商业及非商业用途有单独的 [Basemaps 条款](https://docs.carto.com/faqs/carto-basemaps)；如默认服务不适用于你的场景，请通过环境变量更换瓦片服务。不要把包含 API Key 的 `.env.local` 提交到 Git。

## 编译与调试

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动仅监听 `127.0.0.1` 的开发服务器 |
| `npm run test` | 运行查看器 JavaScript 测试 |
| `npm run typecheck` | 执行 TypeScript/JSX 静态检查 |
| `npm run check:i18n` | 校验双语词典键完整性（en 100% 覆盖 zh-Hans） |
| `npm run privacy-check` | 检查 Git 跟踪文件和构建产物是否含敏感轨迹 |
| `npm run check` | 依次运行 i18n 键检查、测试、静态检查、安全构建和隐私检查 |
| `npm run build` | 安全生产构建，默认不复制 `public/` 私人数据 |
| `npm run build:private` | 将本机路线复制进 `dist`，仅供本人离线使用 |
| `npm run preview` | 预览最近一次生产构建 |

如果需要预览带有自己路线的编译结果：

```bash
npm run build:private
npm run preview
```

`build:private` 生成的 `dist/data/` 含精确位置和健康指标。不要部署、上传、压缩分享或提交整个 `dist` 目录。

## 数据口径

- 分类来自 Apple Health 的 `workoutActivityType`。
- 距离、时长来自 Workout 记录；支持常见距离单位转换为 km。
- 心率优先使用 Workout 统计；缺少统计但有匹配采样时，由采样计算摘要并标记为 `derived`。
- 心率记录按 Workout 时间窗口匹配，并优先匹配相同数据来源；重叠时选择时间跨度更短的运动。
- 海拔、爬升和下降由 GPX 海拔点计算，不代表测绘级高程。
- GPX 坐标使用 Ramer-Douglas-Peucker 算法简化，默认容差约 6 米。
- 指标曲线最多保留 600 个均匀抽样点用于展示；摘要统计基于抽样前数据。
- 缺失或无法识别的数据保留为空，不填充为 0。

## 语言（i18n）

- **技术栈**：`i18next` + `react-i18next`（组件层 `useTranslation()`；纯逻辑层 `src/trend.js` / `src/comparison.js` 复用 i18next core 的 `t`，不引入 React）。
- **词典**：`src/i18n/locales/zh-Hans.js`（源语言）与 `en.js`（保底完整性，键集合必须与 zh-Hans 完全一致，`npm run check:i18n` 自动校验）。
- **语言策略**：**仅跟随浏览器语言**（`navigator.languages`），不做应用内切换、不写 localStorage；`zh*` → 简体中文，`en*` → 英文，无法识别时**默认回退 en**（与 iOS `sourceLanguage=en` 对齐）。`document.documentElement.lang` 由 JS 运行时设置，`index.html` 静态兜底为 `lang="en"`。
- **语义分离**：纯逻辑函数（如 `formatDeltaText` / `periodTitle` / `buildDeltas`）的可选 `t` 参数默认值为 zh-Hans（源语言），保证 `node --test` 中文断言稳定；UI 组件显式传 `useTranslation()` 的 `t`，与 UI 运行时语言一致。
- 后端（iOS `/api/summary` 等）返回的中文错误 message **永不直接展示**：`routeRepository.js` 抛错误码（`ROUTES_NOT_FOUND` / `METRICS_NOT_FOUND` / `TRACK_NOT_FOUND` / `SUMMARY_LOAD_FAILED`），UI 统一映射 `errors.*` 本地化文案；后端 message 仅 `console.warn` 供调试。

## 项目结构

```text
src/                         React + Leaflet 前端
src/i18n/                    i18n 实例与双语词典（core.js / index.js / locales/）
scripts/check_i18n_keys.mjs  i18n 键完整性检查
scripts/check_privacy.py        开源隐私检查
tests/                       JavaScript 测试
public/data/README.md        本地路线与指标数据目录说明
docs/                        项目截图与后续规划
```

Apple 健康解析、原子发布、JSON Schema 和 Python 测试位于独立的 [Workout Route Importer](https://github.com/SamXP2004/workout-route-importer) 项目。

## 后续规划

- [导入工具、运动指标与用户隔离规划](docs/IMPORT_AND_USER_ISOLATION_PLAN.md)

心率、海拔和地图联动已实现；导入向导、账号、云端 API、数据库和多用户隔离仍是后续方向。

## License

[MIT](LICENSE)
