EMPÓRIO PET RH V7

O QUE TEM NESTA VERSÃO
- login do administrador com email e senha salvos no navegador
- proteção por senha na tela de configurações
- cadastro, edição, desligamento e exclusão definitiva de funcionário
- dashboard com métricas e alertas
- busca por CEP via ViaCEP
- máscaras de CPF, RG, telefone, celular e CEP
- foto pela galeria e pela câmera
- upload de documentos para o bucket employee-documents
- documentos para impressão por modelos
- exportação de CSV de funcionários e histórico
- PWA instalável no celular

ONDE SUBIR
1. GITHUB PAGES
Subir: index.html, style.css, app.js, manifest.webmanifest, sw.js, icon-192.png, icon-512.png

2. SUPABASE
Executar: supabase_setup.sql

CONFIGURAÇÃO
1. Abrir o sistema publicado
2. No primeiro acesso, criar email e senha do administrador
3. Entrar no sistema
4. Em Configurações, digitar a senha do administrador para desbloquear
5. Colar Supabase URL e Publishable Key
6. Informar buckets: employee-photos e employee-documents
7. Salvar e testar conexão

IMPORTANTE
- O login desta versão fica salvo no navegador. Para GitHub Pages puro, isso é prático, mas não é o mesmo nível de segurança de um login de servidor com Supabase Auth.
- Para máxima segurança no futuro, a próxima evolução ideal é migrar o login para Supabase Auth.
