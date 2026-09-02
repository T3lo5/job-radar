import type { AIClient, AIMessage } from './types.js'

export interface JobAnalysis {
  score: number
  nivel_aderencia: 'Muito alta' | 'Alta' | 'Média' | 'Baixa' | 'Muito baixa'
  prioridade: 'alta' | 'media' | 'baixa'
  pontos_fortes: string[]
  requisitos_faltantes: string[]
  riscos: string[]
  modalidade: 'remoto' | 'hibrido' | 'presencial' | 'nao_informado'
  senioridade: 'junior' | 'pleno' | 'senior' | 'lead' | 'manager' | 'nao_informado'
  tecnologias_match: string[]
  resumo_vaga: string
  recomendacao: 'Candidatar' | 'Avaliar' | 'Ignorar'
}

export class JobAnalyzer {
  private readonly ai: AIClient

  constructor(ai: AIClient) {
    this.ai = ai
  }

  async analyze(
    jobTitle: string,
    jobDescription: string,
    profileSkills: string[],
    _profileSummary?: string,
    jobTypes?: string[],
    focusStacks?: string[],
    discardTerms?: string[],
  ): Promise<JobAnalysis> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `Você é um **recrutador técnico sênior especializado em tecnologia**, responsável por avaliar a aderência entre uma vaga de emprego e o perfil profissional do candidato.

Seu objetivo é analisar **realisticamente** o quanto essa vaga é adequada para o candidato, considerando cargo, tecnologias, nível de experiência, modalidade de trabalho e requisitos.

## REGRAS IMPORTANTES

Não dê uma nota alta simplesmente porque a descrição contém várias palavras-chave.

Avalie a **compatibilidade real da vaga**.

Uma vaga pode ter muitas tecnologias compatíveis e ainda assim receber score baixo se exigir:

* Senioridade muito acima
* Liderança de equipe
* Experiência muito específica
* Presencialidade incompatível
* Tecnologias principais completamente diferentes

Também não penalize demais uma vaga por exigir algumas tecnologias que o candidato não possui quando a stack principal é compatível.

## COMO CALCULAR O SCORE

Dê uma nota de **0 a 100**.

### 1. Compatibilidade do cargo — até 25 pontos
* Cargo compatível com o perfil: alta pontuação
* Cargo parcialmente relacionado: pontuação intermediária
* Cargo claramente fora da área: baixa pontuação

### 2. Compatibilidade tecnológica — até 35 pontos
Quanto maior a quantidade de tecnologias relevantes em comum, maior a pontuação.
Não penalize excessivamente tecnologias que o candidato ainda não domina se a maior parte da stack for compatível.

### 3. Nível de experiência — até 15 pontos
* Júnior / Jr: excelente compatibilidade
* Pleno: boa compatibilidade se os requisitos forem razoáveis
* Senior: reduzir a pontuação
* Lead / Manager / Staff: grande redução

### 4. Modalidade e localização — até 15 pontos
* Remoto: melhor cenário
* Híbrido: compatibilidade intermediária
* Presencial: penalizar

### 5. Requisitos obrigatórios — até 10 pontos
Analise se existem requisitos obrigatórios que o candidato claramente não possui.
Diferencie: requisito obrigatório eliminatório vs tecnologia desejável vs diferencial.

## CLASSIFICAÇÃO

* **90-100:** Excelente oportunidade — forte aderência
* **80-89:** Muito boa oportunidade — vale priorizar
* **70-79:** Boa oportunidade — vale analisar/candidatar
* **60-69:** Compatibilidade moderada — avaliar caso a caso
* **40-59:** Baixa aderência
* **0-39:** Não recomendada

## RESPOSTA

Responda **EXCLUSIVAMENTE em JSON válido**, sem markdown, sem \`\`\` e sem qualquer texto antes ou depois.

Use exatamente esta estrutura:

{
  "score": 85,
  "nivel_aderencia": "Muito alta",
  "prioridade": "alta",
  "pontos_fortes": ["React e TypeScript são utilizados", "Cargo compatível com Full Stack", "Trabalho remoto"],
  "requisitos_faltantes": ["Experiência com AWS", "Conhecimento de NestJS"],
  "riscos": ["A vaga solicita 3 anos de experiência"],
  "modalidade": "remoto",
  "senioridade": "junior/pleno",
  "tecnologias_match": ["React", "TypeScript", "Node.js", "Docker"],
  "resumo_vaga": "Vaga de Full Stack com forte aderência ao perfil, principalmente pela utilização de React, TypeScript e Node.js.",
  "recomendacao": "Candidatar"
}

### Valores permitidos

"nivel_aderencia": "Muito alta" | "Alta" | "Média" | "Baixa" | "Muito baixa"
"prioridade": "alta" | "media" | "baixa"
"recomendacao": "Candidatar" | "Avaliar" | "Ignorar"
"modalidade": "remoto" | "hibrido" | "presencial" | "nao_informado"
"senioridade": "junior" | "pleno" | "senior" | "lead" | "manager" | "nao_informado"`,
      },
      {
        role: 'user',
        content: `## PERFIL DO CANDIDATO

**Área principal:** ${jobTypes?.join(', ') ?? 'Desenvolvedor'}

**Tecnologias principais:**
${profileSkills.map((s) => `* ${s}`).join('\n')}

**Stacks de foco:**
${focusStacks?.map((s) => `* ${s}`).join('\n') ?? 'Não especificado'}

**Objetivo profissional:**
${jobTypes?.map((j) => `* Vagas ${j}`).join('\n') ?? 'Não especificado'}

**Modalidade preferida:**
* Remoto
* Vagas híbridas podem ser consideradas
* Vagas presenciais devem receber penalização no score

**Nível desejado:**
* Júnior / Pleno compatível com experiência
* Evitar vagas claramente Senior/Lead/Manager

---

## DADOS DA VAGA

Vaga: ${jobTitle}

Descrição:
${jobDescription.slice(0, 2000)}

---

## TERMOS DE DESCARTE
${discardTerms?.map((t) => `* ${t}`).join('\n') ?? 'Não especificado'}

Se a vaga contiver algum destes termos no título, avalie com cuidado e considere reduzir o score significativamente.`,
      },
    ]

    const response = await this.ai.chat(messages, { temperature: 0.3, maxTokens: 2000 })

    try {
      return JSON.parse(response.content) as JobAnalysis
    } catch {
      throw new Error(`Failed to parse job analysis: ${response.content.slice(0, 200)}`)
    }
  }
}
