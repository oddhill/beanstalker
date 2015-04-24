/**
 * Handles the create_branch event from Beanstalk.
 *
 * @param object payload
 *   The payload data that got sent from Beanstak.
 */
module.exports.create = function(payload, callback) {
  // Assume success.
  var result = {status: 200, message: 'OK'};

  // Load fs-extra in order to copy files.
  var fs = require('fs-extra');

  // Create the client which will handle the communication with Beanstalk.
  var client = require('./client.js');

  // Get the environments for this repository.
  client.get(payload.repository.id + '/server_environments.json', function(error, response, body) {
    // Iterate through every environment in order to find the staging
    // environment.
    for (var key in body) {
      var environment = body[key].server_environment;
      if (environment.branch_name != 'staging') {
        continue;
      }

      // Get the servers for this environment.
      client.get(payload.repository.id + '/release_servers.json?environment_id=' + environment.id, function(error, response, body) {
        // Assume that there's only one server.
        var server = body[0].release_server;

        // Copy the existing folder to the new path.
        var newPath = server.remote_path + '-f-' + payload.name.replace(/^.+\//g, '');
        fs.copy(server.remote_path, newPath, function(error) {
          // Remove the settings file when the files has been copied, since
          // this will need to be configured for a new database.
          fs.remove(newPath + '/sites/default/settings.local.php');
        });

        // Create the new environment.
        var data = {server_environment: {
          name: 'Staging (' + payload.name + ')',
          automatic: true,
          branch_name: payload.name
        }};
        client.post(payload.repository.id + '/server_environments.json', data, function(error, response, body) {
          var newEnvironment = body.server_environment;

          // Create the new release server.
          var data = {release_server: {
            name: server.name,
            protocol: server.protocol,
            local_path: server.local_path,
            remote_path: server.remote_path + '-f-' + payload.name.replace(/^.+\//g, ''),
            port: server.port,
            remote_addr: server.remote_addr,
            login: 'root',
            authenticate_by_key: server.authenticate_by_key
          }};
          client.post(payload.repository.id + '/release_servers.json?environment_id=' + newEnvironment.id, data, function(error, response, body) {
            var newServer = body.release_server;

            // Find the latest commit.
            client.get('changesets/repository.json?repository_id=' + payload.repository.id, function(error, response, body) {
              var commit = body[0].revision_cache;

              // Create the new release.
              var data = {release: {
                comment: 'Triggered by Beanstalker.',
                revision: commit.hash_id
              }};
              client.post(payload.repository.id + '/releases.json?environment_id=' + newEnvironment.id, data, function(error, response, body) {
                // Release created, which means that the deployment has
                // started.
                result.message = 'Successfully created the ' + newEnvironment.name + ' environment.';
                callback(result);
              });
            });
          });
        });
      });
    
      // Stop searching for environments.
      break;
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

  // Load fs-extra in order to copy files.
  var fs = require('fs-extra');

  // Create the client which will handle the communication with Beanstalk.
  var client = require('./client.js');

  // Get the environments for this repository.
  client.get(payload.repository.id + '/server_environments.json', function(error, response, body) {
    // Iterate through every environment in order to find the environment for
    // the deleted branch.
    for (var key in body) {
      var environment = body[key].server_environment;
      if (environment.branch_name != payload.name) {
        continue;
      }

      // Get the servers for this environment.
      client.get(payload.repository.id + '/release_servers.json?environment_id=' + environment.id, function(error, response, body) {
        // Assume that there's only one server.
        var server = body[0].release_server;

        // Simple remove the entire remote path. We can't delete the actual
        // environment since Beanstalk's API doesn't allow this :(
        fs.remove(server.remote_path);

        // Return the result.
        result.message = 'Deleted the ' + server.remote_path + ' folder.';
        callback(result);
      });
    }
  });
};
