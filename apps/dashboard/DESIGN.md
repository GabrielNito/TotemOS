# TotemOS Dashboard — Diretrizes de Design & Sistema Visual (DESIGN.md)

Este documento define os princípios estéticos, estrutura espacial, regras de componentes e padrões visuais aplicados a todas as interfaces da Dashboard Web do ecossistema TotemOS.

---

## 1. Princípios Fundamentais de Design

1. **Bento Grid Fluido & Modular**:
   - Layouts organizados em células modulares com pesos visuais equilibrados.
   - Cada card possui autonomia de leitura e hierarquia clara (título sutil, número/valor de destaque, gráfico/micro-dado complementar e rodapé informativo).

2. **Bordas Sutis & Micro-Contrastes (Sem Bordas Pesadas)**:
   - Evitar linhas escuras ou opacas duras. Utilizar bordas com baixa opacidade (`border-border/40` ou `border-black/[0.06]`).
   - Cards com cantos generosamente arredondados: `rounded-2xl` para elementos internos e `rounded-3xl` (24px) para cards principais.
   - Micro-sombras difusas (`shadow-xs` / `shadow-subtle`) combinadas com efeito sutil de blur (`backdrop-blur-xs`).

3. **Fluidez & Interatividade**:
   - Elementos interativos devem reagir ao cursor com transições suaves (`transition-all duration-150` ou `200`).
   - Gráficos possuem acompanhamento contínuo do cursor com feedback de valores e destaque contextual do período selecionado.

---

## 2. Tipografia e Escalas de Texto

- **Família Tipográfica**: Sans-serif moderna e neutra (Geist / Inter / San Francisco).
- **Hierarquia**:
  - **Títulos de Páginas / Headings**: `text-2xl` a `text-3xl font-bold tracking-tight`.
  - **Valores de Métricas (Hero Numbers)**: `text-2xl` ou `text-3xl font-bold tracking-tight text-foreground`.
  - **Subtítulos e Seções**: `text-sm font-semibold text-foreground`.
  - **Labels e Legendas**: `text-xs font-medium text-muted-foreground`.
  - **Micro-dados e Badges**: `text-[10px]` a `text-[11px] font-semibold`.

---

## 3. Paleta de Cores e Tokens

### Tema Claro
- **Background Global**: `oklch(0.995 0 0)` / `bg-muted/25` no container principal.
- **Card Background**: `oklch(1 0 0)` com `border-border/40`.
- **Foreground / Texto**: `oklch(0.145 0 0)` (preto suave profundo).
- **Muted Foreground**: `oklch(0.52 0 0)` (cinza equilibrado para contraste legível).

### Cores de Acento Funcionais
- **Verde / Sucesso**: `emerald-600` (claro) / `emerald-400` (escuro) para faturamento positivo, status online e pedidos entregues.
- **Âmbar / Alerta Operacional**: `amber-600` / `amber-400` para pedidos em preparo, picos de horário e PIN de segurança.
- **Azul / Tecnologia**: `blue-600` / `blue-400` para tempos médios de totem e perfis de administrador.

---

## 4. Padrões de Componentes Específicos

### 1. Gráfico Spline Customizado (`ChartSplineMetric`)
- Curva contínua Bézier SVG com traço encorpado (`strokeWidth="3.5"`).
- Preenchimento gradiente suave sob a linha.
- Marcador circular ativo no ponto focal com linha vertical tracejada até o eixo X.
- Data selecionada no eixo X contida em uma pílula sólida escura (`rounded-full bg-foreground text-background px-2 text-[11px] tabular-nums`).
- Card inferior escuro flutuante (`bg-zinc-900` / `dark:bg-zinc-950`) com donut chart de percentual de meta.

### 2. Gráfico de Barras em Cápsulas (`ChartPillBars`)
- Barras verticais contidas em slots arredondados em formato de pílula (`rounded-full bg-muted/40`).
- Preenchimento dinâmico proporcional ao volume de pedidos por hora.
- Identificação de horários de pico com badges contrastantes.

### 3. Formulários & Input OTP Mascarado
- Campos de texto com altura confortável (`h-11`), cantos arredondados e focus ring discreto.
- Inputs de PIN/Senhas usando `InputOTP` com propriedade `mask={true}`, exibindo o glifo `●` centrado nos slots de tamanho compacto (`size-9.5`).

### 4. Barra de Rolagem Customizada (`.custom-scrollbar`)
- Largura ultrafina (`5px`), trilha 100% transparente e polegar arredondado com opacidade suave.

---

## 5. Regras de Aplicação em Novas Telas

Ao criar ou modificar qualquer nova tela ou módulo na Dashboard:
1. Utilizar sempre a estrutura de **Bento Grid** com espaçamento padronizado `gap-6`.
2. Encapsular blocos de conteúdo em containers `rounded-3xl border border-border/40 bg-card p-6 shadow-xs`.
3. Nunca utilizar bordas pretas sólidas ou cantos retos (sempre `rounded-2xl` ou `rounded-3xl`).
4. Manter badges em formato de pílula (`rounded-full px-2.5 py-0.5 text-[10px] font-semibold`).
