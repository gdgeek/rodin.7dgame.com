import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Rodin AI Proxy API",
      version: "1.0.0",
      description: "API documentation for Rodin AI Proxy Service",
    },
    // Empty servers array - Swagger will use relative URLs automatically
    servers: [],
  },
  apis: ["./src/controllers/*.ts", "./dist/controllers/*.js", "./src/types.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
