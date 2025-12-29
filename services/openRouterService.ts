import { AppState, TransactionCategory, CategoryItem } from "../types";

// Lista de modelos GRATUITOS do OpenRouter para extração financeira
export const OPENROUTER_MODELS = [
  // Google
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', provider: 'Google', context: '131K', free: true },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Experimental', provider: 'Google', context: '1.05M', free: true },

  // Meta
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct', provider: 'Meta', context: '131K', free: true },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B Instruct', provider: 'Meta', context: '131K', free: true },
  { id: 'meta-llama/llama-3.1-405b-instruct:free', name: 'Llama 3.1 405B Instruct', provider: 'Meta', context: '131K', free: true },

  // Qwen
  { id: 'qwen/qwen2.5-vl-7b-instruct:free', name: 'Qwen2.5-VL 7B Instruct', provider: 'Qwen', context: '33K', free: true },

  // Nous Research
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B Instruct', provider: 'Nous Research', context: '131K', free: true },

  // Mistral
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct', provider: 'Mistral AI', context: '33K', free: true },
];

export const extractFinancialDataWithOpenRouter = async (
  fileContent: string,
  modelId: string,
  userContext?: string,
  customCategories?: CategoryItem[]
): Promise<Partial<AppState> & { detectedClientName?: string }> => {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY ? import.meta.env.VITE_OPENROUTER_API_KEY.trim() : "";

  if (!apiKey) throw new Error("Chave de API do OpenRouter não configurada (VITE_OPENROUTER_API_KEY).");

  let categoriesString = "";
  if (customCategories && customCategories.length > 0) {
    categoriesString = customCategories.map(c => `- ${c.name} (Grupo: ${c.group})`).join('\n');
  } else {
    categoriesString = Object.values(TransactionCategory).join(', ');
  }

  const systemPrompt = `
    You are a Senior Financial Auditor AI. Your task is to extract EVERY SINGLE transaction from a Brazilian bank statement or credit card bill with 100% precision.
    Return ONLY a valid JSON object matching the requested schema.
  `;

  const userPrompt = `
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

    *** OUTPUT SCHEMA ***
    {
      "detectedClientName": "string",
      "personalData": {
        "name": "string",
        "cpf": "string",
        "netIncomeAnnual": number
      },
      "transactions": [
        {
          "date": "YYYY-MM-DD",
          "description": "string",
          "amount": number,
          "category": "string",
          "institution": "string"
        }
      ],
      "assets": [
        {
          "ticker": "string",
          "type": "Ação | FII | Renda Fixa | Exterior | Cripto | Previdência | Imóvel | Veículo | Dívida",
          "totalValue": number,
          "institution": "string"
        }
      ]
    }
  `;

  // Função helper de delay
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "FinPlanner"
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenRouter API Error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (!text) throw new Error("A IA não retornou dados.");

      // Attempt to parse JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("A IA não retornou um JSON válido.");

      const parsed = JSON.parse(jsonMatch[0]);

      // Log de auditoria interna para debug no console
      console.log("Auditoria FinPlanner (OpenRouter):", {
        model: modelId,
        count: parsed.transactions?.length,
        sum: parsed.transactions?.reduce((a: number, b: any) => a + (b.amount || 0), 0)
      });

      return parsed;

    } catch (e: any) {
      console.error(`Erro na tentativa ${attempts + 1}:`, e);

      // Verifica se é erro de rate limit (429)
      if (e.message?.includes("429") || e.message?.includes("rate limit")) {
        console.warn(`Tentativa ${attempts + 1} falhou por limite de taxa.`);

        if (attempts < maxAttempts - 1) {
          const waitTime = 30000; // 30 segundos
          console.log(`Aguardando ${waitTime / 1000}s para tentar novamente...`);
          await sleep(waitTime);
          attempts++;
          continue;
        }
      }

      throw new Error("Erro ao processar com OpenRouter: " + (e.message || e));
    }
  }

  throw new Error("Falha após múltiplas tentativas. Verifique sua cota ou tente mais tarde.");
};
