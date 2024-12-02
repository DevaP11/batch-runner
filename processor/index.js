const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')
const configuration = yaml.load(fs.readFileSync(path.join(__dirname, '/../configuration.yaml'), 'utf8'))

const { logger } = require('../helper/server-logger')
const Helper = require('./helper')

const processor = async (record) => {
  logger.debug('Inside Processor', record)

  const recordId = record?.[configuration.INDEX_NAME]
  logger.debug('Record Id', { recordId })

  const email = record?.email

  await Helper.doCognitoSignup({ email, password: 'Password@1', phoneNumber: '+4400000000' })
  await Helper.cognitoConfirmUser(email)
  const { recommendationUserId } = await Helper.createRecommendationEngineUser(email)
  await Helper.createDefaultProfile(email, recommendationUserId)
}

module.exports = {
  processor
}
