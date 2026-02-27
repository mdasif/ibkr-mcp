/**
 * News schemas.
 */
import { z } from 'zod';
import { ContractSchema } from './common';

export const NewsProvidersListInput = z.object({});

export const NewsBulletinsSubscribeInput = z.object({
  allMessages: z.boolean().default(true),
});

export const NewsBulletinsUnsubscribeInput = z.object({});

export const NewsHeadlinesInput = z.object({
  contract: ContractSchema.optional(),
  symbol: z.string().optional(),
  providerCodes: z.array(z.string()).optional().describe('e.g. ["BZ", "DJ"]'),
  startDateTime: z.string().optional(),
  endDateTime: z.string().optional(),
});

export const NewsArticleInput = z.object({
  providerCode: z.string(),
  articleId: z.string(),
});

export const HistoricalNewsInput = z.object({
  conId: z.number(),
  providerCodes: z.array(z.string()),
  startDateTime: z.string(),
  endDateTime: z.string(),
  maxResults: z.number().default(100),
});
