# 梗留所

中文互联网热梗档案馆，记录梗的含义、来历、传播过程、代表作品和可追溯来源。

当前网站：<https://gengliusuo-archive.yebai.chatgpt.site>（访问权限由原托管平台管理）。此仓库保存网站源码与 **142 条档案资料**；提交到 GitHub 不会自动更新当前网站。

## 功能

- 档案浏览：按梗名、别名和正文搜索，按分类和流行记录年份筛选，分页阅读。
- 时间排序：默认从新到旧，2026 年档案优先；可切换从旧到新，时间线也按年份倒序。
- 档案详情：解释含义、来历、传播、用法、注意事项，并保留原作、报道和传播证据的链接。
- 管理工作区：新增、编辑、草稿、发布、归档、修订历史及旧版恢复。
- 内容备份：导出全部 JSON；整份备份自动分批导入，显示进度并支持失败批次重试。只补回不存在的档案，并保存为草稿。
- 本站阅读计数：同一浏览器同日阅读同一档案计一次，与全网热度分开记录。

年份指有来源支持的流行记录时期，不保证是首次创作年份。传播指标保留平台、统计时期和口径，不合并为全网访问量。

## 技术与目录

采用 Vinext、React、TypeScript、Cloudflare Workers、D1 和 Drizzle。前台页面在服务端生成，档案与修订保存在数据库中。

| 路径 | 内容 |
| --- | --- |
| `app/` | 阅读页面、管理页面、API、认证辅助函数 |
| `components/archive/` | 档案卡片、搜索、编辑和备份界面 |
| `lib/archive-db.ts` | 查询、初始资料导入、修订、备份及阅读计数 |
| `data/seed.json` | 142 条初始档案及来源信息 |
| `db/`、`drizzle/` | 数据库结构与迁移 |
| `public/` | 档案馆插画与图标 |
| `build/`、`scripts/` | 需要保留的构建和开发工具源码 |
| `.openai/hosting.json` | D1/R2 绑定声明；不含原托管项目标识 |

## 本地开发

需要 Node.js **22.13 或更高版本**。以下命令从仓库根目录执行，适用于 PowerShell；macOS/Linux 可将 `Copy-Item` 换为 `cp`。

1. 从配置模板创建本地环境文件：

   ```powershell
   Copy-Item .env.example .env.local
   ```

   模板中的 `seedy@sites.test` 是开发工具固定的模拟账号。实际部署时应通过托管平台设置真实的管理员配置，不要提交环境文件。修改配置后重启开发服务器；已有 `.dev.vars` 时 Wrangler 会优先读取它，应避免同时混用两套本地配置。

2. 安装锁定依赖并生成本地 Worker 配置：

   ```powershell
   npm run install:ci
   npm run build
   ```

3. 在首次创建的本地数据库应用已有迁移：

   ```powershell
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_watery_argent.sql
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_past_juggernaut.sql
   ```

   已经应用的迁移不要重复执行。这个命令只作用于本地 D1。首次读取档案时，应用会自动将 `data/seed.json` 中尚不存在的记录导入，已有记录不会被覆盖。

4. 启动开发服务器：

   ```powershell
   npm run dev
   ```

   使用终端给出的地址，默认是 `http://127.0.0.1:5173`。如更换端口或主机名，同步调整 `SITE_URL`。

5. 打开 `/signin-with-chatgpt?return_to=/admin`，在本地模拟登录后进入管理工作区。生产认证由 Sites 托管平台负责。

`npm start` 可预览编译后的 Worker，但不提供开发模式的模拟登录。`.wrangler/state` 保存本地数据；删除它会清空本地数据库。

## 环境配置

| 配置 | 用途 |
| --- | --- |
| `ADMIN_EMAIL` | 可编辑档案的管理员邮箱；本地模拟登录使用 `seedy@sites.test` |
| `SITE_URL` | 当前访问源，用于写入操作的来源检查 |
| `ARCHIVE_IMPORT_SECRET` | 可选的一次性初始化入口密钥；默认留空，常规浏览及后台维护不需要它 |

一次性入口使用 `/api/admin/bootstrap`，只在配置了对应密钥时开放。应用的正常读取本身已经会导入初始资料，不需要为了本地启动启用此入口。

## 托管与维护

原站使用 Sites 提供的 Workers、D1 绑定、迁移和 ChatGPT 登录。这个项目需要服务端与数据库，不能直接作为静态 GitHub Pages 网站运行。

如迁移到独立 Cloudflare Workers 或其他平台，需要配置真实数据库、运行环境与可信的身份认证。`app/chatgpt-auth.ts` 读取的是原平台注入的身份头；独立部署不能直接信任访客提交的同名请求头。现有本地绑定的数据库 ID 是开发占位值。

更换域名时，除 `SITE_URL` 外，还应更新 `app/robots.ts`、`app/sitemap.ts` 和 `app/meme/[id]/page.tsx` 中的原站链接与 canonical 地址。

源码快照包含初始资料，不包含线上数据库的阅读计数或完整修订历史。要保留后台产生的数据，可在原站管理员的备份页面导出 JSON。当前导入流程不会覆盖同 ID 的现有档案，导入内容统一为草稿。

新档案优先引用原始作品、平台官方记录和可靠报道。未知的首发信息或传播数字保留待考说明，不补造数据。第三方视频和文章保留原链接，不将其完整内容当作本站自有作品发布。

## 第三方许可

保留 `build/sites-vite-plugin.LICENSE` 与 `vendor/shadcn-tailwind-4.13.0.LICENSE.md`。依赖的许可分别由其发布者提供；网络素材、名称与外部作品的权利属于各自权利人。

## 交互维护

搜索与状态筛选保留正在输入的关键词。详情页提供复制、系统分享、手动复制退路，以及预填档案信息的 GitHub 更正入口。提交更正需要 GitHub 账号，内容公开展示，由管理员核对后修订。

编辑器保存期间锁定输入，离开未保存的内容会提示；载入历史保留当前发布状态，状态切换由独立按钮完成。发生修订冲突时，可下载当前编辑留底、查看最新或确认后载入服务器版本。字段错误提供对应页签和输入项的定位入口，阅读预览包含完整来源与证据。

管理员登录后回到原页面。备份与补回页面同时提供导出；整份文件预校验后，按每批最多100条、低于4.5MB自动拆分，失败后可以继续未完成批次。

## 探索与个人档案夹

- `/collections`：六个策展专题，组织声音、游戏、职场情绪、自我安慰、弹幕回应和名场面；按分类/年份筛选，只显示当前公开档案。
- `/library`：收藏、收藏未读、手动已读和最近足迹。游客记录保存在当前浏览器；登录后使用独立的账号状态。游客合并需要确认，可导出个人JSON、导入到游客桶、移除引用和清除足迹。
- `/random`：随机选取已发布档案，详情页可排除当前档案继续发现。
- `/updates` 与 `/feed.xml`：本站最近修订与RSS公开摘要，不包含草稿、旧历史或个人数据。

账号状态保存到新增的`reader_records`表，接口只使用当前可信登录身份派生的所有者键，不接收用户身份参数、不返回邮箱或原始用户ID。个人数据不缓存；游客记录与云端数据分开，不会将云端集合复制到游客存储。最多保留500份个人状态，游客合并采用分批和幂等更新。浏览器限制存储时会提示暂存，并保留游客导出入口；支持Web Locks的浏览器协调多标签写入。

首次空的本地数据库需按顺序应用两份SQL迁移。升级时只应用尚未执行的迁移，勿重放旧表创建语句。托管平台上线前应用新迁移。源码包含结构与初始文化档案，不包含任何用户的账号收藏、阅读足迹或线上数据库副本。
