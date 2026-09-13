/**
 * News tools — MCP tool registration for news operations.
 */
import { withEnvelope } from '../middleware/error_mapping';
import * as newsService from '../services/news_service';
import {
  NewsProvidersListInput, NewsBulletinsSubscribeInput,
  NewsBulletinsUnsubscribeInput, NewsHeadlinesInput,
  NewsArticleInput, HistoricalNewsInput,
} from '../schemas/news_schemas';
import { toSchema } from './schema_utils';

export const NEWS_TOOLS = [
  {
    name: 'news_providers_list',
    description: 'List available news providers with their codes.',
    inputSchema: toSchema(NewsProvidersListInput),
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => newsService.newsProvidersList());
    },
  },
  {
    name: 'news_bulletins_subscribe',
    description: 'Subscribe to IB system news bulletins (exchange messages, system status, etc.).',
    inputSchema: toSchema(NewsBulletinsSubscribeInput),
    handler: async (args: Record<string, unknown>) => {
      const input = NewsBulletinsSubscribeInput.parse(args);
      return withEnvelope(async () => newsService.newsBulletinsSubscribe(input.allMessages));
    },
  },
  {
    name: 'news_bulletins_unsubscribe',
    description: 'Unsubscribe from IB news bulletins.',
    inputSchema: toSchema(NewsBulletinsUnsubscribeInput),
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => newsService.newsBulletinsUnsubscribe());
    },
  },
  {
    name: 'news_headlines',
    description: 'Get recent news headlines, optionally filtered by provider codes and contract ID.',
    inputSchema: toSchema(NewsHeadlinesInput),
    handler: async (args: Record<string, unknown>) => {
      const input = NewsHeadlinesInput.parse(args);
      return withEnvelope(async () => newsService.newsHeadlines(input.contract, input.providerCodes, input.startDateTime, input.endDateTime));
    },
  },
  {
    name: 'news_article',
    description: 'Get the full text of a news article by providerCode and articleId.',
    inputSchema: toSchema(NewsArticleInput),
    handler: async (args: Record<string, unknown>) => {
      const input = NewsArticleInput.parse(args);
      return withEnvelope(async () => newsService.newsArticle(input.providerCode, input.articleId));
    },
  },
  {
    name: 'historical_news',
    description: 'Get historical news headlines for a contract.',
    inputSchema: toSchema(HistoricalNewsInput),
    handler: async (args: Record<string, unknown>) => {
      const input = HistoricalNewsInput.parse(args);
      return withEnvelope(async () => newsService.historicalNews(input.conId, input.providerCodes, input.startDateTime, input.endDateTime, input.maxResults));
    },
  },
];
