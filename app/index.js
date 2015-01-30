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

  // Handle the payload depending on the event.
  switch (event) {
    case 'create_branch':
      // Branch created.
      var result = beanstalker.create(payload);
      break;

    case 'delete_branch':
      // Branch deleted.
      var result = beanstalker.delete(payload);
      break;

    default:
      // Unknown event.
      var result = {status: 400, message: 'Unkown event: ' + event};
  }

  // Send the result back to the client.
  response.status(result.status).send(result.message);
});

// Start the server.
app.listen(3000);
