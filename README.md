<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 **新一代大模型网关与AI资产管理系统**

<p align="center">
  <strong>简体中文</strong> |
  <a href="./docs/i18n/README.zh_TW.md">繁體中文</a> |
  <a href="./docs/i18n/README.en.md">English</a> |
  <a href="./docs/i18n/README.fr.md">Français</a> |
  <a href="./docs/i18n/README.ja.md">日本語</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/定制版-7749-c27a4d?style=flat-square" alt="7749 定制版" />
  <img src="https://img.shields.io/badge/基线-v1.0.0--rc.25-6B7280?style=flat-square" alt="基线上游版本" />
</p>

> **这是 7749 项目的定制版本**，基于上游 `v1.0.0-rc.25` 二次开发。
> 下面的功能介绍、截图与文档均来自上游项目，本仓库的改动统一登记在 [7749-MODIFICATIONS.md](./7749-MODIFICATIONS.md)。

<p align="center">
  <a href="https://raw.githubusercontent.com/JunWan666/7749-open-newapi/main/LICENSE">
    <img src="https://img.shields.io/github/license/JunWan666/7749-open-newapi?color=brightgreen" alt="license">
  </a><!--
  --><a href="https://github.com/JunWan666/7749-open-newapi/releases/latest">
    <img src="https://img.shields.io/github/v/release/JunWan666/7749-open-newapi?color=brightgreen&include_prereleases" alt="release">
  </a><!--
  --><a href="https://github.com/JunWan666/7749-open-newapi/pkgs/container/7749-open-newapi">
    <img src="https://img.shields.io/badge/image-ghcr.io-2496ED?logo=docker&logoColor=white" alt="docker">
  </a>
</p>

<p align="center">
  <a href="#-7749-定制版说明">7749 定制说明</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-文档">文档</a> •
  <a href="#-主要特性">主要特性</a> •
  <a href="#-模型支持">模型支持</a> •
  <a href="#-许可证">许可证</a>
</p>

</div>

## 🔧 7749 定制版说明

本仓库是 [New API](https://github.com/QuantumNous/new-api) 的衍生版本，用于 7749 站点的实际运行。**这里只写与官方版的差异**，官方功能与用法直接看下文。

| 项目 | 官方版 | 本仓库（7749 版） |
| --- | --- | --- |
| 镜像构建 | 上游 CI，多架构 | GitHub Actions 源码构建，`linux/amd64`，一次约 6 分钟 |
| 镜像地址 | `calciumion/new-api`（Docker Hub） | `ghcr.io/junwan666/7749-open-newapi`（GHCR，公开可直接拉） |
| 版本号 | `v1.0.0-rc.X` | `v1.0.0-rc.25-7749.N`（上游版本 + 定制序号） |
| 功能改动 | — | 用户四态状态机（待审核 / 可疑限制模型）、异常用户检测、排行榜多标签（用户排行 / 模型健康 / 关于本站）、微信群二维码管理（含有效期提醒）、签到门槛（近 7 天 ≥50 万 token）、签到同步活跃时间、邮箱一键脱敏、备注行内编辑、注册与登录 IP 记录、密钥分组行内切换（见 [修改记录](./7749-MODIFICATIONS.md)）|

拉取镜像：

```bash
docker pull ghcr.io/junwan666/7749-open-newapi:latest
```

更换镜像后重启容器即可，数据在 PostgreSQL 卷中，不受影响；同一上游版本之间可随时回退。

> 之后新增的功能会同步登记到上表和 [7749-MODIFICATIONS.md](./7749-MODIFICATIONS.md)。
> 本项目通过公网提供服务，按 AGPL-3.0 要求，该镜像对应的完整源码即本仓库，任何人可获取。

---
## 📝 项目说明

> [!IMPORTANT]
> - 本项目仅面向合法授权的 AI API 网关、组织内部鉴权、多模型管理、用量统计、成本核算和私有化部署场景。
> - 使用者必须合法取得上游 API Key、账号、模型服务或接口权限，并遵守上游服务条款及适用法律法规。
> - 面向公众提供生成式人工智能服务时，使用者应遵守[《生成式人工智能服务管理暂行办法》](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm)等监管要求，自行完成所在司法辖区要求的备案、许可、内容安全、实名、日志留存、税务和上游授权等合规义务。

---

## 🚀 快速开始

### 用本仓库镜像（推荐）

```bash
docker pull ghcr.io/junwan666/7749-open-newapi:latest

docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  ghcr.io/junwan666/7749-open-newapi:latest
```

启动后访问 `http://localhost:3000` 完成初始化，数据保存在 `./data`。

### 用 Docker Compose（自带 PostgreSQL + Redis）

```bash
cp .env.example .env    # 按需修改
docker compose up -d
```

> 生产环境建议使用 PostgreSQL：挂载 `./pgdata` 数据卷，并把 `SQL_DSN` 指向 `postgres:5432`。

📖 环境变量完整说明、源码编译、面板部署等方式见[官方部署文档](https://docs.newapi.pro/zh/docs/installation)。

---

## 📚 文档

| 分类 | 链接 |
|------|------|
| 🚀 部署指南 | [安装文档](https://docs.newapi.pro/zh/docs/installation) |
| ⚙️ 环境配置 | [环境变量](https://docs.newapi.pro/zh/docs/installation/config-maintenance/environment-variables) |
| 📡 接口文档 | [API 文档](https://docs.newapi.pro/zh/docs/api) |
| ❓ 常见问题 | [FAQ](https://docs.newapi.pro/zh/docs/support/faq) |
| 💬 社区交流 | [交流渠道](https://docs.newapi.pro/zh/docs/support/community-interaction) |

---

## ✨ 主要特性

| 特性 | 说明 |
|------|------|
| 🎨 界面 | 现代化 UI，支持中文 / 英文 / 法语 / 日语 |
| 🔄 数据兼容 | 完全兼容原版 One API 数据库 |
| 📈 数据看板 | 可视化控制台与用量统计 |
| 🔒 权限管理 | 令牌分组、模型限制、用户管理 |
| 💰 用量计费 | 按次 / 按量 / 缓存命中计费，支持易支付、Stripe |
| 🔐 授权登录 | Discord、LinuxDO、Telegram、OIDC |
| 🔀 格式转换 | OpenAI ⇄ Claude ⇄ Gemini，含「思考转内容」 |
| ⚖️ 智能路由 | 渠道加权随机、失败自动重试、用户级模型限流 |

---

## 🤖 模型支持

| 模型类型 | 说明 |
|---------|------|
| OpenAI-Compatible | Chat Completions / Responses / Realtime |
| Claude | Messages 格式 |
| Google Gemini | Gemini 原生格式 |
| Rerank | Cohere、Jina |
| Midjourney-Proxy | [midjourney-proxy(Plus)](https://github.com/novicezk/midjourney-proxy) |
| Suno-API | [Suno API](https://github.com/Suno-API/Suno-API) |
| Dify | ChatFlow 模式 |
| 自定义上游 | 可配置任意合法授权的上游接口 |

接口细节见[接口文档](https://docs.newapi.pro/zh/docs/api)。

---

## 📜 许可证

本项目遵循 [AGPL-3.0](./LICENSE)。

本仓库基于 [New API](https://github.com/QuantumNous/new-api) 二次开发，上游的许可证、NOTICE 与第三方许可声明（[THIRD-PARTY-LICENSES.md](./THIRD-PARTY-LICENSES.md)）均完整保留。

---

## 💬 反馈与支持

- 本仓库的功能改动、镜像构建问题 → 提到本仓库 [Issues](https://github.com/JunWan666/7749-open-newapi/issues)
- 上游功能说明与使用方式 → [New API 官方文档](https://docs.newapi.pro/zh)
- 上游项目 → <https://github.com/QuantumNous/new-api>
