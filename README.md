# SGRC

Repositório inicial do SGRC.

## Decisões aprovadas

- Supabase será a plataforma de dados do sistema.
- Vercel será a plataforma de publicação da aplicação web.

## Escopo atual

O sistema de gestão comercial ainda não foi implementado. A aplicação web foi iniciada com Next.js e TypeScript, integrada ao Supabase Auth. As regras aprovadas serão aplicadas conforme cada módulo de negócio for implementado.

## Supabase

A configuração local e as migrations do banco ficam em `supabase/`. O primeiro schema contém apenas perfis de acesso e papéis; não inclui dados ou fluxos comerciais.

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

No projeto Vercel, abra **Settings → Environment Variables** e configure estas variáveis para os ambientes necessários (Development, Preview e Production):

- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave publishable do Supabase.

Para puxar as variáveis de Development para o ambiente local, autentique e vincule a CLI da Vercel ao projeto uma vez:

```powershell
npx vercel login
npx vercel link
npx vercel env pull .env.local
```

O comando `env pull` atualiza `.env.local` com as variáveis da Vercel. Para usar outro ambiente, informe `--environment=preview` ou `--environment=production`. Não faça commit de `.env.local` nem coloque chaves secretas em variáveis `NEXT_PUBLIC_*`; somente a chave publishable é apropriada para o frontend. Após alterar variáveis na Vercel, faça novo deploy para que a publicação utilize os valores atualizados.

### Autenticação e acessos

O acesso usa Supabase Auth com sessão em cookies seguros compatíveis com SSR. O cadastro público e o login anônimo estão desabilitados na configuração local e não há fluxo de cadastro na aplicação. Em projeto hospedado, confirme também que novos cadastros por e-mail e acessos anônimos estão desabilitados nas configurações de Auth. Nesta etapa inicial, um administrador cria a conta pelo painel Auth do Supabase e atribui o papel correspondente em `public.user_roles`. O fluxo de convite por e-mail ainda não foi implementado. O usuário só consegue consultar seu próprio perfil e papéis por RLS.

A aplicação usa somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A chave `service_role` é secreta e nunca deve ser exposta no frontend ou adicionada ao Git. O proxy valida a sessão e protege as rotas; cada módulo futuro deverá também aplicar autorização no servidor e políticas RLS próprias. O painel inicial apenas confirma a autenticação e exibe os papéis atribuídos; ainda não implementa permissões ou fluxos comerciais. A exigência de MFA para perfis privilegiados, prevista no escopo, ainda precisa ser implementada antes de disponibilizar dados ou operações reais.

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
