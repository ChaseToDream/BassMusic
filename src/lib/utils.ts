import { clsx, type ClassValue } from 'clsx'

/**
 * 合并条件类名（基于 clsx）。
 * 用于组件 className 的动态拼接。
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
