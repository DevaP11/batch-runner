const fs = require('fs')
const util = require('util')
const Path = require('path')

const yaml = require('js-yaml')
const CONFIGURATION = yaml.load(fs.readFileSync('./configuration.yaml', 'utf8'))

const executionStartTime = CONFIGURATION.NODE_ENV !== 'prod' ? '' : new Date().toISOString()

const fileLog = fs.createWriteStream(Path.join(__dirname, `../logs/server_${executionStartTime}.log`), { flags: 'w' })
const ErrorLog = fs.createWriteStream(Path.join(__dirname, `../logs/error_${executionStartTime}.log`), { flags: 'w' })

const divider = '_'.repeat(50)

/* eslint-disable */
const colors = {
  info: '\x1b[36m', // Cyan
  error: '\x1b[31m', // Red
  warn: '\x1b[33m', // Yellow
  debug: '\x1b[34m', // Blue
  verbose: '\e[0;35m', // Magenta
  reset: '\x1b[0m'
}
/* eslint-enable */

const logger = {}
// the flag 'a' will update the stream log at every launch

logger.debug = (key1 = '', key2 = '') => {
  const timeStamp = new Date().toLocaleString()
  const preFix = divider + '\n' + timeStamp + '\n'

  fileLog.write(preFix + util.format(key1, key2) + '\n')
  console.log(preFix + util.format(key1, key2) + '\n')
}

logger.info = (key1 = '', key2 = '') => {
  const timeStamp = new Date().toLocaleString()
  const preFix = divider + '\n' + timeStamp + '\n'

  fileLog.write(preFix + util.format(key1, key2) + '\n')
  console.log(colors.info, preFix + util.format(key1, key2) + '\n')
  console.log(colors.reset, '\n')
}

logger.verbose = (key1 = '', key2 = '') => {
  const timeStamp = new Date().toLocaleString()
  const preFix = divider + '\n' + timeStamp + '\n'

  fileLog.write(preFix + util.format(key1, key2) + '\n')
  console.log(colors.verbose, preFix + util.format(key1, key2) + '\n')
  console.log(colors.reset, '\n')
}

logger.warn = (key1 = '', key2 = '') => {
  const timeStamp = new Date().toLocaleString()
  const preFix = divider + '\n' + timeStamp + '\n'

  fileLog.write(preFix + util.format(key1, key2) + '\n')
  console.log(colors.warn, preFix + util.format(key1, key2) + '\n')
  console.log(colors.reset, '\n')
}

logger.error = (e1, e2) => {
  ErrorLog.write(util.format(e1, e2) + '\n')
}

module.exports = { logger }
