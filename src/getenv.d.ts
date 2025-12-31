declare module "getenv" {
  interface GetEnv {
    (name: string, fallback?: string): string;
    string(name: string, fallback?: string): string;
    int(name: string, fallback?: number): number;
    float(name: string, fallback?: number): number;
    bool(name: string, fallback?: boolean): boolean;
    boolish(name: string, fallback?: boolean): boolean;
    array(name: string, type?: string, fallback?: string[]): string[];
    multi<T extends Record<string, unknown>>(spec: T): T;
    url(name: string, fallback?: string): URL;
    disableFallbacks(): void;
    enableFallbacks(): void;
    disableErrors(): void;
    enableErrors(): void;
  }

  const getenv: GetEnv;
  export default getenv;
}
