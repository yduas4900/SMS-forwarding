// 修复浏览器环境下的定时器类型问题
declare global {
  interface Window {
    setTimeout: (callback: () => void, delay: number) => number;
    clearTimeout: (id: number) => void;
  }
}

export {};
