/** Only deployment configuration can enable DEMO; never consult request data. */
export function demoEnvironmentFor(
  negocioId: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (
    !['development', 'test'].includes(env.NODE_ENV ?? '') ||
    !['demo', 'test'].includes(env.TOTEMOS_ENV ?? '') ||
    env.VERCEL_ENV === 'production' ||
    env.DEPLOYMENT_ENV === 'production' ||
    env.DEMO_ENABLED !== 'true' ||
    env.DEMO_DATABASE_ISOLATED !== 'true' ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(env.DEMO_ENVIRONMENT_ID ?? '') ||
    !env.DEMO_TENANT_IDS?.split(',')
      .map((id) => id.trim())
      .includes(negocioId)
  )
    return null;
  return env.DEMO_ENVIRONMENT_ID!;
}
