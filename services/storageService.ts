import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';

export const uploadStatement = async (
  file: File, 
  userId: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; path?: string; url?: string; error?: string }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
        throw new Error("Usuário não autenticado.");
    }

    // Cria um caminho único para o arquivo: user_id/timestamp_filename
    // Sanitiza o nome do arquivo para evitar caracteres problemáticos na URL
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${userId}/${Date.now()}_${sanitizedFileName}`;

    // Usamos XMLHttpRequest para ter acesso ao evento de progresso
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const url = `${SUPABASE_URL}/storage/v1/object/uploads/${fileName}`;

        xhr.open('POST', url);
        
        // Headers necessários para o Supabase Storage
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
        xhr.setRequestHeader('x-upsert', 'false'); // 'true' se quiser sobrescrever
        // O Content-Type é importante para que o navegador não envie multipart/form-data incorreto
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        // Monitora o progresso
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Sucesso
                const { data: publicUrlData } = supabase.storage
                    .from('uploads')
                    .getPublicUrl(fileName);
                
                resolve({ 
                    success: true, 
                    path: fileName, // O path retornado pela API pode ser diferente, mas aqui construímos o nosso
                    url: publicUrlData.publicUrl 
                });
            } else {
                // Erro da API
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve({ success: false, error: response.message || 'Erro no upload' });
                } catch (e) {
                    resolve({ success: false, error: xhr.statusText });
                }
            }
        };

        xhr.onerror = () => {
            resolve({ success: false, error: 'Erro de rede durante o upload.' });
        };

        // Envia o arquivo cru (binary)
        xhr.send(file);
    });

  } catch (error: any) {
    console.error('Erro no upload:', error);
    return { success: false, error: error.message };
  }
};