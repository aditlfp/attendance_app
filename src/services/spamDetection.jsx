import rateLimiter from './rateLimiter';

class SpamDetection {
  constructor() {
    this.recentAttempts = new Map();
    this.suspiciousUsers = new Set();
    this.blockDuration = 15 * 60 * 1000; // 15 minutes block
  }

  checkForSpam(userId, action) {
    // Check rate limiting
    if (!rateLimiter.isAllowed(userId)) {
      return {
        isSpam: true,
        reason: 'Too many attempts. Please try again later.',
        block: true
      };
    }

    // Check for rapid successive attempts
    const now = Date.now();
    const userAttempts = this.recentAttempts.get(userId) || [];
    
    // Filter attempts from the last 5 seconds
    const recentAttempts = userAttempts.filter(attempt => now - attempt.timestamp < 5000);
    
    if (recentAttempts.length >= 3) {
      this.blockUser(userId);
      return {
        isSpam: true,
        reason: 'Too many rapid attempts. Account temporarily blocked.',
        block: true
      };
    }

    // Record this attempt
    recentAttempts.push({ timestamp: now, action });
    this.recentAttempts.set(userId, recentAttempts);

    // Check if user is already blocked
    if (this.suspiciousUsers.has(userId)) {
      return {
        isSpam: true,
        reason: 'Your account is temporarily blocked due to suspicious activity.',
        block: true
      };
    }

    return { isSpam: false };
  }

  blockUser(userId) {
    this.suspiciousUsers.add(userId);
    // Unblock after block duration
    setTimeout(() => {
      this.suspiciousUsers.delete(userId);
      rateLimiter.reset(userId);
    }, this.blockDuration);
  }

  getRemainingAttempts(userId) {
    return rateLimiter.getRemainingAttempts(userId);
  }
}

export default new SpamDetection();