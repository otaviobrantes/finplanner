import { GoogleGenAI, Type } from "@google/genai";
import { AppState, TransactionCategory } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractFinancialData = async (
  fileContent: string
): Promise<Partial<AppState> & { detectedClientName?: string }> => {
  const model = "gemini-2.5-flash";

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
       - Salário, Proventos, Pagamento, TED Recebida (High Value) -> '${TransactionCategory.INCOME_SALARY}'
       - Dividendos, JCP, Rendimentos -> '${TransactionCategory.INCOME_DIVIDENDS}'
       - Funesbom, Taxa Incendio, DARF -> '${TransactionCategory.FIRE_TAX}'
       - Diarista, Faxina, Empregada -> '${TransactionCategory.HOUSEKEEPER}'
       - Babá, Creche -> '${TransactionCategory.NANNY}'
       - Light, Enel, Águas, Sabesp, Claro, Vivo, Tim -> '${TransactionCategory.HOME_MAINTENANCE}' (Use generically for utilities if specific category missing)

    --- DATA TO EXTRACT ---
    1. **Personal Data**: Name, CPF, Address, Income details if found.
    2. **Transactions**: Date, Description, Amount (+/-), Category (from the list), Institution (e.g., Itaú, Nubank).
    3. **Assets**: Look for "Custódia", "Carteira", "Ações", "FIIs". Extract Ticker, Qty, Value.
    
    --- INPUT TEXT ---
    ${fileContent}
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      detectedClientName: { type: Type.STRING, description: "Name of the account holder found in the document header" },
      personalData: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          birthDate: { type: Type.STRING },
          nationality: { type: Type.STRING },
          maritalStatus: { type: Type.STRING },
          propertyRegime: { type: Type.STRING },
          email: { type: Type.STRING },
          profession: { type: Type.STRING },
          company: { type: Type.STRING },
          role: { type: Type.STRING },
          address: {
            type: Type.OBJECT,
            properties: {
               street: { type: Type.STRING },
               neighborhood: { type: Type.STRING },
               zipCode: { type: Type.STRING }
            }
          },
          incomeDetails: {
              type: Type.OBJECT,
              properties: {
                  sourceName: { type: Type.STRING },
                  grossAmount: { type: Type.NUMBER },
                  inss: { type: Type.NUMBER },
                  irrf: { type: Type.NUMBER },
                  thirteenthSalary: { type: Type.NUMBER },
                  rentIncome: { type: Type.NUMBER }
              }
          },
          dependents: {
              type: Type.ARRAY,
              items: {
                  type: Type.OBJECT,
                  properties: {
                      name: { type: Type.STRING },
                      birthDate: { type: Type.STRING },
                      occupation: { type: Type.STRING },
                      schoolOrCompany: { type: Type.STRING }
                  }
              }
          }
        },
      },
      transactions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "YYYY-MM-DD" },
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING, description: `Must be exactly one of: ${categoriesList}` },
            institution: { type: Type.STRING },
          },
        },
      },
      assets: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            ticker: { type: Type.STRING },
            type: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            totalValue: { type: Type.NUMBER },
            institution: { type: Type.STRING },
          },
        },
      },
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No data returned from AI");

    const parsed = JSON.parse(text);

    // Helper to map specific category to broad group
    const processedTransactions = (parsed.transactions || []).map((t: any, idx: number) => {
      let group = 'Outros';
      const cat = t.category;
      
      if (Object.values(TransactionCategory).includes(cat)) {
          if (cat.includes('Transporte') || cat.includes('Carro') || cat.includes('Uber') || cat.includes('Combustível')) group = 'Transporte';
          else if (cat.includes('Restaurante') || cat.includes('Viagem') || cat.includes('Lazer') || cat.includes('Social') || cat.includes('Netflix')) group = 'Social';
          else if (cat.includes('Saúde') || cat.includes('Médico') || cat.includes('Hospital') || cat.includes('Dentista') || cat.includes('Farmácia')) group = 'Saúde';
          else if (cat.includes('Salário') || cat.includes('Receita') || cat.includes('Dividendo')) group = 'Receitas';
          else if (cat.includes('Presente')) group = 'Presentes';
          else if (cat.includes('Seguro') || cat.includes('Juros')) group = 'Financeiro';
          else if (cat.includes('Consultora') || cat.includes('Arrumação') || cat.includes('Costureira')) group = 'Extra';
          else if (cat.includes('Entidade')) group = 'Profissional';
          else group = 'Essencial';
      }

      return {
        ...t,
        id: `trans_${Date.now()}_${idx}`,
        category: t.category, 
        type: group
      };
    });

    return {
      detectedClientName: parsed.detectedClientName,
      personalData: parsed.personalData,
      transactions: processedTransactions,
      assets: parsed.assets || []
    };

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};