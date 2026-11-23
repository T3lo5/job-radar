import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Download, Loader2, Mail } from 'lucide-react';
import { cvApi, downloadBlob, type CoverLetterResult } from '../services/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from './ui/toast';

type LanguageChoice = 'auto' | 'pt-BR' | 'en';

const LANGUAGE_STORAGE_KEY = 'job-radar:cover-letter-language';

function loadLanguageChoice(): LanguageChoice {
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === 'pt-BR' || saved === 'en' || saved === 'auto' ? saved : 'auto';
}

/**
 * Geração de carta de apresentação.
 *
 * O idioma padrão é "automático": a API detecta o idioma da vaga, o que
 * corrigiu o caso de vaga brasileira gerando carta em inglês. O override fica
 * salvo no navegador para a próxima carta; a execução em si é auditada em
 * `AiRun` com `type: COVER_LETTER` e `metadata.language`.
 */
export function CoverLetterPanel({ jobId, company }: { jobId: string; company?: string }) {
  const [language, setLanguage] = useState<LanguageChoice>(loadLanguageChoice);
  const [recruiterName, setRecruiterName] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      cvApi.coverLetter({
        jobId,
        recruiterName: recruiterName.trim() || undefined,
        language: language === 'auto' ? undefined : language,
      }),
    onSuccess: () => toast.success('Carta de apresentação gerada!'),
    onError: () => toast.error('Erro ao gerar carta de apresentação'),
  });

  const result: CoverLetterResult | undefined = mutation.data;

  const changeLanguage = (value: string) => {
    const next = value as LanguageChoice;
    setLanguage(next);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  };

  return (
    <Card id="cover-letter-output">
      <CardHeader>
        <CardTitle>Carta de Apresentação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-[1fr_200px_auto] md:items-end">
          <div>
            <label htmlFor="recruiter-name" className="text-xs text-muted-foreground">
              Recrutador (opcional)
            </label>
            <Input
              id="recruiter-name"
              value={recruiterName}
              onChange={(event) => setRecruiterName(event.target.value)}
              placeholder="Nome de quem vai receber a carta"
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="cover-letter-language" className="text-xs text-muted-foreground">
              Idioma
            </label>
            <Select value={language} onValueChange={changeLanguage}>
              <SelectTrigger id="cover-letter-language" aria-label="Idioma da carta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (idioma da vaga)</SelectItem>
                <SelectItem value="pt-BR">Português</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Gerando carta...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-1" />
                Gerar carta
              </>
            )}
          </Button>
        </div>

        {mutation.isError && (
          <p className="text-sm text-error" role="alert">
            Não foi possível gerar a carta. Tente novamente.
          </p>
        )}

        {result?.descriptionTruncated && (
          <p className="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 p-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <span>
              A descrição da vaga tem {result.descriptionChars.toLocaleString('pt-BR')} caracteres e
              só os primeiros 12.000 foram enviados ao modelo. Revise a carta com atenção a
              requisitos que possam ter ficado de fora.
            </span>
          </p>
        )}

        {result?.warning && (
          <p
            className="flex items-start gap-2 rounded border border-error/40 bg-error/10 p-2 text-sm"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden />
            <span>{result.warning}</span>
          </p>
        )}

        {result && (
          <>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{result.letter}</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([result.letter], { type: 'text/plain' });
                  downloadBlob(blob, `carta-apresentacao-${company ?? 'vaga'}.txt`);
                }}
              >
                <Download className="h-4 w-4 mr-1" />
                Baixar .txt
              </Button>
              <span className="text-xs text-muted-foreground">
                Idioma: {result.language === 'pt-BR' ? 'português' : 'inglês'}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
