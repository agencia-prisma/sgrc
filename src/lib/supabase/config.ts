export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase não está configurado. Copie .env.example para .env.local e informe a URL do projeto e a chave publishable.",
    );
  }

  return { url, publishableKey };
}
