// Load the dependencies.
var fs = require('fs-extra');
var exec = require('child_process').exec;
var mysql = require('mysql');
var client = require('./client.js');
var db = require('./db.js');

/**
 * Copies a database and the entire content.
 *
 * @param string baseDatabase
 *   The name of the database that should get cloned.
 * @param string newDatabase
 *   The name of the new database.
 * @param string dumpPath
 *   The path to the folder where we should store the SQL dump.
 */
var copyDatabase = function(baseDatabase, newDatabase, dumpPath) {
  // Set the full path to the dump file.
  var dumpFile = dumpPath + '/' + baseDatabase + '.sql';

  // Connect to the database.
  var connection = mysql.createConnection({
    host: db.host,
    user: db.user,
    password: db.password
  });

  // Start by creating a SQL dump.
  exec('mysqldump ' + baseDatabase + ' -h ' + db.host + ' -u ' + db.user + ' -p' + db.password + ' > ' + dumpFile, function(error, stdout, stderr) {
    if (error) return;
    // Create the new database.
    connection.query('CREATE DATABASE `' + newDatabase + '`', function(error, rows) {
      if (error) return;
      // Import the SQL dump to the new database.
      exec('mysql ' + newDatabase + ' -h ' + db.host + ' -u ' + db.user + ' -p' + db.password + ' < ' + dumpFile, function(error, stdout, stderr) {
        // Remove the SQL dump when everything is done.
        fs.remove(dumpFile);
      });

    });
  });
}

/**
 * Drop a database.
 *
 * @param string database
 *   The name of the database that should be deleted.
 */
var dropDatabase = function(database) {
  // Connect to the database.
  var connection = mysql.createConnection({
    host: db.host,
    user: db.user,
    password: db.password
  });

  // Drop the database.
  connection.query('DROP DATABASE `' + database + '`');
}

/**
 * Handles the create_branch event from Beanstalk.
 *
 * @param object payload
 *   The payload data that got sent from Beanstak.
 */
module.exports.create = function(payload, callback) {
  // Assume success.
  var result = {status: 200, message: 'OK'};

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
        var newName = '-f-' + payload.name.replace(/^.+\//g, '');
        var newPath = server.remote_path + newName;

        fs.copy(server.remote_path, newPath, function(error) {
          // Remove the settings file when the files has been copied, since
          // this will need to be configured for a new database.
          fs.remove(newPath + '/sites/default/settings.local.php');

          // Determine the name of the database based on the folder for the site.
          var baseDatabase = server.remote_path.replace(/^.+\//g, '');
          var newDatabase = baseDatabase + newName;

          // Copy the database.
          copyDatabase(baseDatabase, newDatabase, newPath);
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
            remote_path: newPath,
            port: server.port,
            remote_addr: server.remote_addr,
            login: 'root',
            authenticate_by_key: server.authenticate_by_key,
            revision: environment.current_version
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

        // Drop the database.
        var database = server.remote_path.replace(/^.+\//g, '');
        dropDatabase(database);

        // Return the result.
        result.message = 'Deleted the ' + server.remote_path + ' folder and the ' + database + ' database.';
        callback(result);
      });
    }
  });
};
