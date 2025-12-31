import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Rodin AI Proxy API",
      version: "1.0.0",
      description: "API documentation for Rodin AI Proxy Service",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local server",
      },
    ],
  },
  apis: ["./src/controllers/*.ts", "./src/types.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
