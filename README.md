# SGRC

Repositório inicial do SGRC.

## Decisões aprovadas

- Supabase será a plataforma de dados do sistema.
- Vercel será a plataforma de publicação da aplicação web.

## Escopo atual

A aplicação web usa Next.js e TypeScript com autenticação pelo Supabase Auth. O sistema inclui gestão de equipe e territórios e o primeiro módulo de CRM para leads e clientes.

## Supabase

A configuração local e as migrations do banco ficam em `supabase/`. O schema inclui perfis, papéis, equipe comercial e territórios.

### Desenvolvimento local

Pré-requisitos: Node.js, Docker em execução e Supabase CLI. Com Docker aberto, inicie o Supabase local e aplique as migrations:

```powershell
supabase start
supabase db reset
```

`db reset` recria o banco local e aplica todas as migrations. Para usar o Supabase local, copie `.env.example` para `.env.local` e preencha a URL e a chave publishable apresentados por `supabase status`. Para desenvolvimento com o projeto hospedado, siga a seção de Vercel abaixo para puxar as variáveis para `.env.local`.

Instale as dependências e execute a aplicação:

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

### Publicação na Vercel

O arquivo `.env.example` **não é substituído**: ele é apenas um modelo versionado com nomes e valores de exemplo. O arquivo `.env.local` é local, ignorado pelo Git, e pode receber as variáveis do projeto Vercel para desenvolvimento. No deploy, a própria Vercel injeta as variáveis configuradas no projeto; a aplicação não busca variáveis remotamente em tempo de execução.

No projeto Vercel, abra **Settings → Environment Variables** e configure as variáveis públicas nos ambientes que usam o Supabase correspondente:

- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave publishable do Supabase.
- `NEXT_PUBLIC_APP_URL`: URL pública da aplicação, por exemplo `https://sgrc-gustavo-prisma.vercel.app`. Configure o domínio correto por ambiente.
- `SUPABASE_SERVICE_ROLE_KEY`: chave secreta de servidor usada para convites; configure somente no ambiente de produção ou junto de um Supabase isolado. Não a configure em Preview que aponte para produção. Nunca use prefixo `NEXT_PUBLIC_`, exponha no browser ou compartilhe essa chave.
- `RESEND_API_KEY`: chave secreta do Resend usada para e-mails de decisão de pedidos. Configure somente no ambiente de produção ou junto de um Supabase isolado; nunca use prefixo `NEXT_PUBLIC_`.
- `RESEND_FROM_EMAIL`: endereço remetente verificado no Resend, por exemplo `SGRC <pedidos@seudominio.com>`.

Deploys Vercel em Preview e Development não podem gravar territórios nem enviar convites. Isso evita que uma visualização de teste altere dados do Supabase de produção. Localmente, sem a chave de serviço, a página de equipe continua permitindo consulta e cadastro de territórios via RLS; o envio de convites fica desabilitado.

Para puxar as variáveis de Development para o ambiente local, autentique e vincule a CLI da Vercel ao projeto uma vez:

```powershell
npx vercel login
npx vercel link
npx vercel env pull .env.local
```

O comando `env pull` atualiza `.env.local` com as variáveis da Vercel. Para usar outro ambiente, informe `--environment=preview` ou `--environment=production`. Não faça commit de `.env.local` nem coloque chaves secretas em variáveis `NEXT_PUBLIC_*`; somente a chave publishable é apropriada para o frontend. Após alterar variáveis na Vercel, faça novo deploy para que a publicação utilize os valores atualizados.

### Autenticação e acessos

O acesso usa Supabase Auth com sessão em cookies seguros compatíveis com SSR. O cadastro público (`auth.enable_signup`) e o login anônimo estão desabilitados na configuração local e não há cadastro público na aplicação. O provedor de e-mail/senha permanece habilitado para que contas provisionadas possam entrar localmente. Em projeto hospedado, confirme também que novos cadastros por e-mail e acessos anônimos estão desabilitados nas configurações de Auth. Administradores podem convidar representantes e divulgadores pela tela de equipe; demais contas e papéis ainda são provisionados pelo painel administrativo do Supabase.

No módulo comercial, super administradores e diretores podem consultar e manter equipe e territórios; gerentes de vendas podem consultar sua equipe direta; representantes e divulgadores podem consultar apenas os próprios registros e territórios atribuídos. As tabelas aplicam essas regras com RLS. A tela **Equipe e territórios** permite criar territórios hierárquicos e convidar representantes/divulgadores com gerente e territórios opcionais. O convite e a atribuição de papel são executados no servidor; a `service_role` não é exposta ao navegador. Contas já existentes no Auth ainda exigem um fluxo próprio de associação. Cadastros comerciais devem apontar para perfis autenticados e com o papel correspondente.

O módulo **Leads e clientes** mantém empresas/lojas e pessoas físicas como cadastros independentes. Cada registro pode ter CPF ou CNPJ validado (incluindo CNPJ alfanumérico), dados de contato, território, responsável, observações e etapa comercial: novo, em contato, qualificado, convertido ou perdido. A carteira oferece busca por nome e filtros por tipo e etapa; cada cadastro tem edição e histórico de contatos (anotação, ligação, e-mail, reunião, WhatsApp ou outro). Administradores/diretores acessam todos os registros; gerentes acessam os próprios e os de sua equipe direta; representantes/divulgadores acessam os próprios. O território escolhido precisa estar atribuído ao responsável. A migration `20261011230000_crm_leads_and_customers.sql` cria as tabelas, restrições e políticas RLS do CRM.

O **Catálogo de produtos** mantém SKU, nome, preço em reais e situação ativa/inativa. Todos os perfis comerciais podem consultar os produtos; somente super administradores e diretores podem cadastrar, editar, ativar ou inativar itens. SKUs são únicos e normalizados em maiúsculas; produtos não são apagados para preservar referências futuras em pedidos. A migration `20261011233000_product_catalog.sql` cria a tabela, índice e políticas RLS.

O módulo **Usuários e acessos** é restrito a super administradores. Permite convidar usuários por e-mail, consultar contas e atribuir ou remover papéis de acesso. A remoção do último super administrador é bloqueada; alterações de representantes e divulgadores mantêm sincronizado o cadastro da equipe comercial. Convites e alterações de papéis exigem `SUPABASE_SERVICE_ROLE_KEY` somente no servidor. A migration `20261012180600_system_user_role_management.sql` cria as funções protegidas usadas para manter os papéis e os vínculos comerciais.

O módulo **Pedidos** permite que perfis comerciais criem rascunhos vinculados a clientes visíveis no CRM e a produtos ativos. Cada item preserva SKU, nome e preço no momento em que o pedido é salvo; o total é calculado no servidor. O responsável pode editar o rascunho e enviá-lo para aprovação. Gerentes aprovam pedidos da equipe direta; super administradores e diretores podem aprovar qualquer pedido, exceto os próprios. A rejeição exige um motivo, e o responsável pode corrigir o pedido rejeitado e reenviá-lo. Ao aprovar ou rejeitar, o responsável recebe uma notificação persistente na navegação do sistema e um e-mail pelo Resend. Configure `RESEND_API_KEY` e `RESEND_FROM_EMAIL` no servidor; a decisão permanece registrada mesmo se o envio de e-mail falhar, e a aplicação informa essa falha. As migrations `20261011234000_sales_orders.sql` e `20261012174100_sales_order_notifications.sql` criam as tabelas, funções transacionais e políticas RLS; revise e valide-as em desenvolvimento/homologação antes de aplicar no projeto hospedado.

O módulo **Financeiro e carteira protegida** permite que Financeiro ou super administradores, com MFA, registrem manualmente a nota fiscal e os pagamentos de pedidos aprovados. A proteção de seis meses começa quando o pedido está faturado e integralmente pago, vinculada ao responsável CRM do cliente na data da quitação; uma nova compra válida renova o prazo. Durante a vigência, o responsável não pode ser alterado diretamente. A solicitação de transferência deve indicar outro representante ativo elegível para o território e passa pelo gerente direto e por um diretor/super administrador independente; rejeições exigem justificativa. O gerente direto pode iniciar a solicitação em nome do responsável, registrando a etapa gerencial antes de encaminhá-la à diretoria. Os lançamentos financeiros guardam origem e identificador externo para futura integração com ERP, mas nesta etapa a interface aceita somente lançamentos manuais. A migration `20261012192100_protected_customer_portfolio.sql` cria os eventos financeiros, vigências, histórico, regras de transferência e políticas RLS; valide-a em desenvolvimento/homologação antes de aplicar no projeto hospedado.

A cliente de navegador usa somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A chave `service_role` é secreta e nunca deve ser exposta no frontend ou adicionada ao Git. O proxy valida a sessão e protege as rotas; cada módulo aplica autorização no servidor e políticas RLS. O painel inicial é uma central de navegação para gestão da equipe, territórios, CRM, catálogo de produtos e pedidos.

Contas com papel de super administrador, diretoria, gerente de vendas ou financeiro precisam configurar TOTP ao entrar. O painel exige nível de garantia AAL2, as APIs administrativas recusam operações privilegiadas sem essa confirmação e políticas RLS aplicam a mesma regra aos dados. A migration `20261012184500_privileged_mfa_assurance.sql` implementa a barreira no banco; aplique-a em desenvolvimento/homologação e valide o fluxo antes de publicar no Supabase hospedado. A tela de autenticação oferece encerramento global das sessões. O processo operacional de recuperação de conta quando o usuário perde o autenticador ainda precisa ser definido antes do uso em produção.

Na tela de login, use **Ainda não definiu ou esqueceu sua senha?** para solicitar um link de definição de senha por e-mail. No Supabase, inclua a URL `https://<dominio-da-aplicacao>/auth/callback` na lista de URLs permitidas em **Authentication → URL Configuration → Redirect URLs**. O link retorna à aplicação e permite definir a senha; não compartilhe esse link.

Para o primeiro administrador, crie a conta pelo painel Auth do Supabase e, em seguida, atribua o papel usando o SQL Editor administrativo, substituindo o e-mail:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE email = 'admin@exemplo.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

Execute essa atribuição somente no painel administrativo confiável. Não conceda ao navegador permissões de escrita em papéis.

Para vincular este repositório a um projeto hospedado, use `supabase link --project-ref <project-ref>` e revise as migrations antes de publicá-las com `supabase db push`. Não aplique migrations em produção sem validar a estrutura e as regras de acesso no ambiente de desenvolvimento/homologação.
