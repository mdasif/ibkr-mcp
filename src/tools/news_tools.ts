/**
 * News tools — MCP tool registration for news operations.
 */
import { withEnvelope } from '../middleware/error_mapping';
import * as newsService from '../services/news_service';
import {
  NewsBulletinsSubscribeInput,
  NewsHeadlinesInput, NewsArticleInput, HistoricalNewsInput,
} from '../schemas/news_schemas';

export const NEWS_TOOLS = [
  {
    name: 'news_providers_list',
    description: 'List available news providers with their codes.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => newsService.newsProvidersList());
    },
  },
  {
    name: 'news_bulletins_subscribe',
    description: 'Subscribe to IB system news bulletins (exchange messages, system status, etc.).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        allMsgs: { type: 'boolean', description: 'Include all messages (true) or just new (false)' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = NewsBulletinsSubscribeInput.parse(args);
      return withEnvelope(async () => newsService.newsBulletinsSubscribe(input.allMessages));
    },
  },
  {
    name: 'news_bulletins_unsubscribe',
    description: 'Unsubscribe from IB news bulletins.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => newsService.newsBulletinsUnsubscribe());
    },
  },
  {
    name: 'news_headlines',
    description: 'Get recent news headlines, optionally filtered by provider codes and contract ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number', description: 'Contract ID to filter headlines for a specific instrument' },
        providerCodes: { type: 'string', description: 'Comma-separated provider codes (e.g., "BZ,FLY,DJ")' },
        startDateTime: { type: 'string', description: 'Start date/time (YYYYMMDD HH:mm:ss)' },
        endDateTime: { type: 'string', description: 'End date/time' },
        totalResults: { type: 'number', description: 'Max number of results (default: 10)' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = NewsHeadlinesInput.parse(args);
      return withEnvelope(async () => newsService.newsHeadlines(input.contract, input.providerCodes, input.startDateTime, input.endDateTime));
    },
  },
  {
    name: 'news_article',
    description: 'Get the full text of a news article by providerCode and articleId.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        providerCode: { type: 'string', description: 'News provider code' },
        articleId: { type: 'string', description: 'Article ID from headlines' },
      },
      required: ['providerCode', 'articleId'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = NewsArticleInput.parse(args);
      return withEnvelope(async () => newsService.newsArticle(input.providerCode, input.articleId));
    },
  },
  {
    name: 'historical_news',
    description: 'Get historical news headlines for a contract.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number', description: 'Contract ID' },
        providerCodes: { type: 'string', description: 'Comma-separated provider codes' },
        startDateTime: { type: 'string', description: 'Start date/time (YYYYMMDD HH:mm:ss)' },
        endDateTime: { type: 'string', description: 'End date/time' },
        totalResults: { type: 'number', description: 'Max results (default: 30)' },
      },
      required: ['conId', 'providerCodes'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = HistoricalNewsInput.parse(args);
      return withEnvelope(async () => newsService.historicalNews(input.conId, input.providerCodes, input.startDateTime, input.endDateTime, input.maxResults));
    },
  },
];
