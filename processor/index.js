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
  const phoneNumber = '+4400000000'

  await Helper.doCognitoSignup({ email, password: 'Password@1', phoneNumber })
  await Helper.cognitoConfirmUser(email)

  /** Check If User Exists in db */
  const { doesAccountExist } = await Helper.checkIfUserExists(email)

  if (!doesAccountExist) {
    const { marketingId } = await Helper.createMarketingUser({ email })
    await Helper.saveUserDetailsToDb({ email, phoneNumber, marketingId }) /** If Not, Create User in ConsumerTable */
  }

  const { isProfileAlreadyCreated } = await Helper.checkIfProfileWasAlreadyCreated(email)

  if (!isProfileAlreadyCreated) {
    const { recommendationUserId } = await Helper.createRecommendationEngineUser(email)
    await Helper.createDefaultProfile(email, recommendationUserId)
  }

  await Helper.provisionTmDemoEntitlement(email)
}

module.exports = {
  processor
}
