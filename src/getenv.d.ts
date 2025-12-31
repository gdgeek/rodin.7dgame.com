declare module "getenv" {
  export function string(name: string, fallback?: string): string;
  export function int(name: string, fallback?: number): number;
  export function float(name: string, fallback?: number): number;
  export function bool(name: string, fallback?: boolean): boolean;
  export function boolish(name: string, fallback?: boolean): boolean;
  export function array(
    name: string,
    type?: string,
    fallback?: string[]
  ): string[];
  export function multi<T extends Record<string, unknown>>(spec: T): T;
  export function url(name: string, fallback?: string): URL;
  export function disableFallbacks(): void;
  export function enableFallbacks(): void;
}
