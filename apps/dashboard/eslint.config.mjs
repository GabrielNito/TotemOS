import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import tailwind from 'eslint-plugin-tailwindcss';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      tailwindcss: tailwind,
    },
    settings: {
      tailwindcss: {
        callees: ['cn', 'cva', 'clsx'],
        cssConfigPath: './app/globals.css',
      },
    },
    rules: {
      ...tailwind.configs.recommended.rules,
      // Permite classes customizadas do design system / tokens (oklch, radix, shadcn, etc.)
      'tailwindcss/no-custom-classname': 'off',
      // Detecta e sugere correção automática de classes arbitrárias para shorthands nativos (ex: max-w-[420px] -> max-w-105)
      'tailwindcss/no-unnecessary-arbitrary-value': 'warn',
      'tailwindcss/enforces-shorthand': 'warn',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
