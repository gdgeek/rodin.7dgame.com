/**
 * User Controller
 * 类似 Yii2 的 UserController extends ActiveController
 *
 * 提供用户的 RESTful CRUD 操作:
 * - GET    /api/users         - 获取用户列表
 * - GET    /api/users/:id     - 获取单个用户
 * - POST   /api/users         - 创建用户
 * - PUT    /api/users/:id     - 更新用户
 * - DELETE /api/users/:id     - 删除用户
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: User ID
 *           example: 1
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *           example: user@example.com
 *         name:
 *           type: string
 *           description: User display name
 *           example: John Doe
 *         status:
 *           type: integer
 *           enum: [0, 1]
 *           description: User status (0=inactive, 1=active)
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     CreateUserInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *           example: newuser@example.com
 *         name:
 *           type: string
 *           description: User display name
 *           example: Jane Doe
 *         password:
 *           type: string
 *           minLength: 6
 *           description: User password (min 6 characters)
 *           example: password123
 *     UpdateUserInput:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *         name:
 *           type: string
 *           description: User display name
 *         password:
 *           type: string
 *           minLength: 6
 *           description: New password (min 6 characters)
 *         status:
 *           type: integer
 *           enum: [0, 1]
 *           description: User status
 *     PaginatedUsers:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
 *         pagination:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               description: Total number of items
 *             page:
 *               type: integer
 *               description: Current page number
 *             pageSize:
 *               type: integer
 *               description: Items per page
 *             totalPages:
 *               type: integer
 *               description: Total number of pages
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Error message
 *         details:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *               message:
 *                 type: string
 */

import {
  type Request,
  type Response,
  type NextFunction,
  Router,
} from "express";
import prisma from "../lib/prisma.js";
import {
  BaseController,
  type BaseControllerConfig,
} from "./base.controller.js";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserQuerySchema,
} from "../schemas/user.schema.js";
import { validate } from "../middlewares/validate.middleware.js";

/**
 * 扩展基类控制器，添加自定义逻辑
 * 类似 Yii2 中重写 ActiveController 的 actions
 */
class UserController extends BaseController {
  /**
   * 重写 buildWhere 添加自定义过滤逻辑
   * 类似 Yii2 的 prepareDataProvider
   */
  protected buildWhere(query: Record<string, unknown>): object {
    const where: Record<string, unknown> = {};

    // 邮箱模糊搜索
    if (query.email) {
      where.email = { contains: query.email as string };
    }

    // 名称模糊搜索
    if (query.name) {
      where.name = { contains: query.name as string };
    }

    // 状态精确匹配
    if (query.status !== undefined) {
      where.status = parseInt(query.status as string);
    }

    return where;
  }

  /**
   * 重写创建操作，添加密码加密等自定义逻辑
   * 类似 Yii2 的 beforeSave
   */
  actionCreate = async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const data = req.body;

    // TODO: 在实际项目中，这里应该加密密码
    // data.password = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        // 不返回密码
      },
    });

    res.status(201).json(user);
  };

  /**
   * 重写更新操作
   */
  actionUpdate = async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID format" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const data = req.body;

    // TODO: 如果更新密码，需要加密
    // if (data.password) {
    //   data.password = await bcrypt.hash(data.password, 10);
    // }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(user);
  };
}

// 控制器配置
const userControllerConfig: BaseControllerConfig = {
  model: prisma.user as unknown as BaseControllerConfig["model"],
  resourceName: "User",
  createSchema: CreateUserSchema,
  updateSchema: UpdateUserSchema,
  querySchema: UserQuerySchema,
  defaultPageSize: 20,
  maxPageSize: 100,
  allowedOrderFields: ["id", "email", "name", "createdAt"],
  defaultOrderField: "id",
  defaultOrder: "desc",
  // 不在列表中显示密码
  select: {
    id: true,
    email: true,
    name: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  },
};

// 创建控制器实例
const userController = new UserController(userControllerConfig);

// 创建路由
const userRouter: Router = Router();

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: 获取用户列表
 *     description: 获取分页的用户列表，支持过滤和排序
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 每页条数
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [id, email, name, createdAt]
 *           default: id
 *         description: 排序字段
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: 排序方向
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: 按邮箱模糊搜索
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: 按名称模糊搜索
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *           enum: [0, 1]
 *         description: 按状态过滤
 *     responses:
 *       200:
 *         description: 成功返回用户列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedUsers'
 *       400:
 *         description: 参数验证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userRouter.get("/", validate(UserQuerySchema), userController.actionIndex);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     summary: 获取单个用户
 *     description: 根据 ID 获取用户详情
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 用户 ID
 *     responses:
 *       200:
 *         description: 成功返回用户详情
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: ID 格式无效
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userRouter.get("/:id", userController.actionView);

/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: 创建用户
 *     description: 创建新用户
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserInput'
 *     responses:
 *       201:
 *         description: 用户创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: 参数验证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userRouter.post("/", validate(CreateUserSchema), userController.actionCreate);

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     summary: 更新用户
 *     description: 根据 ID 更新用户信息
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 用户 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserInput'
 *     responses:
 *       200:
 *         description: 用户更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: 参数验证失败或 ID 格式无效
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userRouter.put("/:id", validate(UpdateUserSchema), userController.actionUpdate);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: 删除用户
 *     description: 根据 ID 删除用户
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 用户 ID
 *     responses:
 *       204:
 *         description: 用户删除成功
 *       400:
 *         description: ID 格式无效
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userRouter.delete("/:id", userController.actionDelete);

export { userRouter, userController };
export default userRouter;
