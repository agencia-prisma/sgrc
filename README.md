# SGRC

Repositório inicial do SGRC.

## Decisões aprovadas

- Supabase será a plataforma de dados do sistema.
- Vercel será a plataforma de publicação da aplicação web.

## Escopo atual

A aplicação web usa Next.js e TypeScript com autenticação pelo Supabase Auth. A fundação do primeiro módulo comercial inclui cadastro de representantes/divulgadores, territórios hierárquicos e vínculos de equipe e território no banco; as telas de gestão desse módulo ainda serão implementadas.

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

Deploys Vercel em Preview e Development não podem gravar territórios nem enviar convites. Isso evita que uma visualização de teste altere dados do Supabase de produção. Localmente, sem a chave de serviço, a página de equipe continua permitindo consulta e cadastro de territórios via RLS; o envio de convites fica desabilitado.

Para puxar as variáveis de Development para o ambiente local, autentique e vincule a CLI da Vercel ao projeto uma vez:

```powershell
npx vercel login
npx vercel link
npx vercel env pull .env.local
```

O comando `env pull` atualiza `.env.local` com as variáveis da Vercel. Para usar outro ambiente, informe `--environment=preview` ou `--environment=production`. Não faça commit de `.env.local` nem coloque chaves secretas em variáveis `NEXT_PUBLIC_*`; somente a chave publishable é apropriada para o frontend. Após alterar variáveis na Vercel, faça novo deploy para que a publicação utilize os valores atualizados.

### Autenticação e acessos

O acesso usa Supabase Auth com sessão em cookies seguros compatíveis com SSR. O cadastro público e o login anônimo estão desabilitados na configuração local e não há cadastro público na aplicação. Em projeto hospedado, confirme também que novos cadastros por e-mail e acessos anônimos estão desabilitados nas configurações de Auth. Administradores podem convidar representantes e divulgadores pela tela de equipe; demais contas e papéis ainda são provisionados pelo painel administrativo do Supabase.

No módulo comercial, super administradores e diretores podem consultar e manter equipe e territórios; gerentes de vendas podem consultar seus subordinados diretos; representantes e divulgadores podem consultar apenas os próprios registros e territórios atribuídos. As tabelas aplicam essas regras com RLS. A tela **Gerenciar equipe comercial** permite criar territórios hierárquicos e convidar representantes/divulgadores com gerente e territórios opcionais. O convite e a atribuição de papel são executados no servidor; a `service_role` não é exposta ao navegador. Contas já existentes no Auth ainda exigem um fluxo próprio de associação. Cadastros comerciais devem apontar para perfis autenticados e com o papel correspondente.

A cliente de navegador usa somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A chave `service_role` é secreta e nunca deve ser exposta no frontend ou adicionada ao Git. O proxy valida a sessão e protege as rotas; cada módulo aplica autorização no servidor e políticas RLS. O painel inicial é uma central de navegação e a primeira área implementada permite administrar a equipe comercial e os territórios. A exigência de MFA para perfis privilegiados, prevista no escopo, ainda precisa ser implementada antes de disponibilizar dados ou operações comerciais adicionais.

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
