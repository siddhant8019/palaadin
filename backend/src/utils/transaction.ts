import { DataSource, EntityManager, QueryRunner } from "typeorm";
import { AppDataSource } from "@/data-source";
import { logger } from "@/utils/logger";
import { DatabaseError, ErrorCode } from "@/utils/errors";

/**
 * Transaction helper for safe database operations
 */
export class TransactionManager {
  private static dataSource: DataSource = AppDataSource;

  /**
   * Execute operations within a transaction
   * Automatically commits on success, rolls back on error
   */
  static async execute<T>(
    callback: (entityManager: EntityManager) => Promise<T>
  ): Promise<T> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await callback(queryRunner.manager);
      await queryRunner.commitTransaction();
      
      logger.debug("Transaction committed successfully");
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      logger.error("Transaction rolled back due to error:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new DatabaseError(
        `Transaction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ErrorCode.TRANSACTION_FAILED
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute multiple operations in parallel within a single transaction
   */
  static async executeParallel<T>(
    callbacks: Array<(entityManager: EntityManager) => Promise<T>>
  ): Promise<T[]> {
    return this.execute(async (manager) => {
      return Promise.all(callbacks.map((callback) => callback(manager)));
    });
  }

  /**
   * Execute operations in sequence within a transaction
   * Stops on first error
   */
  static async executeSequential<T>(
    callbacks: Array<(entityManager: EntityManager) => Promise<T>>
  ): Promise<T[]> {
    return this.execute(async (manager) => {
      const results: T[] = [];
      
      for (const callback of callbacks) {
        const result = await callback(manager);
        results.push(result);
      }
      
      return results;
    });
  }

  /**
   * Retry a transaction operation with exponential backoff
   */
  static async executeWithRetry<T>(
    callback: (entityManager: EntityManager) => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(callback);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          logger.warn(`Transaction failed, retrying... (attempt ${attempt + 1}/${maxRetries})`, {
            error: lastError.message,
            nextRetryIn: delay,
          });

          await this.sleep(delay);
          delay *= 2; // Exponential backoff
        }
      }
    }

    throw new DatabaseError(
      `Transaction failed after ${maxRetries} retries: ${lastError?.message}`,
      ErrorCode.TRANSACTION_FAILED
    );
  }

  /**
   * Check if a transaction is currently active
   */
  static async isTransactionActive(queryRunner: QueryRunner): Promise<boolean> {
    return queryRunner.isTransactionActive;
  }

  /**
   * Helper: Sleep for a specified duration
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Decorator for automatic transaction management
 * Usage: @Transactional()
 */
export function Transactional() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return TransactionManager.execute(async (entityManager) => {
        // Replace the first argument if it's an EntityManager
        const newArgs = args.map((arg, index) => {
          if (index === 0 && arg && typeof arg === "object" && "manager" in arg) {
            return entityManager;
          }
          return arg;
        });

        return originalMethod.apply(this, newArgs);
      });
    };

    return descriptor;
  };
}

/**
 * Batch processing with transactions
 * Processes items in batches with transaction per batch
 */
export class BatchTransactionProcessor<T, R> {
  constructor(
    private batchSize: number = 100,
    private processor: (items: T[], entityManager: EntityManager) => Promise<R[]>
  ) {}

  async process(items: T[]): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      
      const batchResults = await TransactionManager.execute(
        async (manager) => this.processor(batch, manager)
      );
      
      results.push(...batchResults);
      
      logger.info(`Processed batch ${Math.floor(i / this.batchSize) + 1}`, {
        processed: i + batch.length,
        total: items.length,
        batchSize: batch.length,
      });
    }
    
    return results;
  }
}

/**
 * Savepoint support for nested transactions
 */
export class SavepointManager {
  private static savepointCounter = 0;

  /**
   * Create a savepoint within an existing transaction
   */
  static async createSavepoint(
    queryRunner: QueryRunner
  ): Promise<string> {
    const savepointName = `sp_${++this.savepointCounter}_${Date.now()}`;
    await queryRunner.query(`SAVEPOINT ${savepointName}`);
    
    logger.debug(`Savepoint created: ${savepointName}`);
    return savepointName;
  }

  /**
   * Roll back to a specific savepoint
   */
  static async rollbackToSavepoint(
    queryRunner: QueryRunner,
    savepointName: string
  ): Promise<void> {
    await queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
    
    logger.debug(`Rolled back to savepoint: ${savepointName}`);
  }

  /**
   * Release a savepoint (commit it)
   */
  static async releaseSavepoint(
    queryRunner: QueryRunner,
    savepointName: string
  ): Promise<void> {
    await queryRunner.query(`RELEASE SAVEPOINT ${savepointName}`);
    
    logger.debug(`Savepoint released: ${savepointName}`);
  }
}

export { EntityManager, QueryRunner };

