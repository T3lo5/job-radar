import type { RemoteMode } from '@job-radar/shared';

const BRAZILIAN_LOCATIONS = [
  'brasil',
  'brazil',
  'br',
  'são paulo',
  'sao paulo',
  'rio de janeiro',
  'belo horizonte',
  'curitiba',
  'porto alegre',
  'brasília',
  'florianópolis',
  'recife',
  'salvador',
  'fortaleza',
  'manaus',
  'goiânia',
  'campinas',
  'santos',
  'são josé dos campos',
  'ribeirão preto',
  'uberlândia',
  'sorocaba',
  'maceió',
  'natal',
  'campo grande',
  'teresina',
  'joão pessoa',
  'londrina',
  'joinville',
  'niterói',
  'são luís',
  'aracaju',
  'macapá',
  'porto velho',
  'rio branco',
  'vitória',
  'cuiabá',
  'palmas',
];

// Countries/locations that should be excluded by default for Brazil-focused searches
const DEFAULT_EXCLUDED_LOCATIONS = [
  // European countries
  'republica checa',
  'czech republic',
  'czechia',
  'poland',
  'polônia',
  'ukraine',
  'ucrânia',
  'germany',
  'alemanha',
  'france',
  'frança',
  'uk',
  'united kingdom',
  'reino unido',
  'spain',
  'espanha',
  'portugal',
  'italy',
  'itália',
  'netherlands',
  'holanda',
  'belgium',
  'bélgica',
  'switzerland',
  'suíça',
  'austria',
  'áustria',
  'sweden',
  'suécia',
  'norway',
  'noruega',
  'denmark',
  'dinamarca',
  'finland',
  'finlândia',
  'ireland',
  'irlanda',
  'scotland',
  'escócia',

  // Asian countries
  'india',
  'índia',
  'philippines',
  'filipinas',
  'pakistan',
  'paquistão',
  'bangladesh',
  'vietnam',
  'vietnã',
  'china',
  'japan',
  'japão',
  'south korea',
  'coréia do sul',
  'singapore',
  'singapura',
  'malaysia',
  'indonesia',
  'tailândia',
  'thailand',

  // American countries (non-Brazil)
  'united states',
  'usa',
  'eua',
  'us',
  'canada',
  'canadá',
  'mexico',
  'méxico',
  'argentina',
  'chile',
  'colombia',
  'peru',
  'uruguay',
  'paraguay',
  'venezuela',
  'ecuador',
  'bolivia',

  // Remote with specific non-Brazil locations
  'remote - worldwide',
  'remote - global',
  'remote - any',
  'remote - us',
  'remote - usa',
  'remote - europe',
  'remote - asia',
  'worldwide',
  'global',
];

const EXCLUDED_CITIES = [
  'new york',
  'los angeles',
  'chicago',
  'houston',
  'phoenix',
  'philadelphia',
  'san antonio',
  'san diego',
  'dallas',
  'san jose',
  'austin',
  'jacksonville',
  'san francisco',
  'seattle',
  'denver',
  'washington',
  'boston',
  'nashville',
  'portland',
  'las vegas',
  'miami',
  'atlanta',
  'charlotte',
  'minneapolis',
  'detroit',
  'st. louis',
  'baltimore',
  'tampa',
  'orlando',
  'pittsburgh',
  'cincinnati',
  'sacramento',
  'kansas city',
  'cleveland',
  'indianapolis',
  'columbus',
  'raleigh',
  'milwaukee',
  'salt lake city',
  'toronto',
  'vancouver',
  'montreal',
  'ottawa',
  'calgary',
  'edmonton',
  'london',
  'manchester',
  'birmingham',
  'glasgow',
  'edinburgh',
  'dublin',
  'paris',
  'lyon',
  'marseille',
  'toulouse',
  'nice',
  'berlin',
  'munich',
  'hamburg',
  'cologne',
  'frankfurt',
  'stuttgart',
  'amsterdam',
  'rotterdam',
  'brussels',
  'antwerp',
  'zurich',
  'geneva',
  'basel',
  'vienna',
  'prague',
  'warsaw',
  'krakow',
  'budapest',
  'bucharest',
  'sofia',
  'athens',
  'lisbon',
  'madrid',
  'barcelona',
  'valencia',
  'seville',
  'milan',
  'rome',
  'naples',
  'turin',
  'florence',
  'stockholm',
  'oslo',
  'copenhagen',
  'helsinki',
  'moscow',
  'st. petersburg',
  'kiev',
  'kyiv',
  'tokyo',
  'osaka',
  'kyoto',
  'seoul',
  'busan',
  'beijing',
  'shanghai',
  'shenzhen',
  'guangzhou',
  'singapore',
  'hong kong',
  'bangkok',
  'jakarta',
  'kuala lumpur',
  'manila',
  'hanoi',
  'ho chi minh',
  'mumbai',
  'delhi',
  'bangalore',
  'hyderabad',
  'chennai',
  'kolkata',
  'pune',
  'ahmedabad',
  'sydney',
  'melbourne',
  'brisbane',
  'perth',
  'adelaide',
  'auckland',
];

/**
 * Cria o filtro de localização, guiado também pela modalidade desejada.
 *
 * `remotePreference` vem de `profile.remotePreference` (ProfileForm). Regra:
 * remoto é aceito em qualquer país, porque uma vaga remota é justamente a
 * que independe de onde você está. Só quem escolheu explicitamente
 * presencial (ON_SITE) deixa de aceitar remoto.
 *
 * Antes disso, o filtro descartava por padrão 'Remote - Worldwide' e
 * 'Anywhere' — justamente as vagas que um buscador remoto mais valoriza.
 */
export function createLocationFilter(
  preferredLocation: string | null | undefined,
  remotePreference: string | null | undefined,
) {
  const preferred = preferredLocation?.toLowerCase().trim() || '';
  const allowRemote = remotePreference !== 'ON_SITE';

  const build = (includeLocations: string[], excludeLocations: string[]) => ({
    isAllowed: (location: string | null | undefined, description?: string, remote?: RemoteMode) =>
      isLocationAllowed(
        location,
        description,
        includeLocations,
        excludeLocations,
        remote,
        allowRemote,
      ),
  });

  // Sem local preferido, ou quando o preferido é o Brasil: usa a lista
  // brasileira como fallback.
  const isBrazil =
    !preferred ||
    preferred.includes('brasil') ||
    preferred.includes('brazil') ||
    preferred.includes('br');

  if (isBrazil) {
    return build(BRAZILIAN_LOCATIONS, DEFAULT_EXCLUDED_LOCATIONS);
  }

  // Outros países: monta a lista a partir do que o usuário digitou.
  const includeLocations = preferred
    .split(',')
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
  const excludeLocations = DEFAULT_EXCLUDED_LOCATIONS.filter(
    (loc) => !includeLocations.some((inc) => loc.includes(inc) || inc.includes(loc)),
  );

  return build(includeLocations, excludeLocations);
}

function isLocationAllowed(
  location: string | null | undefined,
  description: string | undefined,
  includeLocations: string[],
  excludeLocations: string[],
  remote: RemoteMode = 'unknown',
  allowRemote = true,
): boolean {
  const isRemoteJob = remote === 'remote' || remote === 'hybrid';

  // Vaga remota aceita em qualquer país. Chega antes da checagem de local
  // porque várias fontes devolvem location vazia para vaga remota.
  if (allowRemote && remote === 'remote') return true;

  // If no location provided, check description for location hints
  if (!location || location.trim() === '') {
    // Híbrido sem cidade definida também passa quando remoto é aceito.
    if (allowRemote && isRemoteJob) return true;

    if (description) {
      const descLower = description.toLowerCase();

      // Check if description mentions excluded locations
      for (const loc of excludeLocations) {
        if (descLower.includes(loc)) return false;
      }
      for (const city of EXCLUDED_CITIES) {
        if (descLower.includes(city)) return false;
      }

      // If description mentions included locations, allow it
      for (const loc of includeLocations) {
        if (descLower.includes(loc)) return true;
      }
    }

    // No location info and no clear description hints - exclude to be safe
    return false;
  }

  const lower = location.toLowerCase().trim();

  // Check if explicitly excluded
  for (const loc of excludeLocations) {
    if (lower.includes(loc)) return false;
  }

  // Check if explicitly included
  for (const loc of includeLocations) {
    if (lower.includes(loc)) return true;
  }

  // Check for excluded cities
  for (const city of EXCLUDED_CITIES) {
    if (lower.includes(city)) return false;
  }

  // Check description for additional context
  if (description) {
    const descLower = description.toLowerCase();
    for (const loc of excludeLocations) {
      if (descLower.includes(loc)) return false;
    }
    for (const city of EXCLUDED_CITIES) {
      if (descLower.includes(city)) return false;
    }
    for (const loc of includeLocations) {
      if (descLower.includes(loc)) return true;
    }
  }

  // If it says "remote" without any country specification, exclude
  if (lower.includes('remote') || lower.includes('remoto') || lower.includes('work from home')) {
    return false;
  }

  // Default: exclude if we can't determine it's in the preferred location
  return false;
}

// Legacy function for backwards compatibility
export function isBrazilianLocation(
  location: string | null | undefined,
  description?: string,
): boolean {
  const filter = createLocationFilter('brasil', 'ON_SITE');
  return filter.isAllowed(location, description);
}
