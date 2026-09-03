# 容器部署参考

使用仓库根目录的 `Dockerfile` 和 `compose.production.yml`。Compose 仅供人工审查；ServerOps 根据受 root 管理的策略生成生产配置，不直接以 root 执行仓库 Compose。

## 镜像与数据

CI 工作流 `serverops-image.yml` 只构建、发布 `linux/amd64` 私有 GHCR 镜像，push 与 workflow_dispatch 都使用完整 `sha-<40hex>` 标签。手动触发的 `commit` 可指定完整提交；标签与 OCI revision/source 取自实际 checkout，工作流不连接生产环境。保持 GHCR 包为 private，已有包也必须保持 private；不要为解决拉取权限而公开包。CI 使用仓库 `GITHUB_TOKEN` 的 `contents:read`、`packages:write`。生产拉取凭据 `ghcr.token` 由 ServerOps 保管，需有私有包读取权限，不进入 Git、构建参数或镜像。

复制 `compose.env.example` 到仓库外，填入已验证的 image digest、绝对 env 路径、UID/GID 和数据目录。运行时 env 从本目录示例复制到外部权限受限文件，填写凭据；不把 Compose 插值文件当作应用 env。绑定目录必须预先存在，且对配置的非 root UID/GID 可写；`create_host_path: false` 阻止自动创建空目录。数据备份、迁移、切换和回滚由 ServerOps 执行。

镜像内部固定 3000，使用 Next standalone 并带齐 `.next/static` 和 `public`；`MODEL_CENTER_DB_DIR=/app/data`。迁移旧数据库时必须注入其原有 `MASTER_KEY`，不得在构建阶段提供或在每次启动时生成。

## ServerOps 生产映射

- 服务域名为 `model.shanchen.space`，仓库分支为 `main`；在 Ops“代码与部署”中手动更新，GitHub 推送不自动上线。
- root 批准的数据目录 `/srv/serverops/data/model-center/data` 挂载到 `/app/data`，容器 UID/GID 为 `1000:1000`；环境文件为 root-only `/etc/serverops/apps/model-center.env`。
- 宿主机 Nginx 转发到 `127.0.0.1:3000`。管理页面使用 Ops 统一 Auth；精确 `/v1` 和 `/v1/` 下的网关请求豁免浏览器 SSO，继续由业务 Bearer Token 校验。
- 迁移和恢复需要保存整个 SQLite 数据目录（包括存在的 WAL/SHM）与原加密主密钥。除了健康状态，还需核对服务商、模型记录及密钥可解密性。
- 旧 `/opt/model-center/data` 和 `model-center.service` 保留为迁移恢复材料，不与容器同时运行；旧目录不是最新数据副本。上线后回退代码默认保留当前数据库，恢复旧数据必须先评估后续写入损失。

## 检查和启动

```sh
docker compose --env-file /absolute/path/compose.env -f compose.production.yml config
docker compose --env-file /absolute/path/compose.env -f compose.production.yml up -d
docker compose --env-file /absolute/path/compose.env -f compose.production.yml ps
```

宿主端口只监听 `127.0.0.1`，公网入口由外部反向代理和认证控制。日志采用 json-file 的 10m × 3 轮转，进程以非 root 用户运行并自动重启。正式迁移前必须通过真实 Linux 镜像构建、容器健康检查、静态资源验证以及数据备份/回滚演练；源码构建成功不等于这些检查已通过。
