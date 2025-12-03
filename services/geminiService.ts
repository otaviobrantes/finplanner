import { GoogleGenAI, Type } from "@google/genai";
import { AppState, TransactionCategory } from "../types";

// Helper para ler variáveis de ambiente de forma segura no Vite
const getApiKey = (): string => {
  // 1. Tenta ler via process.env (injetado pelo vite.config.ts)
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  // 2. Fallback: Tenta ler via import.meta.env (Padrão nativo do Vite/Vercel)
  // @ts-ignore
  if (import.meta.env && import.meta.env.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }
  return "";
};

export const extractFinancialData = async (
  fileContent: string
): Promise<Partial<AppState> & { detectedClientName?: string }> => {
  const model = "gemini-2.5-flash";

  // Inicialização segura dentro da função (Lazy Load)
  const rawApiKey = getApiKey();
  const apiKey = rawApiKey ? rawApiKey.trim() : "";
  
  if (!apiKey) {
    console.error("DEBUG: API Key está vazia. Verifique VITE_API_KEY no Vercel.");
    throw new Error("API Key não encontrada. Verifique se a variável 'VITE_API_KEY' está configurada no Vercel e se você fez o Redeploy após adicionar.");
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
       - Salário, Proventos, Pagamento, Remuneração -> '${TransactionCategory.INCOME_SALARY}'
       - Rendimentos, Dividendos, JCP -> '${TransactionCategory.INCOME_DIVIDENDS}'
       
    3. **General Rules**:
       - Negative values are expenses. Positive values are income.
       - Ignore balance rows (Saldos).
       - Extract the date in YYYY-MM-DD format.

    --- VALID CATEGORIES ---
    ${categoriesList}

    --- INPUT TEXT ---
    ${fileContent}
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detectedClientName: { type: Type.STRING, description: "Name of the account holder detected in the statement" },
          personalData: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              birthDate: { type: Type.STRING },
              nationality: { type: Type.STRING },
              maritalStatus: { type: Type.STRING },
              propertyRegime: { type: Type.STRING },
              address: {
                type: Type.OBJECT,
                properties: {
                  street: { type: Type.STRING },
                  neighborhood: { type: Type.STRING },
                  zipCode: { type: Type.STRING }
                }
              },
              email: { type: Type.STRING },
              profession: { type: Type.STRING },
              company: { type: Type.STRING },
              cnpj: { type: Type.STRING },
              role: { type: Type.STRING },
              incomeDetails: {
                  type: Type.OBJECT,
                  properties: {
                      sourceName: { type: Type.STRING },
                      grossAmount: { type: Type.NUMBER },
                      inss: { type: Type.NUMBER },
                      irrf: { type: Type.NUMBER },
                      thirteenthSalary: { type: Type.NUMBER },
                      thirteenthIrrf: { type: Type.NUMBER },
                      rentIncome: { type: Type.NUMBER },
                      carneLeao: { type: Type.NUMBER }
                  }
              },
              netIncomeAnnual: { type: Type.NUMBER },
              insuranceTotal: { type: Type.NUMBER },
              dependents: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    birthDate: { type: Type.STRING },
                    occupation: { type: Type.STRING },
                    schoolOrCompany: { type: Type.STRING },
                    nationality: { type: Type.STRING },
                    maritalStatus: { type: Type.STRING }
                  }
                }
              }
            }
          },
          transactions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING, enum: Object.values(TransactionCategory) },
                type: { type: Type.STRING },
                institution: { type: Type.STRING }
              }
            }
          },
          assets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ticker: { type: Type.STRING },
                type: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                currentPrice: { type: Type.NUMBER },
                totalValue: { type: Type.NUMBER },
                institution: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No data returned from AI");

  try {
    const data = JSON.parse(text);
    return data;
  } catch (e) {
    console.error("Failed to parse JSON", e);
    throw new Error("Failed to parse AI response");
  }
};