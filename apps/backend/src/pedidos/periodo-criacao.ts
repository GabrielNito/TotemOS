import { Temporal } from '@js-temporal/polyfill';

// O primeiro instante do dia civil pode ser 01h em transições históricas.
// Cada limite é convertido separadamente, sem somar 24h ou fixar UTC-3.
export function inicioDiaSaoPaulo(dia: string): Date {
  return new Date(
    Temporal.PlainDate.from(dia).toZonedDateTime('America/Sao_Paulo')
      .epochMilliseconds,
  );
}
