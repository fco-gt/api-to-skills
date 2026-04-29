import chalk from 'chalk';

const PREFIX = '[api-to-skill]';

export const logger = {
  info(msg: string) {
    console.log(`${chalk.cyan(PREFIX)} ${msg}`);
  },

  success(msg: string) {
    console.log(`${chalk.green(PREFIX)} ${msg}`);
  },

  warn(msg: string) {
    console.log(`${chalk.yellow(PREFIX)} ⚠ ${msg}`);
  },

  error(msg: string) {
    console.error(`${chalk.red(PREFIX)} ✖ ${msg}`);
  },

  dim(msg: string) {
    console.log(`${chalk.gray(PREFIX)} ${msg}`);
  },
};
