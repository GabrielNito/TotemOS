# TotemOS Dashboard

Aplicação web administrativa em Next.js e shadcn/ui. A [spec](../../docs/dashboard-SPEC.md) descreve o que cada rota entrega. Consulte [AGENTS.md](AGENTS.md) e [DESIGN.md](DESIGN.md) antes de alterar a aplicação.

## Desenvolvimento local

Suba o [backend](../backend/README.md) e execute os comandos em `apps/dashboard`.

```bash
bun install
bun run dev
```

O Dashboard usa a porta 3000 por padrão e consulta `http://localhost:3001`. Para outro backend, configure `NEXT_PUBLIC_API_URL` no ambiente do Next.js.

## Validação

```bash
bun run lint
bun run typecheck
bun test
bun run build
```

Os testes de UI usam happy-dom e React act no Bun. A [CI](../../.github/workflows/ci.yml) roda os mesmos comandos.
