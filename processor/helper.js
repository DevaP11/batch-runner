const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const getUuidByString = require('uuid-by-string')
const configuration = yaml.load(fs.readFileSync(path.join(__dirname, '/../configuration.yaml'), 'utf8'))

process.env.AWS_REGION = configuration.AWS_REGION

const { logger } = require('../helper/server-logger')
const { checkpoint } = require('../helper/utils')
const { Aws: { lambdaInvoke, dbPut, dbGetByGSI }, util: { JSONparse } } = require('hydra/dist/lib')

const { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand } = require('@aws-sdk/client-cognito-identity-provider')
const client = new CognitoIdentityProviderClient({ region: configuration.AWS_REGION })

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
    const profiles = await dbGetByGSI(configuration.PROFILE_TABLE, 'userId-index', 'userId', userId)
    if (profiles?.length > 0) {
      logger.debug('User Already Has a Default Profile Created')
      await checkpoint(email, 'createDefaultProfile', 'Success')
      return
    }

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

module.exports = {
  doCognitoSignup,
  cognitoConfirmUser,
  createRecommendationEngineUser,
  createDefaultProfile
}
