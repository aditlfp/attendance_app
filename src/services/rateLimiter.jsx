class RateLimiter {
  constructor(maxAttempts = 6, windowMs = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = new Map();
  }

  isAllowed(userId) {
    const now = Date.now();
    const userAttempts = this.attempts.get(userId) || [];
    
    // Filter out attempts older than the window
    const validAttempts = userAttempts.filter(time => now - time < this.windowMs);
    
    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    validAttempts.push(now);
    this.attempts.set(userId, validAttempts);
    return true;
  }

  getRemainingAttempts(userId) {
    const now = Date.now();
    const userAttempts = this.attempts.get(userId) || [];
    const validAttempts = userAttempts.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxAttempts - validAttempts.length);
  }

  reset(userId) {
    this.attempts.delete(userId);
  }
}

export default new RateLimiter();