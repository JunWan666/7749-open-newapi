# 7749 衍生版本说明

本仓库是 [New API](https://github.com/QuantumNous/new-api)（原 `Calcium-Ion/new-api`）的衍生版本，
用于 7749 站点的二次开发。

- 上游项目：<https://github.com/QuantumNous/new-api>
- 上游许可证：**AGPL-3.0** —— 原 `LICENSE`、`NOTICE`、`THIRD-PARTY-LICENSES.md` 一律保留原样
- 本项目**不是**上游官方发行版，遇到的问题请提到本仓库，不要打扰上游维护者
- 上游项目名称与组织署名受其项目政策保护，本项目不做删改

## 当前基线

| 项 | 值 |
|---|---|
| 上游版本 | `v1.0.0-rc.25` |
| 上游提交 | `f1164142` |
| 自建镜像 | `ghcr.io/junwan666/7749-open-newapi` |

## 修改记录

完整记录以 `git log` 为准，提交格式为 `编号:类型:说明`（见 `GIT_COMMIT_RULES.md`）。

| 编号 | 内容 |
|---|---|
| 001 | 构建：新增自建镜像 CI（仅 `linux/amd64`、GHA 分层缓存、推 ghcr.io），移除上游多余的 docker/release/electron workflow |
| 002 | 文档：新增本说明与提交规范 |
| 003 | 文档：README 增加「7749 定制版说明」与差异表，仓库简介改为中文 |
| 004 | 文档：徽章改为指向本仓库（license/release/镜像），移除上游推广徽章，英文 README 补差异表 |
| 005 | 整理：README 默认简体中文，多语言 README 收进 `docs/i18n/`，移除 `electron/` 桌面端源码 |
| 006 | 清理：移除公益站地址与站名，仓库 homepage 置空 |
| 007 | 文档：精简 README（518 → 165 行），移除合作伙伴/鸣谢/Star History/相关项目与重复的部署章节 |

业务功能代码目前**尚未改动**，与上游 `v1.0.0-rc.25` 行为一致。

## 与上游的目录差异

- `README.md` 改为**简体中文**（仓库首页默认中文），英文与繁体/法/日版本收进 `docs/i18n/`
- `electron/` 已移除：本仓库只做服务端部署，不需要上游的桌面客户端源码
- `deploy` 相关（`Dockerfile.dev`、`docker-compose.dev.yml`、`new-api.service`）保持上游原位，避免破坏上游的开发流程
- 其余目录（`bin/` `common/` `constant/` `controller/` `dto/` `i18n/` `logger/` `middleware/` `model/` `oauth/` `pkg/` `plugins/` `relay/` `relaykit/` `router/` `service/` `setting/` `tokenkit/` `types/` `web/`）都是 **Go 包目录**，导入路径由 `go.mod` 决定，**不能移动或改名**，否则全项目 import 失效

## 构建

推送 `v*` tag 或手动 Run 即可，GitHub Actions 自动构建并推送：

```bash
git tag v1.0.0-rc.25-7749.2 -m "说明"
git push origin v1.0.0-rc.25-7749.2
```

产物：`ghcr.io/junwan666/7749-open-newapi:<tag>` 与 `:latest`。首次约 6 分钟，后续带缓存约 5 分钟。

## 部署

服务器上 `/opt/newapi/docker-compose.yml` 的 `image` 指向上述镜像，然后：

```bash
docker compose pull newapi && docker compose up -d newapi
```

数据保存在 `./pgdata` 卷中，换镜像不影响数据；同一上游版本间切换无需迁移。

## AGPL-3.0 说明

本版本通过公网向所有用户提供服务，其对应的完整源代码即本仓库（含全部修改），
任何人可自由获取。若在本仓库基础上继续部署，同样需要遵守 AGPL-3.0。
