# 使用 Node.js 官方镜像  
FROM node:22-alpine  

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 设置工作目录  
WORKDIR /usr/src/app  

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./  

# 安装依赖（包括 devDependencies 用于构建）
RUN pnpm install --frozen-lockfile

# 复制 TypeScript 源码和配置
COPY tsconfig.json ./
COPY src ./src

# 构建 TypeScript
RUN pnpm run build

# 删除 devDependencies，只保留生产依赖
RUN pnpm prune --prod

# 暴露应用运行的端口  
EXPOSE 3000  

# 启动应用  
CMD ["node", "dist/index.js"]  