import { prisma } from '../db/prisma.js';
import { encrypt, decrypt } from './settings-service.js';

export interface AiProviderInput {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isActive?: boolean;
}

export interface AiProviderOutput {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  hasApiKey: boolean;
}

function toOutput(provider: {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  encryptedApiKey: string | null;
}): AiProviderOutput {
  return {
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    model: provider.model,
    isActive: provider.isActive,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
    hasApiKey: !!provider.encryptedApiKey,
  };
}

/** Devolve a apiKey decifrada (uso interno apenas — nunca expor na API). */
async function getDecryptedApiKey(id: string): Promise<string | null> {
  const provider = await prisma.aiProvider.findUnique({
    where: { id },
    select: { id: true, encryptedApiKey: true, apiKeyIv: true, apiKeyTag: true, apiKey: true },
  });

  if (!provider) return null;

  // Migração lazy: linhas antigas ainda têm `apiKey` em texto claro.
  // Criptografa e limpa a coluna antiga no primeiro acesso.
  if (provider.apiKey && !provider.encryptedApiKey) {
    const { encryptedValue, iv, tag } = encrypt(provider.apiKey);
    await prisma.aiProvider.update({
      where: { id },
      data: {
        encryptedApiKey: encryptedValue,
        apiKeyIv: iv,
        apiKeyTag: tag,
        apiKey: null,
      },
    });
    return provider.apiKey;
  }

  if (!provider.encryptedApiKey || !provider.apiKeyIv || !provider.apiKeyTag) {
    return null;
  }

  return decrypt(provider.encryptedApiKey, provider.apiKeyIv, provider.apiKeyTag);
}

export async function listAiProviders(): Promise<AiProviderOutput[]> {
  const providers = await prisma.aiProvider.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      model: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      encryptedApiKey: true,
    },
  });
  return providers.map(toOutput);
}

export async function getActiveAiProvider(): Promise<AiProviderOutput | null> {
  const provider = await prisma.aiProvider.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      model: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      encryptedApiKey: true,
    },
  });
  return provider ? toOutput(provider) : null;
}

export async function createAiProvider(data: AiProviderInput): Promise<AiProviderOutput> {
  if (data.isActive) {
    await prisma.aiProvider.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
  }

  const { encryptedValue, iv, tag } = encrypt(data.apiKey);

  const provider = await prisma.aiProvider.create({
    data: {
      name: data.name,
      baseUrl: data.baseUrl,
      encryptedApiKey: encryptedValue,
      apiKeyIv: iv,
      apiKeyTag: tag,
      model: data.model,
      isActive: data.isActive ?? false,
    },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      model: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      encryptedApiKey: true,
    },
  });

  return toOutput(provider);
}

export async function updateAiProvider(
  id: string,
  data: Partial<AiProviderInput>,
): Promise<AiProviderOutput> {
  if (data.isActive) {
    await prisma.aiProvider.updateMany({
      where: { isActive: true, id: { not: id } },
      data: { isActive: false },
    });
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl;
  if (data.model !== undefined) updateData.model = data.model;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.apiKey !== undefined) {
    const { encryptedValue, iv, tag } = encrypt(data.apiKey);
    updateData.encryptedApiKey = encryptedValue;
    updateData.apiKeyIv = iv;
    updateData.apiKeyTag = tag;
  }

  const provider = await prisma.aiProvider.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      baseUrl: true,
      model: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      encryptedApiKey: true,
    },
  });

  return toOutput(provider);
}

export async function deleteAiProvider(id: string): Promise<void> {
  await prisma.aiProvider.delete({ where: { id } });
}

export async function setActiveAiProvider(id: string): Promise<AiProviderOutput> {
  await prisma.aiProvider.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const provider = await prisma.aiProvider.update({
    where: { id },
    data: { isActive: true },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      model: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      encryptedApiKey: true,
    },
  });

  return toOutput(provider);
}

export { getDecryptedApiKey };
