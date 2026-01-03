/**
 * User Schema - Zod 验证
 * 类似 Yii2 的 rules() 方法
 */
import { z } from "zod";

// 创建用户的验证 Schema
export const CreateUserSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Invalid email format"),
    name: z.string().optional(),
    password: z
      .string({ required_error: "Password is required" })
      .min(6, "Password must be at least 6 characters"),
  }),
});

// 更新用户的验证 Schema
export const UpdateUserSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format").optional(),
    name: z.string().optional(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .optional(),
    status: z.number().int().min(0).max(1).optional(),
  }),
});

// 查询用户列表的验证 Schema
export const UserQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    pageSize: z.string().regex(/^\d+$/).optional(),
    orderBy: z.enum(["id", "email", "name", "createdAt"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    // 过滤条件
    email: z.string().optional(),
    name: z.string().optional(),
    status: z
      .string()
      .regex(/^[01]$/)
      .optional(),
  }),
});

// 类型导出
export type CreateUserInput = z.infer<typeof CreateUserSchema>["body"];
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>["body"];
export type UserQueryInput = z.infer<typeof UserQuerySchema>["query"];
