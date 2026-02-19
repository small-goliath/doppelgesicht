/**
 * 간단한 색상 유틸리티
 * @description 터미널 색상 출력용 (picocolors 대체)
 */

// ANSI 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

function createColor(colorCode: string) {
  return (text: string): string => `${colorCode}${text}${colors.reset}`;
}

export const pc = {
  red: createColor(colors.red),
  green: createColor(colors.green),
  yellow: createColor(colors.yellow),
  blue: createColor(colors.blue),
  magenta: createColor(colors.magenta),
  cyan: createColor(colors.cyan),
  white: createColor(colors.white),
  gray: createColor(colors.gray),
  dim: createColor(colors.dim),
  bold: createColor(colors.bright),
  bgRed: createColor(colors.bgRed),
  bgGreen: createColor(colors.bgGreen),
  bgYellow: createColor(colors.bgYellow),
};

export default pc;
