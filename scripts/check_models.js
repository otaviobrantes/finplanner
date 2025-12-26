import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' }); // Also load from .env

// We'll read the key from the file directly if needed or assume user has it in environment manually for this node script
// Since this is a browser app, getting the key in a pure node script specifically might need manual input or parsing the .env file if it exists.
// Let's try to assume a simple node script that reads specific env var.

const apiKey = process.env.VITE_API_KEY;

async function listModels() {
    if (!apiKey) {
        console.error("Please set VITE_API_KEY environment variable to run this script.");
        return;
    }

    const ai = new GoogleGenAI({ apiKey });

    try {
        console.log("Fetching available models...");
        const response = await ai.models.list();

        // The response structure depends on the specific SDK version, but usually contains a list of models
        console.log("--- AVAILABLE MODELS ---");
        // Depending on SDK version, response might be the list or contain 'models' property
        const models = Array.isArray(response) ? response : response.models || [];

        models.forEach((m) => {
            // Filter for generateContent supported models
            if (m.supportedGenerationMethods?.includes("generateContent")) {
                console.log(`- ${m.name} (${m.displayName})`);
            }
        });

        // Also print raw if empty to debug
        if (models.length === 0) {
            console.log("No models found or raw response:", JSON.stringify(response, null, 2));
        }

    } catch (error) {
        console.error("Error listing models:", error.message);
    }
}

listModels();
