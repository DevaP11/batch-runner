const Util = require('./helper/utils.js')
const yaml = require('js-yaml')
const fs = require('fs')
const CONFIGURATION = yaml.load(fs.readFileSync('./configuration.yaml', 'utf8'))
const { logger } = require('./helper/server-logger')
const { processor } = require('./processor')

/**
@name main
*/
const main = async () => {
  logger.verbose('Creating Checkpointer Table')
  await Util.createCheckpointer()

  logger.verbose('Creating RecordTracker Table')
  await Util.initializeBatchTracker()

  logger.verbose('Started Batching!')
  await Util.batchRecords()

  logger.verbose('Running Batch Execution')
  const listOfBatches = Util.batchList()

  logger.verbose('Starting Record Processor')

  for (const batchId of listOfBatches) {
    const rtData = Util.getDataFromBatch(batchId)
    const status = rtData?.status
    logger.debug('Current Batch Status - ' + batchId, (status || 'Unprocessed'))

    if (status === 'Success') {
      logger.debug('Batch Already Processed', batchId)
      continue
    }

    const batchData = await Util.readBatch(batchId)

    const recordsIndex = JSON.stringify(batchData?.map(item => item[CONFIGURATION.INDEX_NAME]))

    await Util.updateBatchTracker(batchId, recordsIndex, 'Pending')

    try {
      const promises = batchData?.map(record => processor(record))
      await Promise.all(promises) /** Run Promises in Parallel */
    } catch (err) {
      logger.error('Failed to process', err)
      /** Save Status In Batch Tracker as Failed */
      await Util.updateBatchTracker(batchId, recordsIndex, 'Failed')
      continue
    }
    /** Save Status In Batch Tracker as Success */
    await Util.updateBatchTracker(batchId, recordsIndex, 'Success')
  }
}

main()
