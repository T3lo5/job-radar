import type { Profile } from '../generated/prisma/index.js'

export interface JobFilterInput {
  title: string
  description: string
  seniority: string | null
}

export interface JobFilterResult {
  allowed: boolean
  reason?: string
}

export function createJobFilter(profile: Profile | null) {
  if (!profile) {
    return {
      filter: (): JobFilterResult => ({ allowed: true }),
    }
  }

  const preferredSeniority = profile.seniorityList ?? []
  const focusStacks = (profile.focusStacks ?? []).map((s) => s.toLowerCase())
  const discardTerms = (profile.discardTerms ?? []).map((t) => t.toLowerCase())

  return {
    filter: (job: JobFilterInput): JobFilterResult => {
      const titleLower = job.title.toLowerCase()
      const descLower = job.description.toLowerCase()
      const combinedText = `${titleLower} ${descLower}`

      // 1. Discard term filter: reject if any discard term appears
      for (const term of discardTerms) {
        if (term && combinedText.includes(term)) {
          return { allowed: false, reason: `discard_term: ${term}` }
        }
      }

      // 2. Seniority filter: if user specified seniority preferences, filter by them
      if (preferredSeniority.length > 0 && job.seniority) {
        const jobSeniority = job.seniority.toUpperCase()
        if (!preferredSeniority.includes(jobSeniority)) {
          return { allowed: false, reason: `seniority_mismatch: ${jobSeniority}` }
        }
      }

      // 3. Focus stack filter: require at least one focus stack to match
      if (focusStacks.length > 0) {
        const hasMatch = focusStacks.some((stack) => combinedText.includes(stack))
        if (!hasMatch) {
          return { allowed: false, reason: 'no_focus_stack_match' }
        }
      }

      return { allowed: true }
    },
  }
}
