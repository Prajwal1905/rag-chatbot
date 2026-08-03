import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';

export const publisher = createClient({ url: REDIS_URL });
export const subscriber = createClient({ url: REDIS_URL });

export async function connectRedis() {
  await publisher.connect();
  await subscriber.connect();
  console.log('Redis publisher and subscriber connected');
}