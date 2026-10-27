export interface Columna<R = any> { k: string; t: string; al?: 'r' | 'c'; w?: string; f?: (r: R) => string; clase?: (r: R) => string }
