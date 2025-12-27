import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurar paths para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar .env da raiz
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const apiKey = process.env.VITE_CLAUDE_API_KEY ? process.env.VITE_CLAUDE_API_KEY.trim() : "";

console.log('--- Diagnóstico API Claude ---');
console.log('Arquivo .env procurado em:', envPath);
console.log('Existe arquivo .env?', fs.existsSync(envPath));
console.log('API Key carregada?', !!apiKey);
if (apiKey) {
    console.log('API Key começa com:', apiKey.substring(0, 10) + '...');
    console.log('Comprimento da chave:', apiKey.length);
} else {
    console.error('ERRO: VITE_CLAUDE_API_KEY não encontrada no .env');
    process.exit(1);
}

async function testClaude() {
    console.log('\nIniciando teste de conexão com Anthropic...');

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-3-5-sonnet-20240620",
                max_tokens: 10,
                messages: [
                    { role: "user", content: "Say hello to check connection." }
                ]
            })
        });

        console.log('Status da resposta:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Corpo do erro:', errorData);
            throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Sucesso! Resposta da IA:', data.content[0].text);
        console.log('\n--- DIAGNÓSTICO CONCLUÍDO: SUCESSO ---');

    } catch (error) {
        console.error('ERRO FATAL:', error.message);
        if (error.cause) console.error('Causa:', error.cause);
        console.log('\n--- DIAGNÓSTICO CONCLUÍDO: FALHA ---');
    }
}

testClaude();
