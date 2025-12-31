import NodeCache from "node-cache";

// Cache for 10 seconds by default
export const cache = new NodeCache({ stdTTL: 10 });
