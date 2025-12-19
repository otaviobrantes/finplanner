
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, TransactionCategory, CategoryItem } from "../types";

export const extractFinancialData = async (
  fileContent: string,
  userContext?: string,
  customCategories?: CategoryItem[]
): Promise<Partial<AppState> & { detectedClientName?: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';

  let categoriesString = "";
  if (customCategories && customCategories.length > 0) {
      categoriesString = customCategories.map(c => `- ${c.name} (Grupo: ${c.group})`).join('\n');
  } else {
      categoriesString = Object.values(TransactionCategory).join(', ');
  }

  const prompt = `
    You are a Senior Financial Auditor AI. Your task is to extract EVERY SINGLE transaction from a Brazilian bank statement or credit card bill with 100% precision.

    *** AUDIT PROTOCOL - FOLLOW STRICTLY ***
    1. TARGET VALUE: Find the "Total de Lançamentos Atuais" (in this bill it is R$ 3.217,45). This is your checksum.
    2. ROW SCANNING: Look for lines following the pattern: [DATE] [DESCRIPTION] [VALUE].
    3. NO OMISSIONS: You MUST extract items even if they are small (e.g., R$ 34,90) or have complex names (e.g., DM*MUBI, PRODUTOS GLOBO 06/12). 
    4. INSTALLMENTS: "06/12" means a monthly installment. Extract the current value for the transactions list.
    5. CHECKSUM VALIDATION: Sum all extracted transaction amounts. If your sum does not match the "Total de Lançamentos Atuais" from the bill, RE-SCAN the text to find what you missed (look for international items, fees, and small purchases).
    
    *** DATA MAPPING ***
    - HOLDER: Found near "Titular" or "Nome do Pagador".
    - CATEGORIZATION: Map each item to the most specific category provided below.
    - INTERNATIONAL: Use the BRL (R$) converted value.

    ${userContext ? `*** SPECIFIC USER INSTRUCTIONS: "${userContext}" ***` : ''}

    --- VALID CATEGORIES ---
    ${categoriesString}

    --- DOCUMENT CONTENT (OCR) ---
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
          detectedClientName: { type: Type.STRING },
          personalData: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              cpf: { type: Type.STRING },
              netIncomeAnnual: { type: Type.NUMBER }
            }
          },
          transactions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING, description: "YYYY-MM-DD" },
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING },
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
                type: { type: Type.STRING, enum: ['Ação', 'FII', 'Renda Fixa', 'Exterior', 'Cripto', 'Previdência', 'Imóvel', 'Veículo', 'Dívida'] },
                totalValue: { type: Type.NUMBER },
                institution: { type: Type.STRING }
              }
            }
          }
        },
        required: ["transactions"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("A IA não retornou dados.");

  try {
    const parsed = JSON.parse(text.trim());
    
    // Log de auditoria interna para debug no console
    console.log("Auditoria FinPlanner:", {
        count: parsed.transactions?.length,
        sum: parsed.transactions?.reduce((a: number, b: any) => a + (b.amount || 0), 0)
    });

    return parsed;
  } catch (e) {
    console.error("Erro no parse JSON:", text);
    throw new Error("Erro na estrutura de dados da IA.");
  }
};
