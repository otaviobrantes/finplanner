import Tesseract from 'tesseract.js';

// Declaração para o TypeScript entender o objeto global do PDF.js
declare const window: any;

/**
 * Lê o conteúdo de texto de um arquivo (PDF, CSV, OFX, TXT)
 * Com suporte a OCR aprimorado para PDFs de baixa qualidade
 */
export const parseFileContent = async (file: File): Promise<string> => {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  try {
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return await readPdfContent(file);
    } else {
      return await readTextContent(file);
    }
  } catch (error) {
    console.error("Erro ao ler arquivo:", error);
    throw new Error("Falha ao extrair texto do arquivo. Verifique se não está corrompido.");
  }
};

/**
 * Extrai texto de um arquivo PDF página por página
 * Se o PDF não tiver texto extraível, usa OCR com pré-processamento
 */
const readPdfContent = async (file: File): Promise<string> => {
  const pdfjsLib = window.pdfjsLib;

  if (!pdfjsLib) {
    throw new Error("Biblioteca PDF.js não carregada.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let fullText = '';
  let totalTextLength = 0;

  console.log(`[FileParser] PDF tem ${pdf.numPages} páginas.`);

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    // Primeira tentativa: extrair texto diretamente
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    // Agrupa itens por linha (Y coordinate) com tolerância
    const lines: { [key: number]: any[] } = {};
    const yTolerance = 2;

    items.forEach((item: any) => {
      const y = Math.round(item.transform[5] / yTolerance) * yTolerance;
      if (!lines[y]) lines[y] = [];
      lines[y].push(item);
    });

    // Ordena linhas de cima para baixo
    const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);

    let pageText = sortedY.map(y => {
      return lines[y]
        .sort((a: any, b: any) => a.transform[4] - b.transform[4])
        .map((item: any) => item.str)
        .join(' ');
    }).join('\n');

    // Conta caracteres úteis (não apenas espaços)
    const usefulChars = pageText.replace(/\s/g, '').length;
    totalTextLength += usefulChars;

    // Se a página tem pouco texto (< 100 chars), tenta OCR com alta qualidade
    if (usefulChars < 100) {
      console.log(`[FileParser] Página ${i}: Pouco texto (${usefulChars} chars). Aplicando OCR de alta qualidade...`);
      try {
        pageText = await performHighQualityOcr(page);
        console.log(`[FileParser] Página ${i}: OCR extraiu ${pageText.length} caracteres.`);
      } catch (ocrError) {
        console.warn(`[FileParser] Página ${i}: OCR falhou.`, ocrError);
      }
    } else {
      console.log(`[FileParser] Página ${i}: Extraído ${usefulChars} caracteres via texto.`);
    }

    fullText += `\n--- PÁGINA ${i} ---\n${pageText}`;
  }

  // Se após processar todas as páginas ainda temos pouco texto, alerta
  if (totalTextLength < 100) {
    console.warn(`[FileParser] Alerta: PDF pode estar em formato de imagem. Total de texto extraído: ${totalTextLength} chars.`);
  }

  return fullText;
};

/**
 * Renderiza uma página do PDF em alta resolução e aplica OCR
 * Inclui pré-processamento para melhorar reconhecimento em PDFs de baixa qualidade
 */
const performHighQualityOcr = async (page: any): Promise<string> => {
  // ESCALA ALTA para melhor OCR em PDFs de baixa qualidade
  const scale = 4.0;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Não foi possível criar contexto do canvas.');
  }

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  // Renderiza a página
  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  // PRÉ-PROCESSAMENTO: Aumentar contraste e binarizar para melhor OCR
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Converter para escala de cinza e aumentar contraste
  for (let i = 0; i < data.length; i += 4) {
    // Converter para grayscale
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

    // Aumentar contraste (estender o range de cores)
    const contrast = 1.5; // Fator de contraste
    const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
    let newGray = factor * (gray - 128) + 128;

    // Clamp entre 0 e 255
    newGray = Math.max(0, Math.min(255, newGray));

    // Binarização suave (limiar adaptativo)
    const threshold = 180;
    const finalValue = newGray > threshold ? 255 : newGray < 80 ? 0 : newGray;

    data[i] = finalValue;     // R
    data[i + 1] = finalValue; // G
    data[i + 2] = finalValue; // B
    // Alpha permanece inalterado
  }

  context.putImageData(imageData, 0, 0);

  // Converte canvas para blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Falha ao converter canvas para blob.'));
    }, 'image/png');
  });

  // Aplica OCR usando Tesseract com configurações otimizadas
  const { data: { text } } = await Tesseract.recognize(
    blob,
    'por+eng', // Português + Inglês para nomes de empresas
    {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Progresso: ${Math.round(m.progress * 100)}%`);
        }
      }
    }
  );

  // Limpa o canvas da memória
  canvas.remove();

  // Pós-processamento: limpar caracteres estranhos comuns em OCR
  const cleanedText = text
    .replace(/[|¦]/g, 'I') // Pipes comuns de erro
    .replace(/[`´]/g, "'") // Acentos incorretos
    .replace(/\s{3,}/g, '  ') // Múltiplos espaços
    .replace(/\n{3,}/g, '\n\n'); // Múltiplas linhas vazias

  return cleanedText;
};

/**
 * Lê arquivos de texto simples (CSV, OFX, TXT)
 */
const readTextContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      resolve(event.target?.result as string || '');
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsText(file);
  });
};