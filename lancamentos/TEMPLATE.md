# Ficha de lançamento — [nome da feature]

> Copie este arquivo para `lancamentos/<nome-da-feature>.md` e preencha as seções
> "Antes de lançar" **antes** do lançamento. As seções "Depois" fecham o ciclo.

## Identificação

- **Feature:**
- **Data de lançamento:**
- **Responsável:**
- **Oportunidade de origem:** (link para a etapa do processo / doc de discovery)

## Antes de lançar

### Hipótese

> Acreditamos que **[mudança]** vai causar **[efeito]** em **[público]**, porque **[razão]**.

### Métrica primária de sucesso

Uma só. Se tem duas, você ainda não decidiu o que é sucesso.

- **Métrica:**
- **Baseline (valor antes do lançamento):**
- **Meta:**
- **Prazo para atingir a meta:**

### Guardrails

O que não pode piorar por causa desse lançamento.

| Métrica | Valor atual | Limite aceitável |
|---------|-------------|------------------|
|         |             |                  |

### Fonte de dados

Como a métrica é calculada, concretamente — query no BigQuery, evento de analytics,
planilha. Se não dá para escrever esta seção, a métrica não é mensurável ainda:
resolva isso antes de lançar.

```sql
-- query ou descrição da medição
```

### Datas de revisão

- [ ] 30 dias: __/__/____
- [ ] 60 dias: __/__/____
- [ ] 90 dias: __/__/____

## Depois

### Resultado

Valores observados nas datas de revisão, comparados com baseline e meta.

### Veredito

**Sucesso / Fracasso / Inconclusivo** — e por quê.

### Aprendizado

O que isso muda na próxima decisão de produto. É a única seção que sobrevive
ao lançamento — escreva para quem vai ler daqui a um ano.
