
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, TransactionCategory, CategoryItem } from "../types";

// Declaração da constante global injetada pelo Vite (vite.config.ts)
declare const __GEMINI_API_KEY__: string | undefined;

// Helper para ler variáveis de ambiente de forma segura
const getApiKey = (): string => {
  // 1. Prioridade: Constante injetada no Build (Hardcoded pelo Vite)
  if (typeof __GEMINI_API_KEY__ !== 'undefined' && __GEMINI_API_KEY__) {
    return __GEMINI_API_KEY__;
  }

  // 2. Fallback: Padrão nativo do Vite
  // @ts-ignore
  if (import.meta.env && import.meta.env.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }
  
  // 3. Fallback final para Node/Localhost (process.env)
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  
  return "";
};

export const extractFinancialData = async (
  fileContent: string,
  userContext?: string,
  customCategories?: CategoryItem[]
): Promise<Partial<AppState> & { detectedClientName?: string }> => {
  const model = "gemini-2.5-flash";

  // Inicialização segura dentro da função (Lazy Load)
  const rawApiKey = getApiKey();
  const apiKey = rawApiKey ? rawApiKey.trim() : "";
  
  console.log(`[FinPlanner] API Key carregada: ${apiKey ? apiKey.substring(0, 4) + '...' : 'NÃO ENCONTRADA'}`);
  
  if (!apiKey) {
    throw new Error("ERRO FATAL: API Key não encontrada. Certifique-se de que a variável 'VITE_API_KEY' está configurada no Vercel (Environment Variables) e que você fez o Redeploy após adicionar.");
  }
  
  const ai = new GoogleGenAI({ apiKey: apiKey });

  // Constrói a lista de categorias para o prompt.
  // Se existirem categorias customizadas, usa elas. Caso contrário, fallback para o Enum padrão.
  let categoriesString = "";
  let categoriesListForSchema: string[] = [];

  if (customCategories && customCategories.length > 0) {
      // Formato: "Nome da Categoria (Grupo)" para dar contexto à IA
      categoriesString = customCategories.map(c => `- ${c.name} (Grupo: ${c.group})`).join('\n');
      categoriesListForSchema = customCategories.map(c => c.name);
  } else {
      categoriesString = Object.values(TransactionCategory).join(', ');
      categoriesListForSchema = Object.values(TransactionCategory);
  }

  const prompt = `
    You are a specialized High-End Financial Auditor AI (FinPlanner).
    Your goal is to extract structured financial data from bank statements (PDF/text).
    
    *** CRITICAL: IDENTIFY THE CLIENT ***
    Look at the top of the statement for the Account Holder Name (Nome do Cliente / Titular).
    Return this as 'detectedClientName'.

    *** CRITICAL: CATEGORIZE TRANSACTIONS ***
    You must categorize every transaction into one of the EXACT categories listed below.
    Use the provided "Group" context to help understand the nature of the expense.
    
    --- INTELLIGENT CATEGORIZATION LOGIC ---
    1. **PIX / Transfers**: If it's a PIX to a person:
       - If explicitly mentioned "Faxina", "Limpeza" -> 'Folguista' or 'Mensalista'
       - If mentioned "Aluguel" -> 'Aluguel'
       - If mentioned "Condominio" -> 'Condomínio'
       - If ambiguous, map to 'Diversos' or closest match.

    2. **Context Rules**:
       - Negative values are expenses. Positive values are income.
       - Ignore balance rows (Saldos).
       - Extract the date in YYYY-MM-DD format.

    ${userContext ? `
    *** USER CONTEXT INSTRUCTIONS (HIGH PRIORITY) ***
    The user has provided specific context for this extraction. 
    Follow these instructions strictly, overriding general rules if necessary:
    "${userContext}"
    ` : ''}

    --- VALID CATEGORIES LIST (Name & Group) ---
    You must ONLY use the exact names from this list:
    ${categoriesString}

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
                category: { type: Type.STRING, enum: categoriesListForSchema },
                type: { type: Type.STRING }, // AI fills this but we usually recalc based on category
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
