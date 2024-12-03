const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')
const configuration = yaml.load(fs.readFileSync(path.join(__dirname, '/../configuration.yaml'), 'utf8'))

const { logger } = require('../helper/server-logger')
const { checkpoint }= require('../helper/utils')

const processor = async (record) => {
  logger.debug('Inside Processor', record)

  const recordId = record?.[configuration.INDEX_NAME]
  logger.debug('Record Id', { recordId })
  await checkpoint(email, 'Phase Name', 'Success')
}

module.exports = {
  processor
}
