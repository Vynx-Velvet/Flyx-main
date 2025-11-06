/**
 * Database Connection Management using Bun's built-in SQLite
 */

import { Database } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';
import { ALL_TABLES, SCHEMA_VERSION, TABLES } from './schema';

class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private db: Database | null = null;
  private dbPath: string;
  private isInitialized = false;

  private constructor() {
    // Ensure database directory exists
    const dbDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.dbPath = path.join(dbDir, 'analytics.db');
  }

  /**
   * Get singleton database instance
   */
  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Initialize database connection and schema
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.db) {
      return;
    }

    try {
      // Create database connection using Bun's SQLite
      this.db = new Database(this.dbPath);

      // Enable WAL mode for better concurrency
      this.db.exec('PRAGMA journal_mode = WAL;');
      
      // Enable foreign keys
      this.db.exec('PRAGMA foreign_keys = ON;');
      
      // Set synchronous mode for better performance
      this.db.exec('PRAGMA synchronous = NORMAL;');
      
      // Set cache size (64MB)
      this.db.exec('PRAGMA cache_size = -64000;');

      // Create all tables
      for (const tableSQL of ALL_TABLES) {
        this.db.exec(tableSQL);
      }

      // Check and update schema version
      await this.ensureSchemaVersion();

      this.isInitialized = true;
      console.log('✓ SQLite database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  /**
   * Ensure schema version is tracked
   */
  private async ensureSchemaVersion(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const existingVersion = this.db
      .prepare(`SELECT version FROM ${TABLES.SCHEMA_MIGRATIONS} ORDER BY version DESC LIMIT 1`)
      .get() as { version: number } | null;

    if (!existingVersion) {
      // First time setup
      this.db
        .prepare(`INSERT INTO ${TABLES.SCHEMA_MIGRATIONS} (version, name) VALUES (?, ?)`)
        .run(SCHEMA_VERSION, 'initial_schema');
    }
  }

  /**
   * Get database instance
   */
  getDatabase(): Database {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Execute a query with error handling
   */
  executeQuery<T = any>(query: string, params: any[] = []): T {
    try {
      const db = this.getDatabase();
      const stmt = db.prepare(query);
      return stmt.get(...params) as T;
    } catch (error) {
      console.error('Query execution failed:', error);
      throw new Error(`Query failed: ${error}`);
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  transaction<T>(callback: (db: Database) => T): T {
    const db = this.getDatabase();
    return db.transaction(() => {
      return callback(db);
    })();
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      DatabaseConnection.instance = null;
      console.log('✓ Database connection closed');
    }
  }

  /**
   * Check if database is healthy
   */
  healthCheck(): boolean {
    try {
      const db = this.getDatabase();
      const result = db.prepare('SELECT 1 as health').get() as { health: number };
      return result.health === 1;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

// Initialize and export database instance
let dbInstance: DatabaseConnection | null = null;

export const initializeDB = async () => {
  if (!dbInstance) {
    dbInstance = DatabaseConnection.getInstance();
    await dbInstance.initialize();
  }
  return dbInstance;
};

export const getDB = () => {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDB() first.');
  }
  return dbInstance.getDatabase();
};

// Export for direct access
export { DatabaseConnection };
