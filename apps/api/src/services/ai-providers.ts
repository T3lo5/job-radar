import { prisma } from '../db/prisma.js'

export interface AiProviderInput {
  name: string
  baseUrl: string
  apiKey: string
  model: string
  isActive?: boolean
}

export interface AiProviderOutput {
  id: string
  name: string
  baseUrl: string
  model: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

function toOutput(provider: {
  id: string
  name: string
  baseUrl: string
  model: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): AiProviderOutput {
  return {
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    model: provider.model,
    isActive: provider.isActive,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  }
}

export async function listAiProviders(): Promise<AiProviderOutput[]> {
  const providers = await prisma.aiProvider.findMany({
    orderBy: { createdAt: 'asc' },
  })
  return providers.map(toOutput)
}

export async function getActiveAiProvider(): Promise<AiProviderOutput | null> {
  const provider = await prisma.aiProvider.findFirst({
    where: { isActive: true },
  })
  return provider ? toOutput(provider) : null
}

export async function createAiProvider(data: AiProviderInput): Promise<AiProviderOutput> {
  if (data.isActive) {
    await prisma.aiProvider.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    })
  }

  const provider = await prisma.aiProvider.create({
    data: {
      name: data.name,
      baseUrl: data.baseUrl,
      apiKey: data.apiKey,
      model: data.model,
      isActive: data.isActive ?? false,
    },
  })

  return toOutput(provider)
}

export async function updateAiProvider(
  id: string,
  data: Partial<AiProviderInput>,
): Promise<AiProviderOutput> {
  if (data.isActive) {
    await prisma.aiProvider.updateMany({
      where: { isActive: true, id: { not: id } },
      data: { isActive: false },
    })
  }

  const provider = await prisma.aiProvider.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.baseUrl !== undefined && { baseUrl: data.baseUrl }),
      ...(data.apiKey !== undefined && { apiKey: data.apiKey }),
      ...(data.model !== undefined && { model: data.model }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  })

  return toOutput(provider)
}

export async function deleteAiProvider(id: string): Promise<void> {
  await prisma.aiProvider.delete({ where: { id } })
}

export async function setActiveAiProvider(id: string): Promise<AiProviderOutput> {
  await prisma.aiProvider.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  })

  const provider = await prisma.aiProvider.update({
    where: { id },
    data: { isActive: true },
  })

  return toOutput(provider)
}
