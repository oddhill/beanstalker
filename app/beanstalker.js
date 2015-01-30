/**
 * Handles the create_branch event from Beanstalk.
 *
 * @param object payload
 *   The payload data that got sent from Beanstak.
 */
module.exports.create = function(payload) {
  // Assume success.
  var result = {status: 200, message: 'OK'};

  // Return the result.
  return result;
};

/**
 * Handles the delete_branch event from Beanstalk.
 *
 * @param object payload
 *   The payload data that got sent from Beanstak.
 */
module.exports.delete = function(payload) {
  // Assume success.
  var result = {status: 200, message: 'OK'};

  // Return the result.
  return result;
};
