declare module 'picocolors' {
  interface Picocolors {
    red: (text: string) => string;
    green: (text: string) => string;
    yellow: (text: string) => string;
    blue: (text: string) => string;
    magenta: (text: string) => string;
    cyan: (text: string) => string;
    white: (text: string) => string;
    gray: (text: string) => string;
    dim: (text: string) => string;
    bold: (text: string) => string;
    underline: (text: string) => string;
    strikethrough: (text: string) => string;
    inverse: (text: string) => string;
    bgRed: (text: string) => string;
    bgGreen: (text: string) => string;
    bgYellow: (text: string) => string;
    bgBlue: (text: string) => string;
    bgMagenta: (text: string) => string;
    bgCyan: (text: string) => string;
    bgWhite: (text: string) => string;
    black: (text: string) => string;
    bgBlack: (text: string) => string;
  }

  const pc: Picocolors;
  export = pc;
}
