import { createClient } from 'redis';

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (error) => console.error('Error en Cliente Redis:', error.message));

if (!redisClient.isOpen) {
  await redisClient.connect();
}
