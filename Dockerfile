# CommWEB 生产镜像（静态托管，无 node 运行时）
# 前置：Mac 侧 npm run build 产出最新 dist/（不入 git，scp 传入）
# 注意：pin 1.27 而非 latest——最新 nginx 的 musl 用了 CentOS 7（3.10 内核）不支持的
# syscall，pwrite nginx.pid 被 seccomp 拦截（EPERM）导致容器崩溃
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html

EXPOSE 80
