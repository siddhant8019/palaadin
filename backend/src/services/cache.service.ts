import { Redis } from "ioredis";
import { logger } from "@/utils/logger";

/**
 * Redis Cache Service for high-performance caching
 */
export class CacheService {
  private static instance: CacheService;
  private client: Redis;
  private readonly defaultTTL = 3600; // 1 hour in seconds

  private constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetError = "READONLY";
        if (err.message.includes(targetError)) {
          // Reconnect when Redis is in read-only mode
          return true;
        }
        return false;
      },
    });

    this.client.on("connect", () => {
      logger.info("Redis client connected");
    });

    this.client.on("error", (err: Error) => {
      logger.error("Redis client error:", err);
    });

    this.client.on("ready", () => {
      logger.info("Redis client ready");
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const expiryTime = ttl || this.defaultTTL;

      await this.client.setex(key, expiryTime, serialized);
      
      logger.debug(`Cached key: ${key} (TTL: ${expiryTime}s)`);
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      
      logger.debug(`Deleted cache key: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(...keys);
      
      logger.debug(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
      return keys.length;
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiry time for existing key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get or set pattern (cache-aside)
   * Automatically fetches and caches if not present
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      logger.debug(`Cache hit for key: ${key}`);
      return cached;
    }

    logger.debug(`Cache miss for key: ${key}, fetching...`);
    const value = await fetchFunction();
    
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Increment counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const result = await this.client.incrby(key, amount);
      return result;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Decrement counter
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      const result = await this.client.decrby(key, amount);
      return result;
    } catch (error) {
      logger.error(`Cache decrement error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Add item to a list
   */
  async listPush(key: string, value: any): Promise<number> {
    try {
      const serialized = JSON.stringify(value);
      const result = await this.client.rpush(key, serialized);
      return result;
    } catch (error) {
      logger.error(`Cache list push error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get all items from a list
   */
  async listGetAll<T>(key: string): Promise<T[]> {
    try {
      const items = await this.client.lrange(key, 0, -1);
      return items.map((item) => JSON.parse(item) as T);
    } catch (error) {
      logger.error(`Cache list get error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Add item to a set
   */
  async setAdd(key: string, ...values: string[]): Promise<number> {
    try {
      const result = await this.client.sadd(key, ...values);
      return result;
    } catch (error) {
      logger.error(`Cache set add error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if item is in set
   */
  async setIsMember(key: string, value: string): Promise<boolean> {
    try {
      const result = await this.client.sismember(key, value);
      return result === 1;
    } catch (error) {
      logger.error(`Cache set is member error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get all items from a set
   */
  async setGetAll(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      logger.error(`Cache set get all error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Set hash field
   */
  async hashSet(key: string, field: string, value: any): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const result = await this.client.hset(key, field, serialized);
      return result === 1;
    } catch (error) {
      logger.error(`Cache hash set error for key ${key}, field ${field}:`, error);
      return false;
    }
  }

  /**
   * Get hash field
   */
  async hashGet<T>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.client.hget(key, field);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Cache hash get error for key ${key}, field ${field}:`, error);
      return null;
    }
  }

  /**
   * Get all fields from hash
   */
  async hashGetAll<T>(key: string): Promise<Record<string, T>> {
    try {
      const hash = await this.client.hgetall(key);
      const result: Record<string, T> = {};

      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value) as T;
      }

      return result;
    } catch (error) {
      logger.error(`Cache hash get all error for key ${key}:`, error);
      return {};
    }
  }

  /**
   * Clear all cache
   * Use with caution!
   */
  async flushAll(): Promise<boolean> {
    try {
      await this.client.flushall();
      
      logger.warn("All cache flushed");
      return true;
    } catch (error) {
      logger.error("Cache flush all error:", error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keys: number;
    memory: string;
    uptime: number;
  }> {
    try {
      const info = await this.client.info();
      const dbsize = await this.client.dbsize();

      const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);

      return {
        connected: this.client.status === "ready",
        keys: dbsize,
        memory: memoryMatch ? memoryMatch[1] : "unknown",
        uptime: uptimeMatch ? parseInt(uptimeMatch[1]) : 0,
      };
    } catch (error) {
      logger.error("Cache stats error:", error);
      return {
        connected: false,
        keys: 0,
        memory: "unknown",
        uptime: 0,
      };
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
    logger.info("Redis client disconnected");
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();

/**
 * Cache key generators for consistency
 */
export const CacheKeys = {
  user: (id: string) => `user:${id}`,
  company: (id: string) => `company:${id}`,
  companyList: (filters: string) => `companies:list:${filters}`,
  person: (id: string) => `person:${id}`,
  personList: (filters: string) => `people:list:${filters}`,
  scrapingJob: (id: string) => `scraping:job:${id}`,
  searchQuery: (query: string) => `search:${Buffer.from(query).toString("base64")}`,
  session: (userId: string) => `session:${userId}`,
  rateLimit: (ip: string, endpoint: string) => `ratelimit:${ip}:${endpoint}`,
};

