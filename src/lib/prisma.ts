/**
 * Prisma Client 单例
 * 确保整个应用使用同一个数据库连接
 *
 * Prisma 7.x 配置说明:
 * - 使用 adapter 模式连接数据库
 * - 设置 DATABASE_URL 环境变量 (格式: mysql://user:pass@host:port/db)
 * - 启用查询日志: DEBUG=prisma:*
 */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

// 解析数据库 URL
function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port) || 3306,
    user: parsed.username,
    password: parsed.password,
    database: parsed.pathname.slice(1), // 移除开头的 /
  };
}

// 防止开发时热重载创建多个实例
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 创建 Prisma Client
function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const config = parseDatabaseUrl(databaseUrl);

  // 创建 MariaDB/MySQL adapter
  const adapter = new PrismaMariaDb({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: 10,
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
