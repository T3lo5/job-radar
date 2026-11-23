import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorState } from './error-state';

// O workspace web não tem Testing Library/MSW. Renderizar no servidor é o que
// dá para fazer sem infra nova: garante o contrato que as páginas dependem
// (role=alert, retry e detalhe técnico), que é justamente o que faltava quando
// erro de API virava empty state.
describe('ErrorState', () => {
  it('anuncia o erro como alert e oferece tentar de novo', () => {
    const html = renderToStaticMarkup(
      <ErrorState title="Não foi possível carregar as vagas" onRetry={() => {}} />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Não foi possível carregar as vagas');
    expect(html).toContain('Tentar de novo');
  });

  it('mostra o detalhe técnico colapsável quando há erro', () => {
    const html = renderToStaticMarkup(
      <ErrorState error={new Error('connect ECONNREFUSED 127.0.0.1:3001')} />,
    );

    expect(html).toContain('Detalhes técnicos');
    expect(html).toContain('connect ECONNREFUSED 127.0.0.1:3001');
  });

  it('omite o detalhe técnico quando não há erro associado', () => {
    const html = renderToStaticMarkup(<ErrorState />);

    expect(html).toContain('role="alert"');
    expect(html).not.toContain('Detalhes técnicos');
  });

  it('na versão compacta mantém o alerta e o retry, sem o detalhe técnico', () => {
    const html = renderToStaticMarkup(
      <ErrorState
        compact
        title="Match indisponível"
        error={new Error('boom')}
        onRetry={() => {}}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Match indisponível');
    expect(html).toContain('Tentar de novo');
    expect(html).not.toContain('Detalhes técnicos');
  });
});
