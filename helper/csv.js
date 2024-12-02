const csv = require('csv-parser')
const { json2csv } = require('json-2-csv')
const { logger } = require('./server-logger')
const fs = require('fs')

/**
* @name readCsvFile
* @description Reads a CSV file and returns data as an object
*/
const readCsvFile = (fileName) => {
  const data = []
  return new Promise((resolve) => {
    fs.createReadStream(fileName)
      .pipe(csv())
      .on('data', function (row) {
        data.push(row)
      })
      .on('end', function () {
        logger.debug('Data loaded')
        resolve(data)
      })
  })
}

/**
* @name writeCsvFile
* @description Writes a CSV File
* @param fileName Name of the file to write data on
*/
const writeCsvFile = async (fileName, data) => {
  const csv = await json2csv(data)
  fs.writeFileSync(fileName, csv)
}

module.exports = {
  readCsvFile,
  writeCsvFile
}
