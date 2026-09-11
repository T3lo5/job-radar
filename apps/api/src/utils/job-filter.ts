import type { Profile } from '../generated/prisma/index.js';

interface ProfileWithSkills extends Profile {
  skills?: Array<{ skill: { name: string } }>;
}

function normalizeSkillName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\.js$/, '')
    .replace(/\.ts$/, '')
    .replace(/js$/, '')
    .replace(/reactnative$/, 'react');
}

export interface JobFilterInput {
  title: string;
  description: string;
  seniority: string | null;
}

export interface JobFilterResult {
  allowed: boolean;
  reason?: string;
}

export function createJobFilter(
  profile: ProfileWithSkills | null,
  options: { relaxed?: boolean } = {},
) {
  if (!profile) {
    return {
      filter: (): JobFilterResult => ({ allowed: true }),
    };
  }

  const preferredSeniority = profile.seniorityList ?? [];
  const profileSkillNames = (profile.skills ?? []).map((ps) =>
    normalizeSkillName(ps.skill?.name ?? ''),
  );
  const focusStacks =
    (profile.focusStacks ?? []).length > 0
      ? (profile.focusStacks ?? []).map((s) => s.toLowerCase())
      : profileSkillNames;
  const discardTerms = (profile.discardTerms ?? []).map((t) => t.toLowerCase());
  const relaxed = options.relaxed ?? false;

  return {
    filter: (job: JobFilterInput): JobFilterResult => {
      const titleLower = job.title.toLowerCase();
      const descLower = job.description.toLowerCase();
      const combinedText = `${titleLower} ${descLower}`;

      if (!relaxed) {
        for (const term of discardTerms) {
          if (term && combinedText.includes(term)) {
            return { allowed: false, reason: `discard_term: ${term}` };
          }
        }
      }

      if (preferredSeniority.length > 0 && job.seniority) {
        const jobSeniority = job.seniority.toUpperCase();
        if (!relaxed) {
          if (!preferredSeniority.includes(jobSeniority)) {
            return { allowed: false, reason: `seniority_mismatch: ${jobSeniority}` };
          }
        } else {
          const seniorityLevels: Record<string, number> = {
            INTERN: 1,
            JUNIOR: 2,
            MID: 3,
            SENIOR: 4,
            SPECIALIST: 5,
            LEAD: 5,
          };
          const jobLevel = seniorityLevels[jobSeniority] ?? 3;
          const allowedLevels = new Set<number>();
          preferredSeniority.forEach((s) => {
            const level = seniorityLevels[s] ?? 3;
            allowedLevels.add(level);
            allowedLevels.add(level - 1);
            allowedLevels.add(level + 1);
          });
          if (!allowedLevels.has(jobLevel)) {
            return { allowed: false, reason: `seniority_mismatch_relaxed: ${jobSeniority}` };
          }
        }
      }

      if (focusStacks.length > 0) {
        const hasMatch = focusStacks.some((stack) => combinedText.includes(stack));
        if (!hasMatch) {
          if (!relaxed) {
            return { allowed: false, reason: 'no_focus_stack_match' };
          }
          const hasPartialMatch = focusStacks.some(
            (stack) =>
              combinedText.includes(stack.slice(0, 4)) ||
              stack.includes(combinedText.split(' ')[0] ?? ''),
          );
          if (!hasPartialMatch) {
            return { allowed: false, reason: 'no_focus_stack_match_relaxed' };
          }
        }
      }

      return { allowed: true };
    },
  };
}
