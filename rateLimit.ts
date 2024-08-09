import { addRequest, getRequestCount, clearOldRequests } from './db';

const MAX_REQUESTS_PER_WEEK = 15;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class RateLimiter {
  checkAndIncrement(email: string, requestData: object): boolean {
    clearOldRequests(SEVEN_DAYS_MS);

    const currentCount = getRequestCount(email, SEVEN_DAYS_MS);

    if (currentCount >= MAX_REQUESTS_PER_WEEK) {
      return false;
    }

    addRequest(email, requestData);
    return true;
  }
}
