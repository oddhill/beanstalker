// Load dependencies and initiate express.
var express = require('express');
var bodyParser = require('body-parser');
var beanstalker = require('./beanstalker.js');
var app = express();

// Use the body-parser middleware in order to read POST data.
app.use(bodyParser.json());

// Listen for POST data at the root path.
app.post('/', function(request, response) {
  // Get the trigger event and the payload data.
  var event = request.body.trigger;
  var payload = request.body.payload;

  // Exit silently if the branch isn't named "feature/xxx".
  if (!payload.name.match(/^feature\/.+/)) {
    return;
  }

  /**
   * Helper function which will send the response back to the client and exit.
   *
   * @param obj result
   *   An object containg a status code and a message.
   */
  var sendResponse = function(result) {
    return response.status(result.status).send(result.message);
  };

  // Handle the payload depending on the event.
  switch (event) {
    case 'create_branch':
      // Branch created.
      beanstalker.create(payload, sendResponse);
      break;

    case 'delete_branch':
      // Branch deleted.
      beanstalker.delete(payload, sendResponse);
      break;

    default:
      // Unknown event.
      sendResponse({
        status: 400,
        message: 'Unkown event: ' + event
      });
  }
});

// Start the server.
app.listen(3000);
