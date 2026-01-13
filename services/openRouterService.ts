import { AppState, TransactionCategory, CategoryItem } from "../types";

// Lista completa de modelos do OpenRouter para extração financeira
// Atualizada com base na lista oficial fornecida
export const OPENROUTER_MODELS = [
  // ============================================
  // MODELOS PAGOS (PREMIUM) - Mais estáveis
  // ============================================

  // OpenAI
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', context: '128K', free: false },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Recomendado)', provider: 'OpenAI', context: '128K', free: false },
  { id: 'openai/o1', name: 'o1', provider: 'OpenAI', context: '200K', free: false },

  // Anthropic
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', context: '200K', free: false },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', context: '200K', free: false },

  // Google (Pagos)
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'Google', context: '2M', free: false },
  { id: 'google/gemini-2.5-flash-preview-09-2025', name: 'Gemini 2.5 Flash Preview', provider: 'Google', context: '1M', free: false },

  // DeepSeek (Pagos)
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (Recomendado)', provider: 'DeepSeek', context: '64K', free: false },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', context: '164K', free: false },

  // ============================================
  // MODELOS GRATUITOS (CONFIRMADOS :free)
  // ============================================

  // Google
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', provider: 'Google (Free)', context: '131K', free: true },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Exp', provider: 'Google (Free)', context: '1M', free: true },
  { id: 'google/gemma-3-12b-it:free', name: 'Gemma 3 12B', provider: 'Google (Free)', context: '131K', free: true },
  { id: 'google/gemma-3-4b-it:free', name: 'Gemma 3 4B', provider: 'Google (Free)', context: '32K', free: true },

  // Meta
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct', provider: 'Meta (Free)', context: '131K', free: true },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B Instruct', provider: 'Meta (Free)', context: '131K', free: true },
  { id: 'meta-llama/llama-3.1-405b-instruct:free', name: 'Llama 3.1 405B Instruct', provider: 'Meta (Free)', context: '131K', free: true },

  // Qwen
  { id: 'qwen/qwen-2.5-vl-7b-instruct:free', name: 'Qwen2.5-VL 7B Instruct', provider: 'Qwen (Free)', context: '32K', free: true },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder 480B A35B', provider: 'Qwen (Free)', context: '262K', free: true },
  { id: 'qwen/qwen3-4b:free', name: 'Qwen3 4B', provider: 'Qwen (Free)', context: '40K', free: true },

  // Nous Research
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B Instruct', provider: 'Nous (Free)', context: '131K', free: true },

  // Mistral
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct', provider: 'Mistral (Free)', context: '32K', free: true },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1 24B', provider: 'Mistral (Free)', context: '128K', free: true },
  { id: 'mistralai/devstral-2512:free', name: 'Devstral 2 2512', provider: 'Mistral (Free)', context: '262K', free: true },

  // NVIDIA
  { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'Nemotron 3 Nano 30B', provider: 'NVIDIA (Free)', context: '256K', free: true },
  { id: 'nvidia/nemotron-nano-12b-v2-vl:free', name: 'Nemotron Nano 12B VL', provider: 'NVIDIA (Free)', context: '128K', free: true },
  { id: 'nvidia/nemotron-nano-9b-v2:free', name: 'Nemotron Nano 9B', provider: 'NVIDIA (Free)', context: '128K', free: true },

  // DeepSeek & TNG
  { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1 0528', provider: 'DeepSeek (Free)', context: '163K', free: true },
  { id: 'tngtech/deepseek-r1t-chimera:free', name: 'DeepSeek R1T Chimera', provider: 'TNG (Free)', context: '64K', free: true },
  { id: 'tngtech/deepseek-r1t2-chimera:free', name: 'DeepSeek R1T2 Chimera', provider: 'TNG (Free)', context: '163K', free: true },

  // Outros
  { id: 'allenai/olmo-3.1-32b-think:free', name: 'OLMo 3.1 32B Think', provider: 'AllenAI (Free)', context: '65K', free: true },
  { id: 'allenai/olmo-3-32b-think:free', name: 'OLMo 3 32B Think', provider: 'AllenAI (Free)', context: '65K', free: true },
  { id: 'xiaomi/mimo-v2-flash:free', name: 'MiMo-V2-Flash', provider: 'Xiaomi (Free)', context: '262K', free: true },
  { id: 'kwaipilot/kat-coder-pro:free', name: 'KAT-Coder-Pro V1', provider: 'Kwaipilot (Free)', context: '256K', free: true },
  { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air', provider: 'Z.AI (Free)', context: '131K', free: true },
  { id: 'moonshotai/kimi-k2:free', name: 'Kimi K2 0711', provider: 'Moonshot (Free)', context: '32K', free: true },
  { id: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', name: 'Dolphin Mistral 24B', provider: 'Venice (Free)', context: '32K', free: true },
  { id: 'alibaba/tongyi-deepresearch-30b-a3b:free', name: 'Tongyi DeepResearch 30B', provider: 'Alibaba (Free)', context: '131K', free: true },

  // OpenAI OSS
  { id: 'openai/gpt-oss-120b:free', name: 'GPT OSS 120B', provider: 'OpenAI (Free)', context: '131K', free: true },
  { id: 'openai/gpt-oss-20b:free', name: 'GPT OSS 20B', provider: 'OpenAI (Free)', context: '131K', free: true },
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
      } else if (e.message?.includes("400") || e.message?.includes("Bad Request") || e.message?.includes("not a valid model ID")) {
        userMessage = "Modelo não encontrado ou inválido. Selecione outro modelo.";
      }

      throw new Error("Erro ao processar com OpenRouter: " + userMessage);
    }
  }

  throw new Error("Falha após múltiplas tentativas. Verifique sua cota ou tente mais tarde.");
};
