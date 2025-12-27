
import { AppState, TransactionCategory, CategoryItem } from "../types";

export const extractFinancialDataWithClaude = async (
  fileContent: string,
  userContext?: string,
  customCategories?: CategoryItem[]
): Promise<Partial<AppState> & { detectedClientName?: string }> => {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY ? import.meta.env.VITE_CLAUDE_API_KEY.trim() : "";

  if (!apiKey) throw new Error("Chave de API do Claude não configurada (VITE_CLAUDE_API_KEY).");

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

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "dangerously-allow-browser": "true" // Note: In a real production app, this should be handled by a backend
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Claude API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.content[0].text;

    // Attempt to parse JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("A IA não retornou um JSON válido.");

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;

  } catch (error: any) {
    console.error("Error in Claude extraction:", error);
    throw new Error("Erro ao processar com Claude: " + (error.message || "Erro desconhecido"));
  }
};
