/**
 * RESTful 基类控制器
 * 类似 Yii2 的 yii\rest\ActiveController
 *
 * 提供标准的 CRUD 操作:
 * - actionIndex: GET /resources - 列表
 * - actionView: GET /resources/:id - 详情
 * - actionCreate: POST /resources - 创建
 * - actionUpdate: PUT /resources/:id - 更新
 * - actionDelete: DELETE /resources/:id - 删除
 */
import {
  type Request,
  type Response,
  type NextFunction,
  Router,
} from "express";
import { type ZodSchema } from "zod";
import { validate } from "../middlewares/validate.middleware.js";
import { logger } from "../lib/logger.js";

// Prisma 模型委托类型
type PrismaDelegate = {
  findMany: (args?: object) => Promise<unknown[]>;
  findUnique: (args: object) => Promise<unknown | null>;
  create: (args: object) => Promise<unknown>;
  update: (args: object) => Promise<unknown>;
  delete: (args: object) => Promise<unknown>;
  count: (args?: object) => Promise<number>;
};

// 分页参数
export interface PaginationParams {
  page: number;
  pageSize: number;
  orderBy?: string;
  order?: "asc" | "desc";
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * RESTful 基类控制器配置
 */
export interface BaseControllerConfig {
  /** Prisma 模型 */
  model: PrismaDelegate;
  /** 资源名称，用于错误消息 */
  resourceName: string;
  /** 创建验证 Schema */
  createSchema?: ZodSchema;
  /** 更新验证 Schema */
  updateSchema?: ZodSchema;
  /** 查询验证 Schema */
  querySchema?: ZodSchema;
  /** 默认每页条数 */
  defaultPageSize?: number;
  /** 最大每页条数 */
  maxPageSize?: number;
  /** 允许的排序字段 */
  allowedOrderFields?: string[];
  /** 默认排序字段 */
  defaultOrderField?: string;
  /** 默认排序方向 */
  defaultOrder?: "asc" | "desc";
  /** 查询时的 include (关联查询) */
  include?: object;
  /** 查询时的 select (字段选择) */
  select?: object;
}

/**
 * 创建 RESTful 路由
 * 类似 Yii2 的 UrlRule
 */
export function createRestRoutes(config: BaseControllerConfig): Router {
  const router = Router();
  const controller = new BaseController(config);

  // GET /resources - 列表
  if (config.querySchema) {
    router.get("/", validate(config.querySchema), controller.actionIndex);
  } else {
    router.get("/", controller.actionIndex);
  }

  // GET /resources/:id - 详情
  router.get("/:id", controller.actionView);

  // POST /resources - 创建
  if (config.createSchema) {
    router.post("/", validate(config.createSchema), controller.actionCreate);
  } else {
    router.post("/", controller.actionCreate);
  }

  // PUT /resources/:id - 更新
  if (config.updateSchema) {
    router.put("/:id", validate(config.updateSchema), controller.actionUpdate);
  } else {
    router.put("/:id", controller.actionUpdate);
  }

  // DELETE /resources/:id - 删除
  router.delete("/:id", controller.actionDelete);

  return router;
}

/**
 * RESTful 基类控制器
 */
export class BaseController {
  protected model: PrismaDelegate;
  protected resourceName: string;
  protected defaultPageSize: number;
  protected maxPageSize: number;
  protected allowedOrderFields: string[];
  protected defaultOrderField: string;
  protected defaultOrder: "asc" | "desc";
  protected include?: object;
  protected select?: object;

  constructor(config: BaseControllerConfig) {
    this.model = config.model;
    this.resourceName = config.resourceName;
    this.defaultPageSize = config.defaultPageSize ?? 20;
    this.maxPageSize = config.maxPageSize ?? 100;
    this.allowedOrderFields = config.allowedOrderFields ?? ["id", "createdAt"];
    this.defaultOrderField = config.defaultOrderField ?? "id";
    this.defaultOrder = config.defaultOrder ?? "desc";
    this.include = config.include;
    this.select = config.select;
  }

  /**
   * 解析分页参数
   * 类似 Yii2 的 Pagination
   */
  protected parsePagination(query: Record<string, unknown>): PaginationParams {
    let page = parseInt(query.page as string) || 1;
    let pageSize = parseInt(query.pageSize as string) || this.defaultPageSize;

    // 边界检查
    page = Math.max(1, page);
    pageSize = Math.min(Math.max(1, pageSize), this.maxPageSize);

    // 排序
    let orderBy = (query.orderBy as string) || this.defaultOrderField;
    if (!this.allowedOrderFields.includes(orderBy)) {
      orderBy = this.defaultOrderField;
    }

    let order = (query.order as string)?.toLowerCase();
    if (order !== "asc" && order !== "desc") {
      order = this.defaultOrder;
    }

    return { page, pageSize, orderBy, order: order as "asc" | "desc" };
  }

  /**
   * 构建查询条件
   * 可以在子类中重写以添加自定义过滤
   */
  protected buildWhere(_query: Record<string, unknown>): object {
    return {};
  }

  /**
   * GET /resources - 列表
   * 类似 Yii2 的 actionIndex
   */
  actionIndex = async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { page, pageSize, orderBy, order } = this.parsePagination(
      req.query as Record<string, unknown>,
    );
    const where = this.buildWhere(req.query as Record<string, unknown>);

    const [items, total] = await Promise.all([
      this.model.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [orderBy!]: order },
        ...(this.include && { include: this.include }),
        ...(this.select && { select: this.select }),
      }),
      this.model.count({ where }),
    ]);

    const response: PaginatedResponse<unknown> = {
      items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };

    res.json(response);
  };

  /**
   * GET /resources/:id - 详情
   * 类似 Yii2 的 actionView
   */
  actionView = async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID format" });
      return;
    }

    const item = await this.model.findUnique({
      where: { id },
      ...(this.include && { include: this.include }),
      ...(this.select && { select: this.select }),
    });

    if (!item) {
      res.status(404).json({ message: `${this.resourceName} not found` });
      return;
    }

    res.json(item);
  };

  /**
   * POST /resources - 创建
   * 类似 Yii2 的 actionCreate
   */
  actionCreate = async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const data = req.body;

    logger.info({ data }, `Creating ${this.resourceName}`);

    const item = await this.model.create({
      data,
      ...(this.include && { include: this.include }),
    });

    res.status(201).json(item);
  };

  /**
   * PUT /resources/:id - 更新
   * 类似 Yii2 的 actionUpdate
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

    // 检查是否存在
    const existing = await this.model.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: `${this.resourceName} not found` });
      return;
    }

    const data = req.body;
    logger.info({ id, data }, `Updating ${this.resourceName}`);

    const item = await this.model.update({
      where: { id },
      data,
      ...(this.include && { include: this.include }),
    });

    res.json(item);
  };

  /**
   * DELETE /resources/:id - 删除
   * 类似 Yii2 的 actionDelete
   */
  actionDelete = async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID format" });
      return;
    }

    // 检查是否存在
    const existing = await this.model.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: `${this.resourceName} not found` });
      return;
    }

    logger.info({ id }, `Deleting ${this.resourceName}`);

    await this.model.delete({ where: { id } });

    res.status(204).send();
  };
}

export default BaseController;
