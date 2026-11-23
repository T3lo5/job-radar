import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { KitBlock } from './application-kit';

/**
 * Ticket 31: cada bloco do kit tem loading e erro próprios.
 *
 * O defeito que o kit corrige é justamente o contrário: uma chamada falhando e
 * a tela inteira virando erro. Aqui a prova é estrutural — um bloco em erro
 * mantém o alerta dentro do seu card e o bloco vizinho continua renderizado.
 */
describe('KitBlock — estados independentes', () => {
  it('erro em um bloco não derruba o vizinho', () => {
    const html = renderToStaticMarkup(
      <div>
        <KitBlock title="Match" isError error={new Error('boom')} onRetry={() => {}}>
          <p>score 92%</p>
        </KitBlock>
        <KitBlock title="Carta">
          <p>carta pronta</p>
        </KitBlock>
      </div>,
    );

    expect(html).toContain('Não foi possível carregar match');
    expect(html).toContain('Tentar de novo');
    // O conteúdo do bloco que falhou não aparece...
    expect(html).not.toContain('score 92%');
    // ...e o bloco saudável segue na página.
    expect(html).toContain('carta pronta');
    expect((html.match(/role="alert"/g) ?? []).length).toBe(1);
  });

  it('loading fica restrito ao bloco', () => {
    const html = renderToStaticMarkup(
      <div>
        <KitBlock title="Keywords" isLoading>
          <p>React, Node.js</p>
        </KitBlock>
        <KitBlock title="Histórico">
          <p>Aplicada em 28/10</p>
        </KitBlock>
      </div>,
    );

    expect(html).toContain('Carregando Keywords');
    expect(html).not.toContain('React, Node.js');
    expect(html).toContain('Aplicada em 28/10');
  });

  it('sem erro nem loading renderiza o conteúdo', () => {
    const html = renderToStaticMarkup(
      <KitBlock title="Exportar">
        <p>Exportar JSON</p>
      </KitBlock>,
    );

    expect(html).toContain('Exportar JSON');
    expect(html).not.toContain('Carregando');
    expect(html).not.toContain('role="alert"');
  });
});
