const { readCsvFile, writeCsvFile } = require('./csv')
const { logger } = require('./server-logger')
const fs = require('fs')
const { promisify } = require('util')

const yaml = require('js-yaml')
const CONFIGURATION = yaml.load(fs.readFileSync('./configuration.yaml', 'utf8'))

const sqlite3 = require('sqlite3')
const db = new sqlite3.Database('./core.db')

// Promisify SQLite3 methods
const dbRun = promisify(db.run.bind(db))
const dbGet = promisify(db.get.bind(db))

/**
* @name chunkArray
*/
const chunkArray = (array, size) => {
  if (!array) {
    logger.error('Array not passed to chunkArray Function')
  }
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, size + i))
  }
  return chunks
}

/**
* @name batchRecords
* @description This util will read a csv file and split it into multiple csv files
*/
const batchRecords = async () => {
  const records = await readCsvFile('./input/input.csv')
  logger.debug('Records', records)

  const batches = chunkArray(records, CONFIGURATION.BATCH_SIZE)
  logger.debug('Batched Array', batches)

  const promises = []
  batches.forEach((chunk, i) => {
    promises.push(writeCsvFile('./batches/batch_' + i + '.csv', chunk))
  })
}

/**
* @name batchList
*/
const batchList = () => {
  const batches = fs.readdirSync('./batches')
  logger.verbose('Batches Identified', batches)

  return batches
}

/**
* @name readRecord
*/
const readBatch = async (batchId) => {
  return await readCsvFile('./batches/' + batchId)
}

/**
* @name createCheckpointer
*/
const createCheckpointer = async () => {
  try {
    await dbRun(`
    CREATE TABLE IF NOT EXISTS Checkpointer (
      recordId STRING PRIMARY KEY NOT NULL,
      checkpoint TEXT NOT NULL,
      status INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `)
  } catch (err) {
    logger.error('Checkpointer Creation Failed', err)
  }
  logger.info('Checkpointer Table Successfully Created')
}

/**
* @name initializeBatchTracker
*/
const initializeBatchTracker = async () => {
  try {
    await dbRun(`
    CREATE TABLE IF NOT EXISTS BatchTracker (
      batchId STRING PRIMARY KEY,
      status STRING NOT NULL,
      records TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  } catch (err) {
    logger.error('BatchTracker Creation Failed', err)
  }
}

const updateBatchTracker = async (batchId, recordsIndex, status) => {
  /** Save Status In Batch Tracker as Pending */
  await dbRun(`
    INSERT OR REPLACE INTO BatchTracker (batchId, records, status)
    VALUES (?, ?, ?)
  `, [batchId, recordsIndex, status])
}

/**
* @name checkpoint
*/
const checkpoint = async (recordId, checkpointName, status) => {
  await dbRun(`
    INSERT OR REPLACE INTO Checkpointer (recordId, checkpoint, status)
    VALUES (?, ?, ?)
  `, [recordId, checkpointName, status])
}

/**
* @name getDataFromBatch
*/
const getDataFromBatch = async (batchId) => {
  return await dbGet('SELECT * FROM BatchTracker WHERE batchId = ?', [batchId])
}

module.exports = {
  batchRecords,
  batchList,
  createCheckpointer,
  initializeBatchTracker,
  updateBatchTracker,
  checkpoint,
  getDataFromBatch,
  readBatch
}
