name: Bug report
description: Algo não funciona como deveria
title: "[bug]: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Obrigado por reportar! Quanto mais preciso, mais rápido corrigimos.
        Verifique antes se já não existe uma [issue aberta](../../issues) para o mesmo bug.
  - type: textarea
    id: esperado
    attributes:
      label: O que você esperava
      description: O comportamento correto, na sua visão.
      placeholder: Ao salvar a experiência sem datas, ela deveria salvar normalmente.
    validations:
      required: true
  - type: textarea
    id: atual
    attributes:
      label: O que aconteceu
      description: O comportamento real, com o texto exato de toasts e erros.
      placeholder: Voltou para a tela sem salvar.
    validations:
      required: true
  - type: textarea
    id: reproduzir
    attributes:
      label: Como reproduzir
      description: Passo a passo clicável a partir de uma tela.
      placeholder: |
        1. Ir em Perfil
        2. Clicar numa experiência importada do CV
        3. Clicar em Salvar sem mudar nada
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Logs relevantes
      description: Trecho do log da API (o ./dev-up.sh mostra na tela) ou do console do navegador (F12).
      render: shell
      placeholder: Cole aqui o trecho do log na hora do erro.
  - type: input
    id: tela
    attributes:
      label: Onde (página e ação)
      description: "Ex.: Perfil > Experiência, Fontes > Buscar Agora."
    validations:
      required: true
  - type: dropdown
    id: ambiente
    attributes:
      label: Ambiente
      multiple: false
      options:
        - ./dev-up.sh (Linux)
        - ./dev-up.sh (WSL)
        - dev-up.ps1 (Windows)
        - Docker produção
        - Outro (descreva nos logs)
    validations:
      required: true
  - type: input
    id: versao
    attributes:
      label: Versão (commit ou data do pull)
      description: "Rode git log --oneline -1 na sua máquina."
      placeholder: 4d1c5b2
  - type: checkboxes
    id: checklist
    attributes:
      label: Antes de enviar
      options:
        - label: "Rodei git pull origin main e testei na versão mais nova"
        - label: "Verifiquei que não é dado de teste antigo"
