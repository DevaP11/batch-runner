const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const getUuidByString = require('uuid-by-string')
const configuration = yaml.load(fs.readFileSync(path.join(__dirname, '/../configuration.yaml'), 'utf8'))

process.env.AWS_REGION = configuration.AWS_REGION

const { logger } = require('../helper/server-logger')
const { checkpoint } = require('../helper/utils')
const { Aws: { lambdaInvoke, dbPut, dbGetByGSI, dbGet }, util: { JSONparse }, Security: { createOneWayHash } } = require('hydra/dist/lib')

const { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand } = require('@aws-sdk/client-cognito-identity-provider')
const client = new CognitoIdentityProviderClient({ region: configuration.AWS_REGION })

/**
* @name checkIfUserExists
*/
const checkIfUserExists = async (email) => {
  try {
    const userId = getUuidByString(email?.toLowerCase())
    const account = await dbGet(configuration.CONSUMER_DATA_TABLE, userId)
    await checkpoint(email, 'checkIfUserExists', 'Success')
    return { doesAccountExist: Boolean(account) }
  } catch (err) {
    await checkpoint(email, 'checkIfUserExists', 'Failed')
    throw err
  }
}
/**
 * @name doCognitoSignup
 * @param {object} userData Need to have email and password and phoneNumber
 */
const doCognitoSignup = async (userData) => {
  logger.debug('Inside doCognitoSignup', { userData })
  try {
    const signUpParams = {
      ClientId: configuration.COGNITO_CLIENT_ID,
      Username: userData.email,
      Password: userData.password,
      UserAttributes: [
        {
          Name: 'email',
          Value: userData.email
        },
        {
          Name: 'phone_number',
          Value: userData.phoneNumber
        },
        {
          Name: 'custom:isPasswordSet',
          Value: 'true' /** Marking Cognito Password as Set-> No Need to do set password flow */
        }
      ]
    }

    const command = new SignUpCommand(signUpParams)
    logger.debug('SignUpCommand', { att: signUpParams.UserAttributes })
    await client.send(command)
  } catch (err) {
    if (!['UsernameExistsException'].includes(err.name)) {
      await checkpoint(userData.email, 'doCognitoSignup', 'Failed')
      logger.error(err?.name || err?.message, err?.cause)
      throw err
    }
  }
  logger.debug('SignUp Successfully Complete')
  await checkpoint(userData.email, 'doCognitoSignup', 'Success')
}

/**
* @name cognitoConfirmUser
*/
const cognitoConfirmUser = async (email) => {
  try {
    const adminConfirmSignUp = new AdminConfirmSignUpCommand({
      Username: email,
      UserPoolId: configuration.COGNITO_POOL_ID
    })
    await client.send(adminConfirmSignUp)
  } catch (err) {
    const userAlreadyConfirmed = 'User cannot be confirmed. Current status is CONFIRMED'
    if (![userAlreadyConfirmed].includes(err?.message)) {
      await checkpoint(email, 'cognitoConfirmUser', 'Failed')
      throw err
    }
  }
  logger.debug('Confirm User Successfully Complete')
  await checkpoint(email, 'cognitoConfirmUser', 'Success')
}

/**
* @name createMarketingUser
*/
const createMarketingUser = async ({ email }) => {
  try {
    const createMarketingUserParams = {
      email,
      name: email,
      marketingAttributes: {
        countryCode: 'MY',
        isRegistered: true
      },
      userId: getUuidByString(email?.toLowerCase()),
      isPromotionsEnabled: false
    }

    logger.debug('Create Marketing User Params', createMarketingUserParams)

    const createMarketingUserLambdaResponse =
      {
        ...(await lambdaInvoke(configuration.CREATE_MARKETING_USER, {
          body: createMarketingUserParams
        }))
      }
        .Payload

    logger.debug('Marketing Api Response', createMarketingUserLambdaResponse)
    const marketingId = JSONparse(
      createMarketingUserLambdaResponse?.body
    )?.data?.marketingId

    if (!marketingId) {
      await checkpoint(email, 'createMarketingUser', 'Failed')
      throw new Error('MARKETING_ID_NOT_CREATED', { cause: { createMarketingUserLambdaResponse } })
    }

    logger.debug('Marketing User Created Successfully', marketingId)
    await checkpoint(email, 'createMarketingUser', 'Success')
    return { marketingId }
  } catch (err) {
    await checkpoint(email, 'createMarketingUser', 'Failed')
    throw err
  }
}

/**
* @name saveUserDetailsToDb
*/
const saveUserDetailsToDb = async ({ email, phoneNumber, marketingId }) => {
  try {
    const userDetails = {
      id: getUuidByString(email?.toLowerCase()),
      createdAt: Math.floor(Date.now() / 1000),
      email,
      phoneNumber: phoneNumber || '',
      accountSettings: {
        enablePushNotifications: true,
        acceptedTos: true
      },
      lastLoginAt: 0, /** Initialized at login */
      lastLoginDeviceId: '',
      language: 'en-US',
      contextIds: {
        marketingId
      },
      isEnabled: true,
      countryCode: 'MY',
      isPromotionsEnabled: false,
      emailHash: createOneWayHash(email) /** for analytics */
    }

    await dbPut(configuration.CONSUMER_DATA_TABLE, userDetails.id, userDetails)
    await checkpoint(email, 'saveUserDetailsToDb', 'Success')
  } catch (err) {
    await checkpoint(email, 'saveUserDetailsToDb', 'Failed')
    throw err
  }
}

/**
* @name isProfileIsAlreadyCreated
*/
const checkIfProfileWasAlreadyCreated = async (email) => {
  const userId = getUuidByString(email?.toLowerCase())
  const profiles = await dbGetByGSI(configuration.PROFILE_TABLE, 'userId-index', 'userId', userId)

  const isProfileAlreadyCreated = profiles?.length > 0
  if (isProfileAlreadyCreated) {
    logger.debug('User Already Has a Default Profile Created')
    await checkpoint(email, 'createRecommendationEngineUser', 'Success')
    await checkpoint(email, 'createDefaultProfile', 'Success')
  }

  return { isProfileAlreadyCreated }
}

/**
* @name createRecommendationEngineUser
*/
const createRecommendationEngineUser = async (email) => {
  const createRecommendationEngineUserParams = {
    properties: { /** Highest Rating From Each Country */
      max_parental_ratings_sg: 'R21',
      max_parental_ratings_my: '18',
      max_parental_ratings_ph: '18+',
      max_parental_ratings_id: '18+',
      max_parental_ratings_th: '18+'
    }
  }

  const createRecommendationEngineUserLambdaResponse =
    {
      ...(await lambdaInvoke(configuration.CREATE_RECOMMENDATION_ENGINE_USER, {
        body: createRecommendationEngineUserParams
      }))
    }
      .Payload

  const recommendationUserId = JSONparse(
    createRecommendationEngineUserLambdaResponse?.body
  )?.data?.recommendationUserId

  if (!recommendationUserId) {
    await checkpoint(email, 'createRecommendationEngineUser', 'Failed')
    throw new Error('RECOMMENDATION_ENGINE_CREATE_USER_FAILED', {
      cause: {
        createRecommendationEngineUserLambdaResponse
      }
    })
  }

  await checkpoint(email, 'createRecommendationEngineUser', 'Success')
  logger.debug('Recommendation Engine User', recommendationUserId)
  return { recommendationUserId }
}

/**
* @name createDefaultProfile
*/
const createDefaultProfile = async (email, recommendationUserId) => {
  try {
    const userId = getUuidByString(email?.toLowerCase())

    const profile = {
      id: uuidv4(),
      createdAt: Math.floor(Date.now() / 1000),
      isDefaultProfile: true,
      profileName: 'Demo Account Profile',
      userId,
      profileImage: 'https://dd5cnndofvsd.cloudfront.net/images/profiles/cinema-clipboard.png',
      maxRestrictions: 'M18',
      preferences: {
        language: 'en-US'
      },
      active: true,
      hasOptedForPin: false, /** These users do not have pin */
      recommendationUserId
    }

    logger.debug('Profile to be saved', profile)
    await dbPut(configuration.PROFILE_TABLE, profile.id, profile)
  } catch (err) {
    await checkpoint(email, 'createDefaultProfile', 'Success')
    throw err
  }

  logger.debug('Profile Creation Successful')
  await checkpoint(email, 'createDefaultProfile', 'Success')
}

/**
* @name provisionTmDemoEntitlement
*/
const provisionTmDemoEntitlement = async (email) => {
  try {
    const userId = getUuidByString(email?.toLowerCase())
    const now = parseInt(Date.now() / 1000)

    const entitlements =
      (await dbGetByGSI(configuration.ENTITLEMENT_TABLE, 'userId-index', 'userId', userId)) || []
    if (entitlements?.length > 0) {
      logger.info('Entitlement Already Exists')
      return
    }

    const newEntitlement = {
      id: uuidv4() /** Unique Identifier for entitlement */,
      createdAt: now /** The time at which the entitlement was created (seconds) */,
      updatedAt: now /** The time at which the entitlement was last updated (seconds). This value is changed on each update */,
      userId /** Unique Identifier for user/account */,
      periodStart: now - 100 /** The start of entitlement in seconds. Timestamp if passed in milliseconds is converted to seconds */,
      periodEnd: now /** The start of entitlement in seconds. Timestamp if passed in milliseconds is converted to seconds */,
      isActive: false /** If entitlement is active or not */,
      type: 'finite' /** The entitlement type can either be finite or infinite. For infinite entitlements there will be no periodEnd */,
      orderId: 'custom:tm-demo',
      productId: 'custom:tm-demo' /** For subscription status and purchased products */
    }

    await dbPut(configuration.ENTITLEMENT_TABLE, newEntitlement.id, newEntitlement)
    await checkpoint(email, 'provisionTmDemoEntitlement', 'Success')
    logger.debug('Entitlement Created')
  } catch (err) {
    await checkpoint(email, 'provisionTmDemoEntitlement', 'Failed')
    throw err
  }
}

module.exports = {
  doCognitoSignup,
  cognitoConfirmUser,
  createRecommendationEngineUser,
  createDefaultProfile,
  checkIfProfileWasAlreadyCreated,
  checkIfUserExists,
  saveUserDetailsToDb,
  createMarketingUser,
  provisionTmDemoEntitlement
}
