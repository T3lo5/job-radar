name: Feature request
description: Uma ideia para melhorar o Job Radar
title: "[feat]: "
labels: ["enhancement"]
body:
  - type: textarea
    id: problema
    attributes:
      label: Que problema isso resolve?
      description: Descreva o problema antes da solução. Pedido sem o porquê é difícil de avaliar.
      placeholder: Com 200 vagas coletadas, não sei quais valem meu tempo sem abrir uma por uma.
    validations:
      required: true
  - type: textarea
    id: solucao
    attributes:
      label: Solução proposta
      description: Como você imagina funcionando, na prática.
      placeholder: Um filtro "só acima de 80" na página de Vagas.
    validations:
      required: true
  - type: textarea
    id: alternativas
    attributes:
      label: Alternativas consideradas
      description: Outros jeitos de resolver o mesmo problema (inclusive não fazer nada).
  - type: dropdown
    id: escopo
    attributes:
      label: Área
      multiple: false
      options:
        - Coleta de vagas
        - Matching e score
        - CV e IA
        - Candidaturas (Kanban)
        - Perfil
        - Analytics e custos
        - Infra e DX
        - Documentação
    validations:
      required: true
  - type: checkboxes
    id: ajuda
    attributes:
      label: Disponibilidade
      options:
        - label: Posso tentar implementar (comente — ajudamos no caminho)
