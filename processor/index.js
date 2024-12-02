const { logger } = require('../helper/server-logger')
// const { checkpoint } = require('./helper/utils')

const processor = async (record) => {
  logger.debug('Inside Processor', record)

  // const recordId = record?.email
  // To Checkpoint a Phase
  // await checkpoint(recordId, 'Checkpoint Name', 'Pending')
}

module.exports = {
  processor
}
