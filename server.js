// Import necessary modules
const express = require('express'); // Framework to handle the server and routes
const bodyParser = require('body-parser'); // Middleware to process JSON data in requests
const cors = require('cors'); // Middleware to enable CORS
const queryRoutes = require('./services/query'); // Import query routes

// Create Express application
const app = express();

//==============================================================================
//  Application configuration
//============================================================================== 

// CORS configuration
const corsOptions = {
    origin: '*', // Replace with your frontend URL in production
    methods: ['POST']
};

// Enable CORS with the custom configuration
app.use(cors(corsOptions));

// Allow JSON in HTTP requests
app.use(bodyParser.json());

// Register query routes under the '/api' prefix
app.use('/api', queryRoutes);

//==============================================================================
// Server configuration
//==============================================================================

// Define the port on which the server will listen for requests
const PORT = process.env.PORT || 3000;

// Start the server and listen on the defined port
app.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
});