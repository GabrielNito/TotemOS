import { z } from "zod"

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .url(
      "A variável NEXT_PUBLIC_API_URL deve ser uma URL válida (ex: http://localhost:3001)"
    )
    .default("http://localhost:3001"),
})

function validateEnv() {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  })

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n")
    console.error(
      `[TotemOS] Erro de configuração de ambiente:\n${errorDetails}`
    )
    throw new Error(
      `[TotemOS] Variáveis de ambiente inválidas:\n${errorDetails}`
    )
  }

  return parsed.data
}

export const env = validateEnv()
