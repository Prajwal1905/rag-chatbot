import { v4 as uuidv4 } from 'uuid';
import { publisher, subscriber } from '../config/redis';

const REQUEST_CHANNEL = 'ai:request';
const RESPONSE_CHANNEL = 'ai:response';

type PendingResolver = (value: any) => void;

const pendingRequests = new Map<string, PendingResolver>();

let subscribed = false;

async function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;

  await subscriber.subscribe(RESPONSE_CHANNEL, (message) => {
    try {
      const payload = JSON.parse(message);
      const { requestId } = payload;
      const resolver = pendingRequests.get(requestId);
      if (resolver) {
        resolver(payload);
        pendingRequests.delete(requestId);
      }
    } catch (err) {
      console.error('Failed to parse AI response message', err);
    }
  });
}

export async function sendAIRequest(
  type: 'chat' | 'upload' | 'delete',
  data: Record<string, any>,
  timeoutMs = Number(process.env.PYTHON_AI_TIMEOUT_MS) || 30000
): Promise<any> {
  await ensureSubscribed();

  const requestId = uuidv4();

  const payload = JSON.stringify({
    requestId,
    type,
    data,
  });

  const responsePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('AI service timed out — please ensure python-ai is running and connected to Redis'));
    }, timeoutMs);

    pendingRequests.set(requestId, (value) => {
      clearTimeout(timeout);
      resolve(value);
    });
  });

  await publisher.publish(REQUEST_CHANNEL, payload);

  return responsePromise;
}