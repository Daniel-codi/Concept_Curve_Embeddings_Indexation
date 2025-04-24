//==================================================================================
//  Code for AI with Unlimited Context Memory - by Daniel Bistman from Argentina
//  More info https://www.youtube.com/@Agente_Concept_Curve
//==================================================================================

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration API key
const API_KEY = process.env.API_KEY;


//===========================================================================================
// * Smart-Function: polishQuestion
// * Input: originalQuery, allowedContext, history (conversation history)
// * Returns: polishedQuery, tokens_in, tokens_out
//===========================================================================================

async function polishQuestion(originalQuery, allowedContext, history) {
    // Convert history array into structured text
    const historyText = history.map((item, index) =>
        `Question (-${history.length - index}): ${item.question}\nAnswer (-${history.length - index}): ${item.answer}`
    ).join('\n');

    const polishQuestionReq = {
        model: "gpt-4.1-nano",
		//model: "gpt-4o-mini",
		//model: "gpt-4.1-mini",
        messages: [
            {
                role: "system",
                content: `Additional context: ${allowedContext}\n\nHistory:\n${historyText}\n\nLast question: "${originalQuery}".`
            },
            {
                role: "user",
                content: "speak english. Rephrase the last question considering context and history. Return only the rephrased question without explanations or comments."
            }
        ],
        max_tokens: 120,
        temperature: 0.1
    };

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            polishQuestionReq,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Extract tokens used
        const tokens_in = response.data.usage?.prompt_tokens || 0;
        const tokens_out = response.data.usage?.completion_tokens || 0;

        // Get the polished query
        const polishedQuery = response.data.choices[0].message.content.trim();

        // Return the three values
        return { polishedQuery, tokens_in, tokens_out };
    } catch (error) {
        console.error(`Error polishing the query: ${error.message}`);
		
        // On error, return the original query and zero tokens
        return { polishedQuery: originalQuery, tokens_in: 0, tokens_out: 0 };
    }
}


//===========================================================================================
// * Smart-Function: identifyFiles
// * Input: polishedQuery, documentIndex, maxChunks
// * Returns: relevantFiles, tokens_in, tokens_out
//===========================================================================================

async function identifyFiles(queryText, documentIndex, maxChunks) {
    const firstRequest = {
        //model: "gpt-4.1-nano",
		//model: "gpt-4o-mini",
		model: "gpt-4.1-mini",
        messages: [
            { role: "system", content: "You are an expert in indexation using Concept Curve Embeddings." },
            {
                role: "user",
                content: `Query: ${queryText}\n\nDocument index:\n${documentIndex}\n\n- Return up to ${maxChunks} exact file names from the index (including leading zeros), separated by commas. Do not modify names or add any commentary.`
            }
        ],
        max_tokens: 100,
        temperature: 0.2
    };

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            firstRequest,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Extract tokens used
        const tokens_in = response.data.usage?.prompt_tokens || 0;
        const tokens_out = response.data.usage?.completion_tokens || 0;

        // Safe handling of relevant files
        const relevantFilesText = response.data.choices?.[0]?.message?.content?.trim();
        let relevantFiles = relevantFilesText
            ? relevantFilesText.split(',').map(file => file.trim())
            : [];

        // Function to normalize file names
        const normalizeFile = (file) =>
            file
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\.$/, "");


        // Apply normalization to each file
        relevantFiles = relevantFiles.map(normalizeFile);

        // Return the three values
        return { relevantFiles, tokens_in, tokens_out };
    } catch (error) {
        console.error(`Error identifying files: ${error.message}`);
		
        // On error, return safe defaults
        return { relevantFiles: [], tokens_in: 0, tokens_out: 0 };
    }
}



//===========================================================================================
// * Smart-Function: buildAnswer
// * Input: files, queryText, maxAnswers
// * Returns: finalAnswer, examinedChunks, positiveResponseCount, tokens_in, tokens_out
//===========================================================================================

async function buildAnswer(files, queryText, maxAnswers) {
    let finalAnswer = "";
    let positiveResponseCount = 0;
    let examinedChunks = 0;
    let tokens_in = 0;
    let tokens_out = 0;

    for (const file of files) {
        if (positiveResponseCount >= maxAnswers) break;

        const filePath = path.join(__dirname, '../data', file);
		
        if (!fs.existsSync(filePath)) {
            console.error(`File ${file} does not exist.`);
            continue;
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const secondRequest = {
            //model: "gpt-4.1-nano",
		    model: "gpt-4o-mini",
		    //model: "gpt-4.1-mini",
            messages: [
                { role: "system", content: "Answer strictly from the provided document." },
                {
                    role: "user",
                    content: `Query: ${queryText}\n\nDocument:\n${fileContent}\n\n- Reference section or index where found, and include a direct quote. If no answer, respond with "-" only.`
                }
            ],
            max_tokens: 400,
            temperature: 0.1
        };

        try {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                secondRequest,
                {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Accumulate token usage
            tokens_in += response.data.usage?.prompt_tokens || 0;
            tokens_out += response.data.usage?.completion_tokens || 0;

            // Get the chunk's answer
            const chunkAnswer = response.data.choices[0].message.content.trim();
            examinedChunks++;

            if (chunkAnswer !== '-') {
                finalAnswer += `${chunkAnswer}\n\n`;
                positiveResponseCount++;
                console.log(" ");
                console.log(`Answer from chunk [${file}] -> positive`);
            } else {
                console.log(" ");
                console.log(`Answer from chunk [${file}] -> -`);
            }
        } catch (error) {
            console.error(`Error in buildAnswer: ${error.message}`);
        }
    }

    if (positiveResponseCount === 0) {
        finalAnswer = "The answer to the query was not found in the examined documents.";
    }

    return { finalAnswer, examinedChunks, positiveResponseCount, tokens_in, tokens_out };
}


//===========================================================================================
// * Smart-Function: polishAnswer
// * Input: query, allowedContext, finalAnswer
// * Returns: polishedAnswer, tokens_in, tokens_out
//===========================================================================================
const outputTokens = parseInt(process.env.OUTPUT_TOKENS, 10) || 1200;  // maximum tokens for final answer

async function polishAnswer(query, allowedContext, finalAnswer) {
    const refinementPrompt = {
    model: "gpt-4.1-nano",
    //model: "gpt-4o-mini",
	//model: "gpt-4.1-mini",
    messages: [
        { role: "system", content: `Organize and present the answers in a harmonious single response.
            - Use Markdown formatting. Use **bold** to emphasize main ideas.
            - Use bullet points and line breaks to improve readability, but do NOT use headers (#, ##, ###).
            - Keep everything in the same font size without large titles. **Do not generate information outside the allowed context**.
            - You may only respond based on the following contexts: ${allowedContext}.
            - If the answer does not belong to these contexts, indicate that the query is outside the allowed context.` },
        { role: "user", content: `Query: ${query}.
            Organize this answer and do not add any data beyond what is here: ${finalAnswer},
            - also mention the index and/or Section and/or legal Article and/or Book, Chapter, and verse where you found each answer,
            - do not autocomplete or add any opinions or assumptions.` }
    ],
    max_tokens: outputTokens,
    temperature: 0.2
};

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            refinementPrompt,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Extract tokens used
        const tokens_in = response.data.usage?.prompt_tokens || 0;
        const tokens_out = response.data.usage?.completion_tokens || 0;

        // Get the polished answer
        const polishedAnswer = response.data.choices[0].message.content.trim();

        // Return the three values
        return { polishedAnswer, tokens_in, tokens_out };
    } catch (error) {
        console.error(`Error refining the answer: ${error.message}\n${error.stack}`);
        
		// On error, return safe defaults
        return { polishedAnswer: "No valid information found within allowed context.", tokens_in: 0, tokens_out: 0 };
    }
}


module.exports = {
    polishQuestion,
    identifyFiles,
    buildAnswer,
    polishAnswer
};
//==================================================================================
//  Code for AI with Unlimited Context Memory - by Daniel Bistman
//  More info https://www.youtube.com/@Agente_Concept_Curve - Consider donate.
//  agent.concept.curve@gmail.com 
//  Free to use with attribution. Acknowledge the author.
//==================================================================================