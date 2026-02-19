import Redis from 'ioredis';
import config from '../../config';

// ============================================================
// Redis Connector
// ============================================================

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db ?? 0,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });
    client.on('error', (err) => console.error('[Redis] Error:', err.message));
  }
  return client;
}

// ─── Basic Get/Set ───────────────────────────────────────────
export async function redisGet(key: string): Promise<string | null> {
  return getRedis().get(key);
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<'OK'> {
  if (ttlSeconds) {
    return getRedis().set(key, value, 'EX', ttlSeconds);
  }
  return getRedis().set(key, value);
}

export async function redisDel(key: string): Promise<number> {
  return getRedis().del(key);
}

export async function redisExists(key: string): Promise<boolean> {
  const result = await getRedis().exists(key);
  return result === 1;
}

// ─── Hash Operations ─────────────────────────────────────────
export async function redisHSet(
  key: string,
  field: string,
  value: string
): Promise<number> {
  return getRedis().hset(key, field, value);
}

export async function redisHGetAll(key: string): Promise<Record<string, string>> {
  return getRedis().hgetall(key);
}

// ─── Queue (List) ────────────────────────────────────────────
export async function queuePush(
  queueName: string,
  job: Record<string, unknown>
): Promise<number> {
  return getRedis().rpush(queueName, JSON.stringify(job));
}

export async function queuePop(
  queueName: string
): Promise<Record<string, unknown> | null> {
  const raw = await getRedis().lpop(queueName);
  return raw ? JSON.parse(raw) : null;
}

export async function queueLength(queueName: string): Promise<number> {
  return getRedis().llen(queueName);
}

export async function queuePeek(
  queueName: string,
  count = 5
): Promise<Array<Record<string, unknown>>> {
  const items = await getRedis().lrange(queueName, 0, count - 1);
  return items.map((i) => JSON.parse(i));
}

// ─── Queue Status ────────────────────────────────────────────
export async function getQueueStatus(queueName: string): Promise<{
  length: number;
  pending: Array<Record<string, unknown>>;
}> {
  const length = await queueLength(queueName);
  const pending = length > 0 ? await queuePeek(queueName, 10) : [];
  return { length, pending };
}

// ─── Pub/Sub ─────────────────────────────────────────────────
export async function publishMessage(
  channel: string,
  message: unknown
): Promise<number> {
  return getRedis().publish(channel, JSON.stringify(message));
}

export async function subscribeToChannel(
  channel: string,
  callback: (message: string) => void
): Promise<void> {
  const subscriber = getRedis().duplicate();
  await subscriber.subscribe(channel);
  subscriber.on('message', (_, message) => callback(message));
}

// ─── TTL/Expiry ──────────────────────────────────────────────
export async function getTTL(key: string): Promise<number> {
  return getRedis().ttl(key);
}

export async function redisKeys(pattern: string): Promise<string[]> {
  return getRedis().keys(pattern);
}

// ─── Session Store ───────────────────────────────────────────
export async function storeSession(
  sessionId: string,
  data: Record<string, unknown>,
  ttlSeconds = 3600
): Promise<void> {
  await redisSet(`session:${sessionId}`, JSON.stringify(data), ttlSeconds);
}

export async function getSession(
  sessionId: string
): Promise<Record<string, unknown> | null> {
  const raw = await redisGet(`session:${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}
