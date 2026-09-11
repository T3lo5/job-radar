export interface SearchStrategyInput {
  profileJobTypes: string[];
  profileSeniorityList: string[];
  profileSkillNames: string[];
  settingKeywords: string[];
}

export interface SearchLayerResult {
  keywords: string[];
  strategy: 'specific' | 'skills' | 'keywords' | 'fallback';
  relaxed: boolean;
}

const MIN_JOYS_THRESHOLD = 5;

export function buildSearchKeywords(input: SearchStrategyInput): SearchLayerResult[] {
  const { profileJobTypes, profileSeniorityList, profileSkillNames, settingKeywords } = input;

  const layers: SearchLayerResult[] = [];

  const seniorityTerms =
    profileSeniorityList.length > 0
      ? profileSeniorityList.map((s) => s.toLowerCase())
      : ['junior', 'mid', 'pleno', 'senior'];

  if (profileJobTypes.length > 0) {
    const specificKeywords = profileJobTypes.flatMap((title) =>
      seniorityTerms.map((seniority) => `${title} ${seniority}`),
    );
    layers.push({ keywords: specificKeywords, strategy: 'specific', relaxed: false });
  }

  if (profileSkillNames.length > 0) {
    const skillKeywords = profileSkillNames.slice(0, 8);
    layers.push({ keywords: skillKeywords, strategy: 'skills', relaxed: false });
  }

  if (settingKeywords.length > 0) {
    layers.push({ keywords: settingKeywords, strategy: 'keywords', relaxed: false });
  }

  if (profileJobTypes.length > 0 && seniorityTerms.length > 1) {
    const relaxedKeywords = profileJobTypes.flatMap((title) =>
      seniorityTerms.slice(0, 2).map((seniority) => `${title} ${seniority}`),
    );
    layers.push({ keywords: relaxedKeywords, strategy: 'specific', relaxed: true });
  }

  layers.push({ keywords: ['developer', 'engineer'], strategy: 'fallback', relaxed: true });

  return layers;
}

export function createRelaxedFilters(originalFilters: any, relaxationLevel: number) {
  if (relaxationLevel === 0) {
    return originalFilters;
  }

  return {
    ...originalFilters,
    relaxed: true,
    relaxationLevel,
  };
}

export function shouldRelaxFilters(
  resultsCount: number,
  threshold: number = MIN_JOYS_THRESHOLD,
): boolean {
  return resultsCount < threshold;
}
