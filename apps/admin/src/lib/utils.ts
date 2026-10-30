import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 className：clsx 处理条件值，tailwind-merge 消解同属性冲突 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
