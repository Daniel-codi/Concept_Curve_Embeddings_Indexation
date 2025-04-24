//==================================================================================
//  Code for AI with Unlimited Context Memory - by Daniel Bistman from Argentina
//  More info https://www.youtube.com/@Agente_Concept_Curve
//==================================================================================

require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Import SmartFunctions (AI-powered functions)
const {
    polishQuestion,
    identifyFiles,
    buildAnswer,
    polishAnswer
} = require('./smartFunctions');

// Import helper functions
const { updateHistory, getHistory } = require('./functions');

// Create and export the router
const router = express.Router();

// Load user configuration from .env
const maxChunks = parseInt(process.env.MAX_CHUNKS, 10) || 5;      // Max number of chunks to fetch
const maxAnswers = parseInt(process.env.MAX_ANSWERS, 10) || 3;   // Max number of valid answers

// Read context and document index files once (improves performance)
const contextIndexPath = path.join(__dirname, '../data', '_Context_Index.txt');
const documentIndexPath = path.join(__dirname, '../data', '_Document_Index.txt');

const allowedContext = fs.readFileSync(contextIndexPath, 'utf8');
const documentIndex = fs.readFileSync(documentIndexPath, 'utf8');

//==============================================================================
//=========  Main Route - handles queries in 6 steps  =========================
//==============================================================================

router.post('/query', async (req, res) => {
    console.log(" ");
    console.log("\nQuery received:", req.body.question);
    const originalQuestion = req.body.question;

    // Initialize token counters
    let tokensIn = 0;
    let tokensOut = 0;

    //==================================================================
    //  Step 1: SmartFunction - Polish the query
    //==================================================================
    let polishedQuery;
    try {
        const history = getHistory();
        const polishedResult = await polishQuestion(originalQuestion, allowedContext, history);

        polishedQuery = polishedResult.polishedQuery;
        tokensIn   += polishedResult.tokens_in;
        tokensOut  += polishedResult.tokens_out;

        console.log(" ");
        console.log("\nPolished query:", polishedQuery);
    } catch (error) {
        console.error("Error polishing the query:", error);
        return res.status(500).json({ error: 'Error rephrasing the query.' });
    }

    // ---- combined string used everywhere below ----
    const combinedQuery = `${originalQuestion}\n${polishedQuery}`;

    //==================================================================
    //  Step 2: SmartFunction - Identify relevant files
    //==================================================================
    let relevantFiles;
    try {
        const filesResult = await identifyFiles(combinedQuery, documentIndex, maxChunks);

        relevantFiles = filesResult.relevantFiles;
        tokensIn     += filesResult.tokens_in;
        tokensOut    += filesResult.tokens_out;
        console.log(" ");
        console.log("\nIdentified relevant files:", relevantFiles, "\n");
        console.log(" ");

    } catch (error) {
        console.error("Error identifying relevant files:", error);
        return res.status(500).json({ error: 'Error identifying relevant files.' });
    }

    //==================================================================
    //  Step 3: SmartFunction - Build the answer
    //==================================================================
    let finalAnswer;
    let examinedChunks = 0;
    let positiveResponseCount = 0;
    try {
        const queryText   = combinedQuery;        // already concatenated
        const answerResult = await buildAnswer(relevantFiles, queryText, maxAnswers);

        finalAnswer          = answerResult.finalAnswer;
        examinedChunks       = answerResult.examinedChunks;
        positiveResponseCount = answerResult.positiveResponseCount;
        tokensIn            += answerResult.tokens_in;
        tokensOut           += answerResult.tokens_out;

    } catch (error) {
        console.error("Error building the answer:", error);
        return res.status(500).json({ error: 'Error building the answer.' });
    }

    //==================================================================
    //  Step 4: SmartFunction - Polish the answer
    //==================================================================
    if (positiveResponseCount > 0) {
        try {
            const polishAnswerResult = await polishAnswer(polishedQuery, allowedContext, finalAnswer);
            finalAnswer  = polishAnswerResult.polishedAnswer;
            tokensIn    += polishAnswerResult.tokens_in;
            tokensOut   += polishAnswerResult.tokens_out;
        } catch (error) {
            console.error("Error refining the answer:", error);
            return res.status(500).json({ error: 'There was a problem refining the answer.' });
        }
    }

    //==================================================================
    //  Step 5: Function - Update conversation history
    //==================================================================
    updateHistory(polishedQuery, finalAnswer);

    //==================================================================
    //  Step 6: Calculate cost, metrics, and return final answer
    //==================================================================
    const cost         = (tokensIn * 0.15 / 1_000_000) + (tokensOut * 0.60 / 1_000_000);
    const formattedCost = cost.toFixed(4); // Show with 4 decimals

    console.log(" ");
    console.log("\n-------------------------------------------");
    console.log(`Chunks examined = ${examinedChunks}`);
    console.log(`Positive responses = ${positiveResponseCount}`);
    console.log(`TokensIn = ${tokensIn}`);
    console.log(`TokensOut = ${tokensOut}`);
    console.log(`Final query cost: ${formattedCost} USD`);
    console.log("-------------------------------------------\n");
    console.log(" ");

    res.json({ finalAnswer });
});

module.exports = router;
//==================================================================================
//  Code for AI with Unlimited Context Memory - by Daniel Bistman
//  More info https://www.youtube.com/@Agente_Concept_Curve - Consider donate.
//  agent.concept.curve@gmail.com 
//  Free to use with attribution. Acknowledge the author.
//==================================================================================