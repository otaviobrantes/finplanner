import { AppState, TransactionCategory, CategoryItem } from "../types";

// Lista completa de modelos do OpenRouter para extração financeira
// Inclui modelos GRATUITOS (:free) e modelos PAGOS (famosos)
export const OPENROUTER_MODELS = [
  // ============================================
  // MODELOS PAGOS (PREMIUM) - Mais estáveis
  // ============================================

  // OpenAI
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', context: '128K', free: false },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', context: '128K', free: false },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', context: '128K', free: false },
  { id: 'openai/o1', name: 'o1', provider: 'OpenAI', context: '200K', free: false },
  { id: 'openai/o1-mini', name: 'o1 Mini', provider: 'OpenAI', context: '128K', free: false },

  // Anthropic
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic', context: '200K', free: false },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', context: '200K', free: false },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic', context: '200K', free: false },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', context: '200K', free: false },

  // Google (Pagos)
  { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro Preview', provider: 'Google', context: '1M', free: false },
  { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash Preview', provider: 'Google', context: '1M', free: false },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'Google', context: '2M', free: false },

  // DeepSeek (Pagos)
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek', context: '64K', free: false },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', context: '64K', free: false },

  // ============================================
  // MODELOS GRATUITOS (:free)
  // ============================================

  // Google (Free)
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', provider: 'Google (Free)', context: '131K', free: true },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Experimental', provider: 'Google (Free)', context: '1.05M', free: true },

  // Meta (Free)
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct', provider: 'Meta (Free)', context: '131K', free: true },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B Instruct', provider: 'Meta (Free)', context: '131K', free: true },
  { id: 'meta-llama/llama-3.1-405b-instruct:free', name: 'Llama 3.1 405B Instruct', provider: 'Meta (Free)', context: '131K', free: true },
  { id: 'meta-llama/llama-3.1-70b-instruct:free', name: 'Llama 3.1 70B Instruct', provider: 'Meta (Free)', context: '131K', free: true },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B Instruct', provider: 'Meta (Free)', context: '131K', free: true },

  // Qwen (Free)
  { id: 'qwen/qwen2.5-vl-7b-instruct:free', name: 'Qwen2.5-VL 7B Instruct', provider: 'Qwen (Free)', context: '33K', free: true },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B Instruct', provider: 'Qwen (Free)', context: '131K', free: true },
  { id: 'qwen/qwen-2.5-7b-instruct:free', name: 'Qwen 2.5 7B Instruct', provider: 'Qwen (Free)', context: '131K', free: true },
  { id: 'qwen/qwen-2-7b-instruct:free', name: 'Qwen 2 7B Instruct', provider: 'Qwen (Free)', context: '32K', free: true },

  // Nous Research (Free)
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B Instruct', provider: 'Nous (Free)', context: '131K', free: true },
  { id: 'nousresearch/hermes-3-llama-3.1-70b:free', name: 'Hermes 3 70B Instruct', provider: 'Nous (Free)', context: '131K', free: true },

  // Mistral (Free)
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct', provider: 'Mistral (Free)', context: '33K', free: true },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1 24B', provider: 'Mistral (Free)', context: '96K', free: true },
  { id: 'mistralai/devstral-small:free', name: 'Devstral Small', provider: 'Mistral (Free)', context: '128K', free: true },

  // Microsoft (Free)
  { id: 'microsoft/phi-4:free', name: 'Phi-4', provider: 'Microsoft (Free)', context: '16K', free: true },
  { id: 'microsoft/phi-3-medium-128k-instruct:free', name: 'Phi-3 Medium 128K', provider: 'Microsoft (Free)', context: '128K', free: true },
  { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini 128K', provider: 'Microsoft (Free)', context: '128K', free: true },

  // NVIDIA (Free)
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nemotron 70B Instruct', provider: 'NVIDIA (Free)', context: '131K', free: true },

  // DeepSeek (Free)
  { id: 'deepseek/deepseek-r1-distill-llama-70b:free', name: 'DeepSeek R1 Distill 70B', provider: 'DeepSeek (Free)', context: '64K', free: true },
  { id: 'deepseek/deepseek-r1-distill-qwen-32b:free', name: 'DeepSeek R1 Distill 32B', provider: 'DeepSeek (Free)', context: '64K', free: true },
  { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1 0528', provider: 'DeepSeek (Free)', context: '64K', free: true },

  // Hugging Face (Free)
  { id: 'huggingfaceh4/zephyr-7b-beta:free', name: 'Zephyr 7B Beta', provider: 'HuggingFace (Free)', context: '32K', free: true },

  // Google Gemma (Free - Mais versões)
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B', provider: 'Google (Free)', context: '8K', free: true },
  { id: 'google/gemma-3-4b-it:free', name: 'Gemma 3 4B', provider: 'Google (Free)', context: '131K', free: true },
  { id: 'google/gemma-3-12b-it:free', name: 'Gemma 3 12B', provider: 'Google (Free)', context: '131K', free: true },

  // OpenChat (Free)
  { id: 'openchat/openchat-7b:free', name: 'OpenChat 7B', provider: 'OpenChat (Free)', context: '8K', free: true },

  // AllenAI (Free)
  { id: 'allenai/olmo-2-0325-32b-instruct:free', name: 'OLMo 2 32B Instruct', provider: 'AllenAI (Free)', context: '32K', free: true },

  // Bytedance (Free)
  { id: 'bytedance-research/ui-tars-72b:free', name: 'UI-TARS 72B', provider: 'Bytedance (Free)', context: '32K', free: true },

  // Featherless (Free)  
  { id: 'featherless/qwerky-72b:free', name: 'Qwerky 72B', provider: 'Featherless (Free)', context: '32K', free: true },

  // TNG (Free)
  { id: 'tngtech/deepseek-r1t-chimera:free', name: 'DeepSeek R1T Chimera', provider: 'TNG (Free)', context: '64K', free: true },

  // Moonshotai (Free)
  { id: 'moonshotai/kimi-vl-a3b-thinking:free', name: 'Kimi VL A3B Thinking', provider: 'Moonshot (Free)', context: '128K', free: true },

  // Liquid (Free)
  { id: 'liquid/lfm-7b:free', name: 'LFM 7B', provider: 'Liquid (Free)', context: '32K', free: true },
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

      // Verifica se é erro de rate limit (429) ou erro temporário do provider
      const isRetryable =
        e.message?.includes("429") ||
        e.message?.includes("rate limit") ||
        e.message?.includes("Provider returned error") ||
        e.message?.includes("upstream") ||
        e.message?.includes("temporarily");

      if (isRetryable && attempts < maxAttempts - 1) {
        console.warn(`Tentativa ${attempts + 1} falhou. Erro temporário do provedor.`);
        const waitTime = 5000 * (attempts + 1); // 5s, 10s, 15s progressivo
        console.log(`Aguardando ${waitTime / 1000}s para tentar novamente...`);
        await sleep(waitTime);
        attempts++;
        continue;
      }

      // Mensagem de erro mais amigável
      let userMessage = e.message || "Erro desconhecido";
      if (e.message?.includes("Provider returned error")) {
        userMessage = "O provedor de IA está temporariamente indisponível. Tente novamente ou escolha outro modelo.";
      } else if (e.message?.includes("rate limit") || e.message?.includes("429")) {
        userMessage = "Limite de requisições atingido. Aguarde alguns segundos e tente novamente.";
      } else if (e.message?.includes("400") || e.message?.includes("Bad Request")) {
        userMessage = "Modelo não encontrado ou inválido. Selecione outro modelo.";
      }

      throw new Error("Erro ao processar com OpenRouter: " + userMessage);
    }
  }

  throw new Error("Falha após múltiplas tentativas. Verifique sua cota ou tente mais tarde.");
};
