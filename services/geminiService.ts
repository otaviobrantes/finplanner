
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, TransactionCategory, CategoryItem } from "../types";

export const extractFinancialData = async (
  fileContent: string,
  userContext?: string,
  customCategories?: CategoryItem[]
): Promise<Partial<AppState> & { detectedClientName?: string }> => {
  const apiKey = import.meta.env.VITE_API_KEY;
  console.log("DEBUG: API Key Loaded?", !!apiKey, "Length:", apiKey?.length);

  if (!apiKey) throw new Error("Chave de API do Gemini não configurada (VITE_API_KEY). Verifique as variáveis de ambiente no Vercel.");

  const ai = new GoogleGenAI({ apiKey });
  // Trocando para o modelo PRO (mais robusto) conforme solicitação do usuário.
  // Modelos disponíveis (Dez/2024): gemini-1.5-pro, gemini-1.5-flash
  const model = 'gemini-1.5-pro';

  let categoriesString = "";
  if (customCategories && customCategories.length > 0) {
    categoriesString = customCategories.map(c => `- ${c.name} (Grupo: ${c.group})`).join('\n');
  } else {
    categoriesString = Object.values(TransactionCategory).join(', ');
  }

  const prompt = `
    You are a Senior Financial Auditor AI. Your task is to extract EVERY SINGLE transaction from a Brazilian bank statement or credit card bill with 100% precision.

    *** AUDIT PROTOCOL - FOLLOW STRICTLY ***
    1. TARGET VALUE: Identify the "Total Amount" or "Total de Lançamentos" in the document header/footer. This is your checksum target.
    2. ROW SCANNING: Look for lines following the pattern: [DATE] [DESCRIPTION] [VALUE].
    3. NO OMISSIONS: You MUST extract items even if they are small (e.g., R$ 34,90) or have complex names (e.g., DM*MUBI, PRODUTOS GLOBO 06/12). 
    4. INSTALLMENTS: "06/12" means a monthly installment. Extract the current value for the transactions list.
    5. CHECKSUM VALIDATION: Sum the ABSOLUTE VALUES of extracted transactions. Compare with the Target Value found in step 1. If they diverge significantly, RE-SCAN.
    
    *** CRITICAL: DOCUMENT TYPE & SIGN LOGIC ***
    1. DETECT TYPE:
       - "CREDIT CARD BILL" (Fatura): Look for keywords "Vencimento", "Pagamento Mínimo", "Limite", "Fatura".
       - "BANK STATEMENT" (Extrato): Look for keywords "Saldo", "Extrato", "Conta Corrente", "Pix".

    2. APPLY SIGNS BASED ON TYPE:
       - IF CREDIT CARD BILL: 
         * Positive values in the PDF are usually PURCHASES/DEBITS -> You MUST convert them to NEGATIVE numbers (e.g., 100.00 becomes -100.00).
         * Negative values (often marked with "-" or "CR") are PAYMENTS/CREDITS -> Convert to POSITIVE numbers.
       - IF BANK STATEMENT:
         * Positive values are INCOME/DEPOSITS -> Keep POSITIVE.
         * Negative values are EXPENSES/WITHDRAWALS -> Keep NEGATIVE.

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

  // Função helper de delay
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
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

      const parsed = JSON.parse(text.trim());

      // Log de auditoria interna para debug no console
      console.log("Auditoria FinPlanner:", {
        count: parsed.transactions?.length,
        sum: parsed.transactions?.reduce((a: number, b: any) => a + (b.amount || 0), 0)
      });

      return parsed;

    } catch (e: any) {
      console.error(`Erro na tentativa ${attempts + 1}:`, e);

      // LISTAGEM DE MODELOS PARA DEBUG SE DER 404
      if (e.message?.includes("404") || e.status === 404) {
        try {
          console.log("Tentando listar modelos disponíveis...");
          const listResp = await ai.models.list();
          console.log("Modelos Disponíveis:", listResp);
        } catch (listErr) {
          console.error("Não foi possível listar modelos:", listErr);
        }
      }

      // Verifica se é erro de cota (429) ou Resource Exhausted
      if (e.message?.includes("429") || e.status === 429 || e.message?.includes("Quota exceeded") || e.message?.includes("RESOURCE_EXHAUSTED")) {
        console.warn(`Tentativa ${attempts + 1} falhou por limite de cota.`);

        // Tenta extrair o tempo de espera da mensagem de erro
        const waitTimeMatch = e.message.match(/retry in (\d+(\.\d+)?)s/);
        let waitTime = 30000; // Tempo padrão: 30s

        if (waitTimeMatch) {
          // Adiciona 2s de margem de segurança
          waitTime = Math.ceil(parseFloat(waitTimeMatch[1]) * 1000) + 2000;
        }

        if (attempts < maxAttempts - 1) {
          console.log(`Aguardando ${waitTime / 1000}s para tentar novamente...`);
          await sleep(waitTime);
          attempts++;
          continue; // Tenta novamente
        }
      }

      throw new Error("Erro ao processar com IA: " + (e.message || e));
    }
  }

  throw new Error("Falha após múltiplas tentativas. Verifique sua cota ou tente mais tarde.");
};
