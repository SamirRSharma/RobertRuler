import { Redis } from '@upstash/redis';

// Shared meeting state key for WUSA
const STATE_KEY = 'wusa:roberts-rules:state';

// Create Redis client using Upstash REST credentials
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Default empty meeting state
function getDefaultState() {
  return {
    queueOnes: [],
    queueTwos: [],
    currentSpeaker: 'None',
    totalSpeakersProcessed: 0,
    // Timer state
    timerDuration1: 60,
    timerRemaining1: 60,
    timerIsRunning1: false,
    timerDuration2: 60,
    timerRemaining2: 60,
    timerIsRunning2: false,
    updatedAt: Date.now(),
  };
}

export default async function handler(req, res) {
  // Simple CORS-safe headers (mainly for local testing)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const state = (await redis.get(STATE_KEY)) || getDefaultState();
      return res.status(200).json(state);
    } catch (err) {
      console.error('Error reading state from Redis', err);
      // Fallback to an in-memory default if Redis is unreachable
      return res.status(200).json(getDefaultState());
    }
  }

  if (req.method === 'POST') {
    try {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

      const mergedState = {
        ...getDefaultState(),
        ...body,
        updatedAt: Date.now(),
      };

      await redis.set(STATE_KEY, mergedState);
      return res.status(200).json(mergedState);
    } catch (err) {
      console.error('Error writing state to Redis', err);
      return res.status(500).json({ error: 'Failed to update state' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}


