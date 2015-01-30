// Load dependencies and initiate express.
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

// Use the body-parser middleware in order to read POST data.
app.use(bodyParser.json());

// Listen for POST data at the root path.
app.post('/', function(request, response) {
  response.send(request.body);
});

// Start the server.
app.listen(3000);
