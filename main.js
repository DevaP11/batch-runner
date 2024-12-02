const Util = require('./helper/utils.js')
const { logger } = require('./helper/server-logger')
const { processor } = require('./processor.js')

/**
@name main
*/
const main = async () => {
  logger.info('Creating Checkpointer Table')
  await Util.createCheckpointer()

  logger.info('Creating RecordTracker Table')
  await Util.initializeBatchTracker()

  logger.info('Started Batching!')
  await Util.batchRecords()

  logger.info('Running Batch Execution')
  const listOfBatches = Util.batchList()

  logger.info('Starting Record Processor')
  await Util.processRecords(listOfBatches, processor)
}

main()
