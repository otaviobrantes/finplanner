import { GoogleGenAI, Type } from "@google/genai";
import { AppState, TransactionCategory } from "../types";

// NÃO inicialize a classe aqui fora, pois se a chave for undefined no carregamento, o app quebra (Tela Branca).
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY }); 

export const extractFinancialData = async (
  fileContent: string
): Promise<Partial<AppState> & { detectedClientName?: string }> => {
  const model = "gemini-2.5-flash";

  // Inicialização segura dentro da função (Lazy Load)
  // O trim() remove espaços em branco que podem vir no copy-paste acidental
  const apiKey = process.env.API_KEY ? process.env.API_KEY.trim() : "";
  
  if (!apiKey) {
    throw new Error("API Key não encontrada. Configure a variável 'VITE_API_KEY' nas configurações (Environment Variables) do Vercel e faça o Redeploy.");
  }
  
  const ai = new GoogleGenAI({ apiKey: apiKey });

  const categoriesList = Object.values(TransactionCategory).join(', ');

  const prompt = `
    You are a specialized High-End Financial Auditor AI (FinPlanner).
    Your goal is to extract structured financial data from bank statements (PDF/text).
    
    *** CRITICAL: IDENTIFY THE CLIENT ***
    Look at the top of the statement for the Account Holder Name (Nome do Cliente / Titular).
    Return this as 'detectedClientName'.

    *** CRITICAL: CATEGORIZE TRANSACTIONS ***
    You must categorize every transaction into one of the EXACT categories listed below.
    
    --- INTELLIGENT CATEGORIZATION LOGIC ---
    1. **PIX / Transfers**: If it's a PIX to a person (e.g., "PIX ENVIADO MARIA..."):
       - If explicitly mentioned "Faxina", "Limpeza" -> '${TransactionCategory.HOUSEKEEPER_WEEKEND}'
       - If mentioned "Aluguel" -> '${TransactionCategory.RENT}'
       - If mentioned "Condominio" -> '${TransactionCategory.CONDO_FEE}'
       - If no context is provided, but it looks like a service provider, try to map to 'Outros' or a specific service.
       - If ambiguous, default to '${TransactionCategory.OTHERS}' (Diversos).

    2. **Keywords Mapping (Examples)**:
       - Uber, Taxi, 99, Cabify -> '${TransactionCategory.RIDE_APP}'
       - Posto, Gasolina, Ipiranga, Shell, Petrobras -> '${TransactionCategory.FUEL}'
       - Netflix, Spotify, Amazon Prime, Apple, Disney+, HBO -> '${TransactionCategory.STREAMING}'
       - Drogasil, Raia, Drogaria, Pacheco, Venancio -> '${TransactionCategory.PHARMACY}'
       - Pão de Açúcar, Carrefour, Zaffari, Mundial, Hortifruti -> '${TransactionCategory.SUPERMARKET}'
       - Padaria, Confeitaria, Boteco -> '${TransactionCategory.BAKERY}'
       - Zara, Renner, Nike, Adidas, Riachuelo, Shein -> '${TransactionCategory.CLOTHES_ADULT}'
       - Hospital, Laboratório, Exame, Consulta, Dr., Dra. -> '${TransactionCategory.HOSPITAL}'
       - Condominio, Cotas, Adm -> '${TransactionCategory.CONDO_FEE}'
       - Aluguel, Imobiliária, QuintoAndar -> '${TransactionCategory.RENT}'
       - Salário, Proventos, Pagamento,