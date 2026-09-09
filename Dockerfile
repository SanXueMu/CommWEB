# CommWEB 生产镜像（静态托管，无 node 运行时）
# 前置：Mac 侧 npm run build 产出最新 dist/（不入 git，scp 传入）
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html

EXPOSE 80
