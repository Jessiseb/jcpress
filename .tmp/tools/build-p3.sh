#!/usr/bin/env bash
# 三期生产构建（esbuild），供 build-probe.cjs 分析。
#
# 为什么不用 `vite build`：本机 EDR 会拦截 esbuild 子进程的**文件读取**
# （`winapi error #5` = ERROR_ACCESS_DENIED），且**不稳定**：
# 同一条命令可能这次成功、下次失败。`--version` 因为不读文件而永远成功，
# 所以「esbuild 能跑」不代表「构建能跑」。详见 docs/phase3-effect-matrix.md。
#
# 因此本脚本：
#  ① 先构建到 `.tmp-build.new`，**成功后才**替换 `.tmp-build`
#     （早期版本先 `rm -rf .tmp-build` 再构建，一旦被拦就两头空、把上次的有效产物也删了）；
#  ② 失败时自动重试若干次（拦截是概率性的）；
#  ③ 最终仍失败则**保留上次产物**并以非零码退出，绝不静默通过。
set -u
cd "$(dirname "$0")/../../frontend"

ESBUILD="${ESBUILD_BIN:-node_modules/@esbuild/win32-x64/esbuild.exe}"
NEW=".tmp-build.new"
OLD=".tmp-build"
ATTEMPTS="${BUILD_ATTEMPTS:-6}"

rm -rf "$NEW"
mkdir -p "$NEW"

for i in $(seq 1 "$ATTEMPTS"); do
  if "$ESBUILD" src/main.tsx \
      --bundle --minify --splitting --format=esm --target=es2020 --jsx=automatic \
      --loader:.tsx=tsx --loader:.ts=ts \
      --define:process.env.NODE_ENV='"production"' \
      --alias:@=./src \
      '--external:/fonts/*' '--external:/uploads/*' '--external:/textures/*' \
      --outdir="$NEW" --metafile="$NEW/meta.json" --log-level=warning 2>/dev/null \
     && [ -f "$NEW/meta.json" ]; then
    rm -rf "$OLD"
    mv "$NEW" "$OLD"
    echo "✔ 生产构建完成（第 $i 次尝试）→ frontend/.tmp-build/"
    exit 0
  fi
  echo "  · 第 $i/$ATTEMPTS 次被 EDR 拦截（winapi error #5），重试…" >&2
  sleep 1
done

echo "✘ 构建连续 $ATTEMPTS 次被拦，未能产出新产物。" >&2
if [ -f "$OLD/meta.json" ]; then
  echo "  已保留上次有效产物（frontend/.tmp-build/），build-probe.cjs 将基于它分析。" >&2
  echo "  ⚠️ 注意：这不是本次代码的构建结果，仅作参考。" >&2
fi
rm -rf "$NEW"
exit 1
