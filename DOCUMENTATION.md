# Documentação Técnica e Manual do Usuário - FinPlanner

O **FinPlanner** é uma plataforma avançada de consultoria financeira pessoal que utiliza Inteligência Artificial para automatizar a extração de dados de documentos bancários e gerar planejamentos financeiros precisos e personalizados.

---

## 🏗 Arquitetura do Sistema

- **Frontend:** React + Vite + Tailwind CSS
- **Ícones:** Lucide-React
- **Gráficos:** Recharts
- **Banco de Dados (BaaS):** Supabase (PostgreSQL)
- **Extração de Dados:** 
    - **OpenRouter (AI):** Acesso a modelos como GPT-4o e Claude para análise semântica.
    - **PDF.js:** Leitura de texto de arquivos digitais.
    - **Tesseract.js (OCR):** Reconhecimento de texto em arquivos escaneados ou de baixa qualidade.

---

## 🗄 Estrutura de Dados e Relacionamentos

Os dados são organizados em torno da entidade **Cliente**:

1.  **Clientes (`clients`):** Cada consultor gerencia sua própria lista de clientes.
2.  **Perfis (`profiles`):** Relacionamento de 1 para 1 com o Cliente. Contém dados pessoais, profissionais, endereço e detalhes de receita (para cálculo de IR).
3.  **Transações (`transactions`):** Relacionamento de 1 para N com o Cliente. Registra todas as entradas e saídas extraídas de extratos ou faturas.
4.  **Ativos (`assets`):** Relacionamento de 1 para N com o Cliente. Representa o portfólio de investimentos em um dado momento.
5.  **Categorias Globais (`global_categories`):** Tabela compartilhada que permite ao consultor criar categorias personalizadas que valem para todo o sistema.

---

## 📄 Guia de Páginas e Funcionalidades

### 🏠 1. Resumo Pessoal
Exibe o "raio-x" do cliente.
- **Funcionalidades:** Edição de dados pessoais, endereço e informações profissionais.
- **Relacionamento:** Os dados de receita (Salário, INSS, IRRF) alimentam a Calculadora PGBL. Os dependentes impactam a base de cálculo do IR.

### 📊 2. Orçamento
Define as metas mensais de gastos por grupo de categoria.
- **Funcionalidades:** Gráfico de "Meta vs Realizado". Permite ao consultor definir quanto o cliente *deveria* gastar em cada área (Essencial, Social, etc.).
- **Relacionamento:** As metas são comparadas com os gastos reais vindos da aba de Movimentações.

### 💸 3. Movimentações
O "Livro Caixa" do sistema.
- **Funcionalidades:** Lista filtrável de transações. Permite edição manual de categorias, descrição e valor. Possui botão para "Novo Lançamento Manual".
- **Relacionamento:** Alimenta o Orçamento e o Fluxo Financeiro.

### 🏛 4. Balanço Patrimonial
Visão consolidada do patrimônio líquido.
- **Funcionalidades:** Gráfico de Alocação de Ativos e lista resumida de tipos de ativos vs passivos (Dívidas).
- **Relacionamento:** Calcula o Patrimônio Líquido usado na Simulação de Independência Financeira.

### ⚖️ 5. Calculadora PGBL
Ferramenta de planejamento tributário.
- **Funcionalidades:** Compara o modelo Simplificado vs Completo de IR. Recomenda o aporte exato em PGBL (até 12% da renda bruta) para gerar economia fiscal.
- **Relacionamento:** Usa os dados de receita salvos na Aba 1.

### 📈 6. Investimentos
Detalhamento da carteira de ativos.
- **Funcionalidades:** Tabela detalhada de ativos com edição e exclusão. Filtros por Tipo (Ação, FII, Renda Fixa, etc.) e Instituição.
- **Relacionamento:** Alimenta o Balanço Patrimonial.

### 🚀 7 & 8. Simulação (Resumo e Detalhada)
Projeção de futuro baseada em juros compostos.
- **Funcionalidades:** Define aportes mensais, taxa de juros e meta de aposentadoria. Exibe quando o cliente atingirá a independência financeira.
- **Relacionamento:** Usa o patrimônio atual como ponto de partida.

### ⏳ 9. Perpetuidade (Decumulação)
Calcula a fase de usufruto do patrimônio.
- **Funcionalidades:** Determina quanto tempo o dinheiro dura baseado em retiradas mensais e rentabilidade.

### 🔮 10. Projeção de Cenários
Visualização gráfica de diferentes taxas de juros e aportes ao longo do tempo.

### ⚙️ 11. Categorias
Painel de administração.
- **Funcionalidades:** Criar novas categorias ou excluir categorias customizadas.
- **Relacionamento:** Alimenta os dropdowns de categorização na aba de Movimentações.

### ☁️ 12. Upload / IA (Coração do Sistema)
Onde os dados entram no FinPlanner.
- **Funcionalidades:** Seleção de modelos de IA (GPT-4o Mini, Claude, etc.), campo de instruções personalizadas (Contexto) e fila de processamento.
- **OCR:** Se o sistema detecta um PDF de baixa qualidade, ele automaticamente processa via OCR para extrair os dados.
- **Relacionamento:** Cria transações, ativos e preenche o perfil do cliente automaticamente.

### 👥 13. Clientes
Gestão da carteira do consultor.
- **Funcionalidades:** Adicionar novos clientes ou acessar dados de um cliente existente.

### 🔄 14. Fluxo Financeiro
Visão mensal consolidada (Janeiro a Dezembro).
- **Funcionalidades:** Compara Entradas vs Saídas reais de cada mês. Permite "Ajustes Manuais" para meses que não tiveram extratos carregados.

---

## 📋 Passo a Passo de Uso

1.  **Acesso:** Faça login na plataforma com seu e-mail de consultor.
2.  **Seleção:** Na Aba 13 (Clientes), selecione o cliente que deseja atender ou crie um novo.
3.  **Coleta de Dados:** Vá na Aba 12 (Upload / IA), arraste as faturas e extratos do cliente. Clique em **Processar Todos**.
4.  **Auditoria:** Verifique na Aba 3 (Movimentações) se as categorias estão corretas. Ajuste o que for necessário.
5.  **Planejamento:** 
    - Vá na Aba 1 para conferir se a Receita Anual está correta.
    - Use a Aba 5 (PGBL) para mostrar ao cliente quanto ele pode economizar de imposto.
    - Use as Abas 7, 8 e 9 para traçar a rota da independência financeira.
6.  **Entrega:** Clique no botão **Relatório** (Topo direito) e selecione o que deseja imprimir para o cliente. O sistema gera um PDF profissional pronto para entrega.

---
*FinPlanner - Inteligência Artificial a serviço do Planejamento Financeiro.*
