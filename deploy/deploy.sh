#!/usr/bin/env bash
# 把第一桶金(试玩版)部署到 https://test.prismice.cn
#
# 用法(在仓库根目录):  bash deploy/deploy.sh
#
# 规矩(calmness 的要求,脚本自动检查):
#   1. 部署前必须是最新代码:工作区干净;有远程仓库时 git fetch → git pull --ff-only → 确认和远程一致
#   2. 先跑自动检查(npm run check)和构建,不通过不部署
#   3. 只上传改过的文件:先比较本机和服务器每个文件的 sha256,只传不一样的
#   4. 要上传的内容超过 10MB 就停下,列出文件和大小,等 calmness 同意后再处理(不提供"强制上传"开关)
#   5. 每一次连服务器失败都立刻停止,不会"假装成功"
#
# 服务器上的位置:/opt/prismice/first-gold
#   site/        网站文件(vite 构建结果 dist/,外加 version.txt = 提交号)
#   conf/        网站容器的 Caddy 配置(仓库 deploy/site/conf/)
#   compose.yml  容器 prismice-first-gold 的定义(只接入 prismice_app-network,不开公网端口)
# 公网 HTTPS 由主站网关 prismice-caddy-1 转发(配置在 eureka-saas 仓库 deploy/hk-server/Caddyfile 的 test.prismice.cn 一段)。

set -euo pipefail
export LC_ALL=C              # 排序规则固定,本机和服务器的文件清单才能逐行对比
export COPYFILE_DISABLE=1    # macOS 打包时不要夹带 ._ 隐藏文件

SSH_KEY="${PRISMICE_SSH_KEY:-$HOME/.ssh/hk_server_ai_ed25519}"
SSH_HOST="${PRISMICE_SSH_HOST:-root@154.219.113.151}"
SSH=(ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 -p 52222 "$SSH_HOST") # 只能用 52222 端口
REMOTE_DIR=/opt/prismice/first-gold
CONTAINER=prismice-first-gold
DOMAIN=test.prismice.cn
MAX_UPLOAD_BYTES=$((10 * 1024 * 1024))

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n❌ %s\n' "$*" >&2; exit 1; }
remote() { "${SSH[@]}" "$@" </dev/null || fail "连服务器失败(多半是 ssh 超时):等 20 秒原样重跑;不要改用 22 端口"; }

# ---------- 1. 确认是最新代码 ----------
say "1/6 检查代码是不是最新"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "有没提交的改动,先提交再部署"; }
BRANCH="$(git branch --show-current)"
[ -n "$BRANCH" ] || fail "当前不在任何分支上"
if git remote get-url origin >/dev/null 2>&1; then
  git fetch -q origin
  git pull -q --ff-only origin "$BRANCH" || fail "git pull 失败(可能有冲突),先处理再部署"
  [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")" ] || fail "本机和 origin/$BRANCH 不一致"
  echo "✅ 分支 $BRANCH,和远程一致"
else
  echo "⚠️ 这个仓库还没有远程仓库(只在本机),只确认了工作区干净"
fi
COMMIT="$(git rev-parse --short HEAD)"
echo "✅ 提交 $COMMIT"

# ---------- 2. 检查和构建 ----------
say "2/6 自动检查和构建"
[ -d node_modules ] || npm ci --no-fund --no-audit
npm run check >/dev/null || fail "自动检查(npm run check)没通过,先修好再部署"
npm run build >/dev/null || fail "构建失败"
[ -f dist/index.html ] || fail "构建结果里没有 index.html"
echo "✅ 检查通过,构建完成"

# 把要上传的东西整理到一个临时文件夹,结构和服务器上一模一样
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE" "$STAGE".*' EXIT
mkdir -p "$STAGE/site" "$STAGE/conf"
cp -R dist/. "$STAGE/site/"
cp -R deploy/site/conf/. "$STAGE/conf/"
cp deploy/site/compose.yml "$STAGE/compose.yml"
printf '%s\n' "$COMMIT" > "$STAGE/site/version.txt"

# ---------- 3. 对比本机和服务器,只挑出改过的文件 ----------
say "3/6 对比服务器上已有的文件"
remote true
(cd "$STAGE" && find site conf compose.yml -type f -print0 | xargs -0 shasum -a 256 | awk '{print $2"\t"$1}' | sort) > "$STAGE.local"
remote "mkdir -p $REMOTE_DIR && cd $REMOTE_DIR && { find site conf compose.yml -type f -exec sha256sum {} + 2>/dev/null || true; } | awk '{print \$2\"\t\"\$1}'" | sort > "$STAGE.remote"

# 要上传的:本机有、服务器没有或内容不同
join -t $'\t' -a 1 "$STAGE.local" "$STAGE.remote" | awk -F'\t' '$3=="" || $2!=$3 {print $1}' > "$STAGE.upload"
# 要删除的:服务器 site/ 里有、本机已经没有(只删网站文件,不碰其他)
join -t $'\t' -v 2 "$STAGE.local" "$STAGE.remote" | cut -f1 | grep '^site/' > "$STAGE.delete" || true

UPLOAD_COUNT=$(wc -l < "$STAGE.upload" | tr -d ' ')
DELETE_COUNT=$(wc -l < "$STAGE.delete" | tr -d ' ')
UPLOAD_BYTES=0
while IFS= read -r f; do
  UPLOAD_BYTES=$((UPLOAD_BYTES + $(stat -f %z "$STAGE/$f" 2>/dev/null || stat -c %s "$STAGE/$f")))
done < "$STAGE.upload"
echo "要上传 $UPLOAD_COUNT 个文件,共 $((UPLOAD_BYTES / 1024)) KB;要删除 $DELETE_COUNT 个旧文件"

if [ "$UPLOAD_BYTES" -gt "$MAX_UPLOAD_BYTES" ]; then
  echo "最大的 20 个文件:"
  while IFS= read -r f; do printf '%10s  %s\n' "$(stat -f %z "$STAGE/$f" 2>/dev/null || stat -c %s "$STAGE/$f")" "$f"; done < "$STAGE.upload" | sort -rn | head -20
  fail "要上传的内容超过 10MB。按规矩先停下:请把上面的清单和大小告诉 calmness,他同意后再处理"
fi

# ---------- 4. 上传 ----------
say "4/6 上传改过的文件"
if [ "$UPLOAD_COUNT" -gt 0 ]; then
  (cd "$STAGE" && tar --no-mac-metadata --no-xattrs -cf - -T "$STAGE.upload") | "${SSH[@]}" "cd $REMOTE_DIR && tar -xf - --no-same-owner" \
    || fail "上传失败(多半是 ssh 超时),服务器上的网站可能只更新了一部分:等 20 秒原样重跑"
fi
if [ "$DELETE_COUNT" -gt 0 ]; then
  "${SSH[@]}" "cd $REMOTE_DIR && xargs -d '\n' rm -f -- && find site -type d -empty -delete" < "$STAGE.delete" \
    || fail "删除旧文件失败,等 20 秒原样重跑"
fi

# 上传后逐个核对:服务器上的文件必须和本机完全一样
remote "cd $REMOTE_DIR && find site conf compose.yml -type f -exec sha256sum {} + | awk '{print \$2\"\t\"\$1}'" | sort > "$STAGE.after"
diff -q "$STAGE.local" "$STAGE.after" >/dev/null || { diff "$STAGE.local" "$STAGE.after" | head -20; fail "服务器上的文件和本机不一致"; }
echo "✅ 服务器上的 $(wc -l < "$STAGE.after" | tr -d ' ') 个文件和本机完全一致"

# ---------- 5. 启动 / 更新容器 ----------
say "5/6 启动网站容器"
RUNNING="$(remote "docker ps --format '{{.Names}}'")"
if grep -q -E '^(compose\.yml|conf/)' "$STAGE.upload" || ! grep -qx "$CONTAINER" <<<"$RUNNING"; then
  remote "cd $REMOTE_DIR && docker compose up -d --force-recreate" >/dev/null
  echo "已按新配置(重新)创建容器 $CONTAINER"
else
  echo "配置没变,只更新了网站文件,不用重启容器"
fi
for i in 1 2 3 4 5 6 7 8 9 10; do
  if remote "docker exec prismice-caddy-1 wget -q -O - http://$CONTAINER/version.txt 2>/dev/null || true" | grep -qx "$COMMIT"; then break; fi
  [ "$i" = 10 ] && fail "主站网关访问不到 $CONTAINER 容器,或者版本不对"
  sleep 2
done
echo "✅ 内网访问正常,线上版本 = $COMMIT"

# ---------- 6. 公网验收 ----------
say "6/6 公网验收 https://$DOMAIN"
if [ "$(remote "grep -q '^$DOMAIN' /opt/prismice/app/deploy/hk-server/Caddyfile && echo yes || echo no")" != yes ]; then
  echo "⚠️ 主站网关的 Caddyfile 里还没有 $DOMAIN,公网暂时打不开(要先改 eureka-saas 仓库的 deploy/hk-server/Caddyfile 并热加载)"
  exit 0
fi
JS="$(grep -o 'assets/index-[^"]*\.js' "$STAGE/site/index.html" | head -1)"
for path in / /version.txt "/$JS"; do
  code=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "https://$DOMAIN$path" || true)
  echo "$code  https://$DOMAIN$path"
  [ "$code" = 200 ] || fail "公网访问 $path 不正常"
done
[ "$(curl -s -m 20 "https://$DOMAIN/version.txt")" = "$COMMIT" ] || fail "公网看到的不是刚部署的版本(可能有缓存),稍后再查"
echo "🎉 部署完成:https://$DOMAIN (版本 $COMMIT)"
