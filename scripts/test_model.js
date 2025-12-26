import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.VITE_API_KEY;

async function testModel() {
    if (!apiKey) {
        console.error("VITE_API_KEY not found in .env");
        return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName = 'gemini-3-pro-preview';

    try {
        console.log(`Testing model: ${modelName}...`);
        const result = await ai.models.generateContent({
            model: modelName,
            contents: "Diga 'Olá Mundo' em português."
        });
        const text = result.text;
        console.log("Response:", text);
        console.log("SUCCESS: Model is working.");
    } catch (error) {
        console.error("FAILURE: Model test failed.");
        console.error(error);
    }
}

testModel();
