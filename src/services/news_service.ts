/**
 * News service — providers, bulletins, headlines, articles.
 */
import { EventName } from '@stoqey/ib';
import { v4 as uuid } from 'uuid';
import { getConnection } from '../connection/ib_connection';
import { eventBus } from '../connection/event_bus';
import { AppError } from '../middleware/error_mapping';
import type { ContractInput } from '../schemas/common';

export async function newsProvidersList(): Promise<Record<string, unknown>[]> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>[]>((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 10000);

    const onProviders = (providers: unknown[]) => {
      cleanup();
      resolve(providers.map((p: any) => ({
        code: p.code ?? p.providerCode,
        name: p.name ?? p.providerName,
      })));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.newsProviders, onProviders);
    };

    conn.api.on(EventName.newsProviders, onProviders);
    conn.api.reqNewsProviders();
  }));
}

export async function newsBulletinsSubscribe(allMessages = true): Promise<{ subscription_id: string }> {
  const conn = getConnection();
  conn.ensureConnected();

  const subscriptionId = uuid();
  const reqId = conn.nextReqId();

  const onBulletin = (msgId: number, msgType: number, message: string, origExchange: string) => {
    eventBus.emit('news_bulletin', {
      subscription_id: subscriptionId,
      event_type: 'news_bulletin',
      event_time: new Date().toISOString(),
      sequence: msgId,
      payload: { msgId, msgType, message, origExchange },
    });
  };

  conn.api.on(EventName.updateNewsBulletin, onBulletin);
  conn.api.reqNewsBulletins(allMessages);
  conn.registerSubscription(subscriptionId, reqId, 'news_bulletins');

  return { subscription_id: subscriptionId };
}

export async function newsBulletinsUnsubscribe(): Promise<{ cancelled: boolean }> {
  const conn = getConnection();
  try { conn.api.cancelNewsBulletins(); } catch { /* noop */ }

  // Remove all news bulletin subscriptions
  const subs = conn.getActiveSubscriptions();
  for (const [id, sub] of subs) {
    if (sub.type === 'news_bulletins') {
      conn.removeSubscription(id);
    }
  }
  return { cancelled: true };
}

export async function newsHeadlines(
  contract?: ContractInput,
  providerCodes?: string[],
  startDateTime?: string,
  endDateTime?: string,
  maxResults = 100,
): Promise<Record<string, unknown>[]> {
  const conn = getConnection();
  conn.ensureConnected();

  const conId = contract?.conId;
  if (!conId && !providerCodes?.length) {
    throw new AppError('VALIDATION_ERROR', 'Either contract with conId or providerCodes is required');
  }

  return conn.enqueue(() => new Promise<Record<string, unknown>[]>((resolve) => {
    const reqId = conn.nextReqId();
    const headlines: Record<string, unknown>[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      resolve(headlines);
    }, 15000);

    const onHeadline = (rId: number, time: number, providerCode: string, articleId: string, headline: string) => {
      if (rId !== reqId) return;
      headlines.push({
        time: new Date(time * 1000).toISOString(),
        providerCode,
        articleId,
        headline,
      });
    };

    const onEnd = (rId: number, _hasMore: boolean) => {
      if (rId !== reqId) return;
      cleanup();
      resolve(headlines);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.historicalNews, onHeadline);
      conn.api.off(EventName.historicalNewsEnd, onEnd);
    };

    conn.api.on(EventName.historicalNews, onHeadline as any);
    conn.api.on(EventName.historicalNewsEnd, onEnd as any);
    conn.api.reqHistoricalNews(
      reqId,
      conId ?? 0,
      providerCodes?.join('+') ?? '',
      startDateTime ?? '',
      endDateTime ?? '',
      maxResults,
      [],
    );
  }));
}

export async function newsArticle(providerCode: string, articleId: string): Promise<Record<string, unknown>> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>>((resolve, reject) => {
    const reqId = conn.nextReqId();
    const timeout = setTimeout(() => {
      cleanup();
      reject(new AppError('TIMEOUT', 'News article request timed out'));
    }, 15000);

    const onArticle = (rId: number, articleType: number, articleText: string) => {
      if (rId !== reqId) return;
      cleanup();
      resolve({ providerCode, articleId, articleType, articleText });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.newsArticle, onArticle);
    };

    conn.api.on(EventName.newsArticle, onArticle);
    conn.api.reqNewsArticle(reqId, providerCode, articleId, []);
  }));
}

export async function historicalNews(
  conId: number,
  providerCodes: string[],
  startDateTime: string,
  endDateTime: string,
  maxResults = 100,
): Promise<Record<string, unknown>[]> {
  return newsHeadlines({ conId, symbol: '', secType: 'STK', exchange: 'SMART', currency: 'USD' }, providerCodes, startDateTime, endDateTime, maxResults);
}
