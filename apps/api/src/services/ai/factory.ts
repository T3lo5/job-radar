import { prisma } from '../../db/prisma.js'
import { HttpAiClient } from './client.js'
import { InstrumentedAiClient } from './instrumented.js'
import { JobAnalyzer } from './job-analyzer.js'
import { JobExtractor } from './job-extractor.js'
import { CvParser } from './cv-parser.js'
import { Summarizer } from './summarizer.js'
import { CvOptimizer } from './cv-optimizer.js'
import { testConnection as testConnectionInternal } from './test-connection.js'
import type { AIClient, AIClientConfig } from './types.js'

export async function getConfig(): Promise<AIClientConfig> {
  const provider = await prisma.aiProvider.findFirst({
    where: { isActive: true },
  })

  if (!provider) {
    throw new Error('No active AI provider configured. Please add one in Settings > IA.')
  }

  return {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model: provider.model,
  }
}

export async function createAiClient(): Promise<AIClient> {
  const config = await getConfig()
  const inner = new HttpAiClient(config)
  return new InstrumentedAiClient(inner, config, { prisma })
}

export function createJobAnalyzer(): Promise<JobAnalyzer> {
  return createAiClient().then((ai) => new JobAnalyzer(ai))
}

export function createJobExtractor(): Promise<JobExtractor> {
  return createAiClient().then((ai) => new JobExtractor(ai))
}

export function createCvParser(): Promise<CvParser> {
  return createAiClient().then((ai) => new CvParser(ai))
}

export function createSummarizer(): Promise<Summarizer> {
  return createAiClient().then((ai) => new Summarizer(ai))
}

export function createCvOptimizer(): Promise<CvOptimizer> {
  return createAiClient().then((ai) => new CvOptimizer(ai))
}

export const testConnection = testConnectionInternal
