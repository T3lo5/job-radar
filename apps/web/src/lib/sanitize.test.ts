import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeText, sanitizeUrl } from './sanitize';

/**
 * Sanitização é a fronteira de segurança do app, e ela não tinha teste nenhum.
 *
 * O que passa por aqui é conteúdo de terceiros: a descrição de uma vaga vem de
 * RemoteOK, LinkedIn, Indeed — HTML que o app exibe. Um furo aqui é XSS no
 * navegador de quem usa a ferramenta.
 *
 * Isto roda em jsdom de propósito: DOMPurify sem DOM devolve a entrada
 * intacta, e o teste passaria com o sanitizador desligado. Foi o que motivou o
 * `environment: 'jsdom'` no vitest.config.
 */
describe('sanitizeHtml — remove o que executa', () => {
  it('remove <script>', () => {
    const resultado = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(resultado).not.toContain('<script');
    expect(resultado).not.toContain('alert(1)');
    expect(resultado).toContain('ok');
  });

  it('remove atributos de evento', () => {
    const resultado = sanitizeHtml('<p onclick="alert(1)">clique</p>');
    expect(resultado).not.toContain('onclick');
    expect(resultado).not.toContain('alert');
    expect(resultado).toContain('clique');
  });

  it('remove onerror em img', () => {
    const resultado = sanitizeHtml('<img src=x onerror="alert(1)">');
    expect(resultado).not.toContain('onerror');
  });

  it('remove <iframe>', () => {
    expect(sanitizeHtml('<iframe src="https://evil.test"></iframe>')).not.toContain('<iframe');
  });

  it('remove <style>', () => {
    expect(sanitizeHtml('<style>body{display:none}</style><p>x</p>')).not.toContain('<style');
  });

  it('remove javascript: em href', () => {
    const resultado = sanitizeHtml('<a href="javascript:alert(1)">link</a>');
    expect(resultado.toLowerCase()).not.toContain('javascript:');
  });

  it('remove <form> e <input>', () => {
    const resultado = sanitizeHtml('<form action="/x"><input name="a"></form>');
    expect(resultado).not.toContain('<form');
    expect(resultado).not.toContain('<input');
  });

  it('remove atributos data-*', () => {
    expect(sanitizeHtml('<p data-evil="1">x</p>')).not.toContain('data-evil');
  });

  it('remove atributo style', () => {
    // style permite exfiltrar dado via background-image:url(...)
    expect(sanitizeHtml('<p style="background:url(https://evil.test/x)">x</p>')).not.toContain(
      'style=',
    );
  });

  it('sobrevive a payload com varias camadas', () => {
    const resultado = sanitizeHtml(
      '<scr<script>ipt>alert(1)</script></div><img src=x onerror=alert(2)>',
    );
    expect(resultado).not.toContain('<script');
    expect(resultado).not.toContain('onerror');
  });
});

describe('sanitizeHtml — preserva o conteudo legitimo', () => {
  it('mantem formatação de descrição de vaga', () => {
    const html =
      '<p>Vaga com <strong>React</strong> e <em>Node.js</em></p><ul><li>Remoto</li></ul>';
    const resultado = sanitizeHtml(html);

    expect(resultado).toContain('<strong>React</strong>');
    expect(resultado).toContain('<em>Node.js</em>');
    expect(resultado).toContain('<li>Remoto</li>');
  });

  it('mantem links https', () => {
    const resultado = sanitizeHtml('<a href="https://exemplo.test/vaga">ver vaga</a>');
    expect(resultado).toContain('href="https://exemplo.test/vaga"');
  });

  it('mantem tabela', () => {
    const resultado = sanitizeHtml('<table><tr><td>Salário</td></tr></table>');
    expect(resultado).toContain('<table>');
    expect(resultado).toContain('<td>Salário</td>');
  });

  it('mantem acentuacao e emojis', () => {
    const resultado = sanitizeHtml('<p>Vaga para pessoa desenvolvedora — aceita remoto 🌍</p>');
    expect(resultado).toContain('desenvolvedora');
    expect(resultado).toContain('🌍');
  });

  it('texto sem HTML passa direto', () => {
    expect(sanitizeHtml('Vaga simples sem marcação')).toBe('Vaga simples sem marcação');
  });

  it('string vazia nao quebra', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});

describe('sanitizeText — remove HTML por completo', () => {
  it('tira as tags mas fica com o texto', () => {
    expect(sanitizeText('<b>Vaga</b> React')).toBe('Vaga React');
  });

  it('tira script e o conteudo dele', () => {
    expect(sanitizeText('<script>alert(1)</script>Vaga')).not.toContain('alert');
  });
});

describe('sanitizeUrl — so http e https', () => {
  it('aceita https', () => {
    expect(sanitizeUrl('https://exemplo.test/vaga')).toBe('https://exemplo.test/vaga');
  });

  it('aceita http', () => {
    expect(sanitizeUrl('http://exemplo.test')).toBe('http://exemplo.test/');
  });

  it('BLOQUEIA javascript:', () => {
    // A payload clássica de XSS: href="javascript:..."
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });

  it('BLOQUEIA data:', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('BLOQUEIA file:', () => {
    expect(sanitizeUrl('file:///etc/passwd')).toBe('');
  });

  it('devolve vazio para url invalida', () => {
    expect(sanitizeUrl('não é uma url')).toBe('');
    expect(sanitizeUrl('')).toBe('');
  });

  it('BLOQUEIA javascript: com espacos e quebras', () => {
    // Browsers aceitam "java\nscript:" — se o teste só cobrisse a forma
    // limpa, a variante escaparia.
    expect(sanitizeUrl('java\nscript:alert(1)')).toBe('');
    expect(sanitizeUrl('  javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('');
  });
});
