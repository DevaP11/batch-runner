const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')
const configuration = yaml.load(fs.readFileSync(path.join(__dirname, '/../configuration.yaml'), 'utf8'))

const { logger } = require('../helper/server-logger')
const { checkpoint } = require('../helper/utils')

const { CognitoIdentityProviderClient, SignUpCommand } = require('@aws-sdk/client-cognito-identity-provider')
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
    await checkpoint(userData.email, 'Cognito Signup Failed', 'Failed')
    logger.error(err?.name || err?.message, err?.cause)
    throw err
  }
  logger.debug('SignUp Successfully Complete')
}

module.exports = {
  doCognitoSignup
}
