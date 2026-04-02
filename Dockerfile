# 前端构建阶段:平台无关，只需构建一次
FROM --platform=$BUILDPLATFORM node:22-slim AS frontend

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ .
RUN npx next build

# 后端构建阶段:根据目标平台交叉编译
FROM --platform=$BUILDPLATFORM golang:alpine AS builder

ARG TARGETARCH
WORKDIR /app

# 安装 git (go mod 需要)
RUN apk add --no-cache git

COPY server/ ./server/
COPY --from=frontend /app/frontend/out ./server/dist

WORKDIR /app/server
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -ldflags="-s -w" -o sing-box-ui .

# 运行时阶段:只包含编译好的二进制文件
FROM alpine:latest

ARG TARGETARCH
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# 复制编译好的二进制文件
COPY --from=builder /app/server/sing-box-ui .

# 复制 CI 预拉取的 sing-box 镜像 tar（按架构区分）
COPY singbox-${TARGETARCH}.tar /root/singbox-image.tar

# 创建必要的目录
RUN mkdir -p /root/sing-box /root/wireguard

# 暴露端口
EXPOSE 8080

# 设置时区
ENV TZ=Asia/Shanghai

# 运行应用
CMD ["./sing-box-ui"]
