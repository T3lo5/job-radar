import { prisma } from '../db/prisma.js'

export interface AnalyticsOverview {
  period: { from: Date; to: Date }
  jobs: {
    collected: number
    analyzed: number
    byStatus: Record<string, number>
  }
  applications: {
    total: number
    applied: number
    interviews: number
    offers: number
    rejected: number
    byStatus: Record<string, number>
  }
  rates: {
    responseRate: number
    interviewRate: number
    offerRate: number
  }
  matches: {
    distribution: { range: string; count: number }[]
    averageScore: number
  }
  skills: {
    mostFrequent: { name: string; count: number }[]
    biggestGaps: { name: string; jobCount: number }[]
  }
}

export async function getAnalyticsOverview(
  periodDays = 30,
): Promise<AnalyticsOverview> {
  const now = new Date()
  const from = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

  // Jobs stats
  const jobsInPeriod = await prisma.job.findMany({
    where: { collectedAt: { gte: from } },
    select: { status: true },
  })

  const jobsByStatus: Record<string, number> = {}
  for (const job of jobsInPeriod) {
    jobsByStatus[job.status] = (jobsByStatus[job.status] ?? 0) + 1
  }

  const analyzedJobs = await prisma.job.count({
    where: { status: 'DONE', collectedAt: { gte: from } },
  })

  // Applications stats
  const applications = await prisma.application.findMany({
    where: { createdAt: { gte: from } },
    select: { status: true },
  })

  const appsByStatus: Record<string, number> = {}
  for (const app of applications) {
    appsByStatus[app.status] = (appsByStatus[app.status] ?? 0) + 1
  }

  const applied = appsByStatus['APPLIED'] ?? 0
  const interviews = appsByStatus['INTERVIEW'] ?? 0
  const offers = appsByStatus['OFFER'] ?? 0
  const rejected = appsByStatus['REJECTED'] ?? 0

  // Match scores distribution
  const matches = await prisma.jobMatch.findMany({
    where: { computedAt: { gte: from } },
    select: { score: true },
  })

  const distribution = [
    { range: '90+', count: 0 },
    { range: '80-89', count: 0 },
    { range: '70-79', count: 0 },
    { range: '60-69', count: 0 },
    { range: '50-59', count: 0 },
    { range: '<50', count: 0 },
  ]

  let totalScore = 0
  for (const match of matches) {
    totalScore += match.score
    if (match.score >= 90) distribution[0].count++
    else if (match.score >= 80) distribution[1].count++
    else if (match.score >= 70) distribution[2].count++
    else if (match.score >= 60) distribution[3].count++
    else if (match.score >= 50) distribution[4].count++
    else distribution[5].count++
  }

  // Most frequent skills in all jobs (not just applied)
  const allJobIds = await prisma.job.findMany({
    where: { collectedAt: { gte: from } },
    select: { id: true },
  })

  const jobSkills = await prisma.jobSkill.findMany({
    where: { jobId: { in: allJobIds.map((j) => j.id) } },
    include: { skill: true },
  })

  const skillCount: Record<string, number> = {}
  for (const js of jobSkills) {
    skillCount[js.skill.name] = (skillCount[js.skill.name] ?? 0) + 1
  }

  const mostFrequent = Object.entries(skillCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Biggest gaps: skills in jobs but not in profile
  const profileSkills = await prisma.profileSkill.findMany({
    include: { skill: true },
  })
  const profileSkillNames = new Set(profileSkills.map((ps) => ps.skill.name.toLowerCase()))

  const gapCount: Record<string, number> = {}
  for (const js of jobSkills) {
    if (!profileSkillNames.has(js.skill.name.toLowerCase())) {
      gapCount[js.skill.name] = (gapCount[js.skill.name] ?? 0) + 1
    }
  }

  const biggestGaps = Object.entries(gapCount)
    .map(([name, jobCount]) => ({ name, jobCount }))
    .sort((a, b) => b.jobCount - a.jobCount)
    .slice(0, 10)

  const totalApps = applications.length

  return {
    period: { from, to: now },
    jobs: {
      collected: jobsInPeriod.length,
      analyzed: analyzedJobs,
      byStatus: jobsByStatus,
    },
    applications: {
      total: totalApps,
      applied,
      interviews,
      offers,
      rejected,
      byStatus: appsByStatus,
    },
    rates: {
      responseRate: totalApps > 0 ? applied / totalApps : 0,
      interviewRate: applied > 0 ? interviews / applied : 0,
      offerRate: interviews > 0 ? offers / interviews : 0,
    },
    matches: {
      distribution,
      averageScore: matches.length > 0 ? totalScore / matches.length : 0,
    },
    skills: {
      mostFrequent,
      biggestGaps,
    },
  }
}
