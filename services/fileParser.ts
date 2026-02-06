// Removidos os imports do pdfjs-dist que causam erro em ambiente ESM sem bundler.
// Utilizamos a versão global injetada via <script> tag no index.html.

// Declaração para o TypeScript entender o objeto global
declare const window: any;

/**
 * Lê o conteúdo de texto de um arquivo (PDF, CSV, OFX, TXT)
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
 * Extrai texto de um arquivo PDF página por página usando a lib global
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

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Agrupa itens por linha (Y coordinate) com uma pequena tolerância
    // O transform[5] no PDF.js representa a coordenada Y
    const items = textContent.items as any[];
    const lines: { [key: number]: any[] } = {};
    const yTolerance = 2; // tolerância em pixels para considerar mesma linha

    items.forEach(item => {
      const y = Math.round(item.transform[5] / yTolerance) * yTolerance;
      if (!lines[y]) lines[y] = [];
      lines[y].push(item);
    });

    // Ordena as linhas (de cima para baixo no PDF o Y cresce, mas dependendo do sistema pode ser invertido)
    // No PDF.js, Y cresce de baixo para cima. Então invertemos para ler topo -> base.
    const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);

    const pageText = sortedY.map(y => {
      // Ordena itens dentro da linha por X (transform[4])
      return lines[y]
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map(item => item.str)
        .join(' ');
    }).join('\n');

    fullText += `\n--- PÁGINA ${i} ---\n${pageText}`;
  }

  return fullText;
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