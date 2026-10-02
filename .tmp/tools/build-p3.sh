#!/usr/bin/env bash
# 三期生产构建（esbuild），供 build-probe.cjs 分析。
# 为什么不用 `vite build`：本机对「Node 派生的子进程读文件」一律返回 winapi error #5，
# 但 esbuild 二进制在 shell 里直接执行正常。详见 docs/phase3-effect-matrix.md。
set -e
cd "$(dirname "$0")/../../frontend"
ESBUILD="${ESBUILD_BIN:-node_modules/@esbuild/win32-x64/esbuild.exe}"
rm -rf .tmp-build && mkdir -p .tmp-build
"$ESBUILD" src/main.tsx \
  --bundle --minify --splitting --format=esm --target=es2020 --jsx=automatic \
  --loader:.tsx=tsx --loader:.ts=ts \
  --define:process.env.NODE_ENV='"production"' \
  --alias:@=./src \
  '--external:/fonts/*' '--external:/uploads/*' '--external:/textures/*' \
  --outdir=.tmp-build --metafile=.tmp-build/meta.json --log-level=warning
echo "✔ 生产构建完成 → frontend/.tmp-build/"
