import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CheckCircle, AlertCircle, Zap, Database, Link, ExternalLink, Key } from 'lucide-react';

interface SourceCardProps {
  source: {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
  };
  onToggle: (enabled: boolean) => void;
  isToggling: boolean;
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  remoteok: <Zap className="h-5 w-5 text-orange-500" />,
  remotive: <Zap className="h-5 w-5 text-blue-500" />,
  linkedin: <Link className="h-5 w-5 text-blue-600" />,
  'google-jobs': <Database className="h-5 w-5 text-green-500" />,
  indeed: <Zap className="h-5 w-5 text-indigo-500" />,
  adzuna: <Database className="h-5 w-5 text-purple-500" />,
  jobicy: <Zap className="h-5 w-5 text-pink-500" />,
  weworkremotely: <Zap className="h-5 w-5 text-teal-500" />,
  'linkedin-apify': <Link className="h-5 w-5 text-blue-700" />,
  manual: <ExternalLink className="h-5 w-5 text-gray-500" />,
};

export function SourceCard({ source, onToggle, isToggling }: SourceCardProps) {
  const Icon = SOURCE_ICONS[source.id] || <Database className="h-5 w-5 text-muted-foreground" />;

  const needsCredentials = ['linkedin-apify', 'adzuna', 'linkedin'].includes(source.id);

  return (
    <div className="flex flex-col p-4 rounded-xl bg-surface-2 border border-border hover:border-accent/50 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          {Icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground truncate">{source.name}</h4>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{source.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Badge variant={source.enabled ? 'success' : 'default'} className="text-xs">
            {source.enabled ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Ativo
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Inativo
              </>
            )}
          </Badge>
          {needsCredentials && (
            <Badge variant="outline" className="text-xs">
              <Key className="h-3 w-3 mr-1" />
              Requer credenciais
            </Badge>
          )}
        </div>

        <Button
          size="sm"
          variant={source.enabled ? 'secondary' : 'outline'}
          onClick={() => onToggle(!source.enabled)}
          disabled={isToggling}
          className="flex-shrink-0"
        >
          {isToggling ? '...' : source.enabled ? 'Desativar' : 'Ativar'}
        </Button>
      </div>
    </div>
  );
}
