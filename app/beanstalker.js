/**
 * Handles the create_branch event from Beanstalk.
 *
 * @param object payload
 *   The payload data that got sent from Beanstak.
 */
module.exports.create = function(payload, callback) {
  // Assume success.
  var result = {status: 200, message: 'OK'};

  // Create the client which will handle the communication with Beanstalk.
  var client = require('./client.js');

  // Get the branches for the repository.
  client.get('repositories/' + payload.repository.id + '/branches.json', function(error, response, body) {
    if (body.errors) {
      // Send the errors back to the client and exit.
      result.status = 500;
      result.message = body.errors[0];
      callback(result);
    }


  });
};

/**
 * Handles the delete_branch event from Beanstalk.
 *
 * @param object payload
 *   The payload data that got sent from Beanstak.
 */
module.exports.delete = function(payload, callback) {
  // Assume success.
  var result = {status: 200, message: 'OK'};
  callback(result);
};
