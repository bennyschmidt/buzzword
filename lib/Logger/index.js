/**
 * Logger
 *
 * A simple logger with timestamps, colors, and health status.
 */

export default class Logger {
  static STATUS_TEXT = {
    ERROR: 'CRASHED',
    OK: 'WORKING',
    IDLE: 'IDLE'
  };

  constructor (namespace = '') {
    this.namespace = namespace;
  }

  getTimestamp () {
    const now = new Date();
    const pad = (num) => num.toString().padStart(2, '0');
    return `[${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${now.getMilliseconds().toString().padStart(3, '0')}]`;
  }

  error (message) {
    const timestamp = this.getTimestamp();

    console.log(
      `\x1b[90m${timestamp}\x1b[0m \x1b[90m[${this.namespace}]\x1b[0m \x1b[41m\x1b[37m[${Logger.STATUS_TEXT.ERROR}]\x1b[0m \x1b[31m${message}\x1b[0m`
    );
  }

  warn (message) {
    const timestamp = this.getTimestamp();

    console.log(
      `\x1b[90m${timestamp}\x1b[0m \x1b[90m[${this.namespace}]\x1b[0m \x1b[42m\x1b[37m[${Logger.STATUS_TEXT.OK}]\x1b[0m \x1b[33m${message}\x1b[0m`
    );
  }

  ok (message) {
    const timestamp = this.getTimestamp();

    console.log(
      `\x1b[90m${timestamp}\x1b[0m \x1b[90m[${this.namespace}]\x1b[0m \x1b[42m\x1b[37m[${Logger.STATUS_TEXT.OK}]\x1b[0m \x1b[32m${message}\x1b[0m`
    );
  }

  info (message) {
    const timestamp = this.getTimestamp();

    console.log(
      `\x1b[90m${timestamp}\x1b[0m \x1b[90m[${this.namespace}]\x1b[0m \x1b[42m\x1b[37m[${Logger.STATUS_TEXT.OK}]\x1b[0m \x1b[36m${message}\x1b[0m`
    );
  }

  log (message) {
    const timestamp = this.getTimestamp();

    console.log(
      `\x1b[90m${timestamp}\x1b[0m \x1b[90m[${this.namespace}]\x1b[0m \x1b[42m\x1b[37m[${Logger.STATUS_TEXT.OK}]\x1b[0m \x1b[37m${message}\x1b[0m`
    );
  }

  comment (message) {
    const timestamp = this.getTimestamp();

    console.log(
      `\x1b[90m${timestamp}\x1b[0m \x1b[90m[${this.namespace}]\x1b[0m \x1b[42m\x1b[37m[${Logger.STATUS_TEXT.OK}]\x1b[0m \x1b[90m${message}\x1b[0m`
    );
  }

  message (message) {
    const timestamp = this.getTimestamp();

    console.log(
      `\x1b[90m${timestamp}\x1b[0m \x1b[90m[${this.namespace}]\x1b[0m \x1b[42m\x1b[37m[${Logger.STATUS_TEXT.OK}]\x1b[0m \x1b[33m${message}\x1b[0m`
    );
  }

  success (message) {
    const timestamp = this.getTimestamp();

    console.log(
      `\x1b[90m${timestamp}\x1b[0m \x1b[90m[${this.namespace}]\x1b[0m \x1b[42m\x1b[37m[${Logger.STATUS_TEXT.IDLE}]\x1b[0m \x1b[32m${message}\x1b[0m`
    );
  }
}
