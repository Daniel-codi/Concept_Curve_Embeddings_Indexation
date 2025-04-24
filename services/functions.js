const path = require('path');
const fs = require('fs');

// Load environment variables
const MAX_HISTORY = process.env.MAX_HISTORY || 2; // Max number of stored queries in memory

let History = []; // Global history

//====================================================================
//-- Function: Update the conversation history -----------------------
//====================================================================
function updateHistory(question, answer) {
    History.push({ question, answer });

    // Keep only the last MAX_HISTORY interactions
    if (History.length > MAX_HISTORY) {
        History.shift(); // Remove the oldest interaction
    }
}

//====================================================================
//-- Function: Get the current conversation history -----------------
//====================================================================
function getHistory() {
    return History;
}


//====================================================================
//-- Export all functions correctly ---------------------------------
//====================================================================
module.exports = {
    updateHistory,
    getHistory,
};