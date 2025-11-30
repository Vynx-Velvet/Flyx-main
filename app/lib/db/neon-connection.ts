/**
 * Neon Serverless Database Connection
 * Uses Neon PostgreSQL for production and SQLite for local development
 */

import { neon } from '@neondatabase/serverless';
import * as path from 'path';
import * as fs from 'fs';

// Database interface for consistent API
interface DatabaseAdapter {
  query(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string, params?: any[]): Promise<any>;
  close(): void;
}

// Neon PostgreSQL adapter
class NeonAdapter implements DatabaseAdapter {
  private sql: any;

  constructor(connectionString: string) {
    this.sql = neon(connectionString);
  }

  private createTemplateString(sql: string): any {
    // Create a proper template literal for Neon
    const templateStrings = [sql];
    (templateStrings as any).raw = [sql];
    return templateStrings;
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (params.length === 0) {
      // For DDL statements without parameters, use template literal
      const templateStrings = this.createTemplateString(sql);
      return await this.sql(templateStrings);
    }
    // Use neon's query method for parameterized queries
    return await this.sql.query(sql, params);
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (params.length === 0) {
      // For DDL statements without parameters, use template literal
      const templateStrings = this.createTemplateString(sql);
      return await this.sql(templateStrings);
    }
    // Use neon's query method for parameterized queries
    const result = await this.sql.query(sql, params);
    return result;
  }

  close(): void {
    // Neon connections are automatically managed
  }
}

// SQLite adapter for local development
class SQLiteAdapter implements DatabaseAdapter {
  private db: any;

  constructor(dbPath: string) {
    // Dynamic import based on runtime
    let Database: any;
    if (typeof Bun !== 'undefined') {
      const { Database: BunDatabase } = require('bun:sqlite');
      Database = BunDatabase;
    } else {
      Database = require('better-sqlite3');
    }

    this.db = new Database(dbPath);

    // Configure SQLite
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  close(): void {
    this.db.close();
  }
}

class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private adapter: DatabaseAdapter | null = null;
  private isInitialized = false;
  private isNeon = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() { }

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized && this.adapter) {
      return;
    }

    // Prevent race conditions with a promise lock
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        // Check for Neon connection string
        const neonConnectionString = process.env.DATABASE_URL;

        if (neonConnectionString && neonConnectionString.includes('neon.tech')) {
          // Use Neon for production
          console.log('Initializing Neon PostgreSQL connection...');
          this.adapter = new NeonAdapter(neonConnectionString);
          this.isNeon = true;

          // Create PostgreSQL tables
          await this.createPostgreSQLTables();

          console.log('✓ Neon PostgreSQL database initialized successfully');
        } else {
          // Use SQLite for local development
          console.log('Initializing SQLite for local development...');
          const dbDir = path.join(process.cwd(), 'data');

          try {
            if (!fs.existsSync(dbDir)) {
              fs.mkdirSync(dbDir, { recursive: true });
            }
          } catch (error) {
            console.warn('Cannot create data directory, using in-memory SQLite');
          }

          const dbPath = fs.existsSync(dbDir)
            ? path.join(dbDir, 'analytics.db')
            : ':memory:';

          this.adapter = new SQLiteAdapter(dbPath);
          this.isNeon = false;

          // Create SQLite tables
          await this.createSQLiteTables();

          console.log('✓ SQLite database initialized successfully');
        }

        this.isInitialized = true;
      } catch (error) {
        console.error('Failed to initialize database:', error);
        this.initializationPromise = null; // Reset promise on failure so we can try again
        throw new Error(`Database initialization failed: ${error}`);
      }
    })();

    return this.initializationPromise;
  }

  private async createPostgreSQLTables(): Promise<void> {
    if (!this.adapter) throw new Error('Database adapter not initialized');

    const tables = [
      // Schema migrations table
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at BIGINT
      )`,

      // Analytics events table
      `CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        event_type TEXT NOT NULL,
        metadata JSONB NOT NULL,
        created_at BIGINT
      )`,

      // Content stats table
      `CREATE TABLE IF NOT EXISTS content_stats (
        content_id TEXT PRIMARY KEY,
        content_type TEXT NOT NULL,
        view_count INTEGER DEFAULT 0,
        total_watch_time INTEGER DEFAULT 0,
        completion_rate REAL DEFAULT 0,
        avg_watch_time REAL DEFAULT 0,
        last_viewed BIGINT,
        updated_at BIGINT
      )`,

      // Admin users table
      `CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at BIGINT,
        last_login BIGINT
      )`,

      // Daily metrics table
      `CREATE TABLE IF NOT EXISTS metrics_daily (
        date TEXT PRIMARY KEY,
        total_views INTEGER DEFAULT 0,
        total_watch_time INTEGER DEFAULT 0,
        unique_sessions INTEGER DEFAULT 0,
        avg_session_duration REAL DEFAULT 0,
        top_content TEXT,
        updated_at BIGINT
      )`,

      // Watch sessions table - detailed tracking
      `CREATE TABLE IF NOT EXISTS watch_sessions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_title TEXT,
        season_number INTEGER,
        episode_number INTEGER,
        started_at BIGINT NOT NULL,
        ended_at BIGINT,
        total_watch_time INTEGER DEFAULT 0,
        last_position INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        completion_percentage REAL DEFAULT 0,
        quality TEXT,
        device_type TEXT,
        is_completed BOOLEAN DEFAULT FALSE,
        pause_count INTEGER DEFAULT 0,
        seek_count INTEGER DEFAULT 0,
        created_at BIGINT,
        updated_at BIGINT
      )`,

      // User activity tracking
      `CREATE TABLE IF NOT EXISTS user_activity (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        first_seen BIGINT NOT NULL,
        last_seen BIGINT NOT NULL,
        total_sessions INTEGER DEFAULT 1,
        total_watch_time INTEGER DEFAULT 0,
        device_type TEXT,
        user_agent TEXT,
        country TEXT,
        city TEXT,
        region TEXT,
        created_at BIGINT,
        updated_at BIGINT
      )`,

      // Daily user metrics
      `CREATE TABLE IF NOT EXISTS daily_user_metrics (
        date TEXT PRIMARY KEY,
        daily_active_users INTEGER DEFAULT 0,
        new_users INTEGER DEFAULT 0,
        returning_users INTEGER DEFAULT 0,
        total_sessions INTEGER DEFAULT 0,
        total_watch_time INTEGER DEFAULT 0,
        avg_session_duration REAL DEFAULT 0,
        unique_content_views INTEGER DEFAULT 0,
        updated_at BIGINT
      )`,

      // Users table (missing in original schema)
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        username TEXT,
        image TEXT,
        created_at BIGINT,
        updated_at BIGINT
      )`,

      // Live activity tracking
      `CREATE TABLE IF NOT EXISTS live_activity (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        content_id TEXT,
        content_title TEXT,
        content_type TEXT,
        season_number INTEGER,
        episode_number INTEGER,
        current_position INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        quality TEXT,
        device_type TEXT,
        country TEXT,
        city TEXT,
        region TEXT,
        started_at BIGINT NOT NULL,
        last_heartbeat BIGINT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at BIGINT,
        updated_at BIGINT
      )`
    ];

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON analytics_events(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_content_stats_type ON content_stats(content_type)',
      'CREATE INDEX IF NOT EXISTS idx_content_stats_views ON content_stats(view_count DESC)',
      'CREATE INDEX IF NOT EXISTS idx_admin_username ON admin_users(username)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_user ON watch_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_content ON watch_sessions(content_id)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_started ON watch_sessions(started_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_session ON watch_sessions(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_activity_first_seen ON user_activity(first_seen)',
      'CREATE INDEX IF NOT EXISTS idx_user_activity_last_seen ON user_activity(last_seen DESC)',
      'CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_user_metrics(date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_live_activity_user ON live_activity(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_activity_session ON live_activity(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_activity_heartbeat ON live_activity(last_heartbeat DESC)',
      'CREATE INDEX IF NOT EXISTS idx_live_activity_active ON live_activity(is_active, last_heartbeat DESC)'
    ];

    for (const table of tables) {
      await this.adapter.execute(table);
    }

    for (const index of indexes) {
      await this.adapter.execute(index);
    }

    // Insert initial schema version if not exists
    const existingVersion = await this.adapter.query(
      'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1'
    );

    if (existingVersion.length === 0) {
      await this.adapter.execute(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [1, 'initial_schema']
      );
    }
    
    // Run migrations for new columns (v2 - geo columns)
    await this.runPostgreSQLMigrations();
  }
  
  private async runPostgreSQLMigrations(): Promise<void> {
    if (!this.adapter) return;
    
    // Migration v2: Add city and region columns to user_activity and live_activity
    try {
      // Check if city column exists in user_activity
      const userActivityColumns = await this.adapter.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'user_activity' AND column_name = 'city'
      `);
      
      if (userActivityColumns.length === 0) {
        console.log('Running migration: Adding geo columns to user_activity...');
        await this.adapter.execute('ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS city TEXT');
        await this.adapter.execute('ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS region TEXT');
      }
      
      // Check if city column exists in live_activity
      const liveActivityColumns = await this.adapter.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'live_activity' AND column_name = 'city'
      `);
      
      if (liveActivityColumns.length === 0) {
        console.log('Running migration: Adding geo columns to live_activity...');
        await this.adapter.execute('ALTER TABLE live_activity ADD COLUMN IF NOT EXISTS city TEXT');
        await this.adapter.execute('ALTER TABLE live_activity ADD COLUMN IF NOT EXISTS region TEXT');
      }
      
      console.log('✓ Geo column migrations complete');
    } catch (migrationError) {
      console.warn('Migration warning (may be safe to ignore):', migrationError);
    }
  }

  private async createSQLiteTables(): Promise<void> {
    if (!this.adapter) throw new Error('Database adapter not initialized');

    const tables = [
      // Schema migrations table
      `CREATE TABLE IF NOT EXISTS schema_migrations(
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER DEFAULT(strftime('%s', 'now'))
      )`,

      // Analytics events table
      `CREATE TABLE IF NOT EXISTS analytics_events(
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at INTEGER DEFAULT(strftime('%s', 'now'))
      )`,

      // Content stats table
      `CREATE TABLE IF NOT EXISTS content_stats(
        content_id TEXT PRIMARY KEY,
        content_type TEXT NOT NULL,
        view_count INTEGER DEFAULT 0,
        total_watch_time INTEGER DEFAULT 0,
        completion_rate REAL DEFAULT 0,
        avg_watch_time REAL DEFAULT 0,
        last_viewed INTEGER,
        updated_at INTEGER DEFAULT(strftime('%s', 'now'))
      )`,

      // Admin users table
      `CREATE TABLE IF NOT EXISTS admin_users(
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER DEFAULT(strftime('%s', 'now')),
        last_login INTEGER
      )`,

      // Daily metrics table
      `CREATE TABLE IF NOT EXISTS metrics_daily(
        date TEXT PRIMARY KEY,
        total_views INTEGER DEFAULT 0,
        total_watch_time INTEGER DEFAULT 0,
        unique_sessions INTEGER DEFAULT 0,
        avg_session_duration REAL DEFAULT 0,
        top_content TEXT,
        updated_at INTEGER DEFAULT(strftime('%s', 'now'))
      )`,

      // Watch sessions table - detailed tracking
      `CREATE TABLE IF NOT EXISTS watch_sessions(
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_title TEXT,
        season_number INTEGER,
        episode_number INTEGER,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        total_watch_time INTEGER DEFAULT 0,
        last_position INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        completion_percentage REAL DEFAULT 0,
        quality TEXT,
        device_type TEXT,
        is_completed INTEGER DEFAULT 0,
        pause_count INTEGER DEFAULT 0,
        seek_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT(strftime('%s', 'now')),
        updated_at INTEGER DEFAULT(strftime('%s', 'now'))
      )`,

      // User activity tracking
      `CREATE TABLE IF NOT EXISTS user_activity(
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        total_sessions INTEGER DEFAULT 1,
        total_watch_time INTEGER DEFAULT 0,
        device_type TEXT,
        user_agent TEXT,
        country TEXT,
        city TEXT,
        region TEXT,
        created_at INTEGER DEFAULT(strftime('%s', 'now')),
        updated_at INTEGER DEFAULT(strftime('%s', 'now'))
      )`,

      // Daily user metrics
      `CREATE TABLE IF NOT EXISTS daily_user_metrics(
        date TEXT PRIMARY KEY,
        daily_active_users INTEGER DEFAULT 0,
        new_users INTEGER DEFAULT 0,
        returning_users INTEGER DEFAULT 0,
        total_sessions INTEGER DEFAULT 0,
        total_watch_time INTEGER DEFAULT 0,
        avg_session_duration REAL DEFAULT 0,
        unique_content_views INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT(strftime('%s', 'now'))
      )`,

      // Users table (missing in original schema)
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        username TEXT,
        image TEXT,
        created_at INTEGER DEFAULT(strftime('%s', 'now')),
        updated_at INTEGER DEFAULT(strftime('%s', 'now'))
      )`,

      // Live activity tracking
      `CREATE TABLE IF NOT EXISTS live_activity(
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        content_id TEXT,
        content_title TEXT,
        content_type TEXT,
        season_number INTEGER,
        episode_number INTEGER,
        current_position INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        quality TEXT,
        device_type TEXT,
        country TEXT,
        city TEXT,
        region TEXT,
        started_at INTEGER NOT NULL,
        last_heartbeat INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT(strftime('%s', 'now')),
        updated_at INTEGER DEFAULT(strftime('%s', 'now'))
      )`
    ];

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON analytics_events(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_content_stats_type ON content_stats(content_type)',
      'CREATE INDEX IF NOT EXISTS idx_content_stats_views ON content_stats(view_count DESC)',
      'CREATE INDEX IF NOT EXISTS idx_admin_username ON admin_users(username)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_user ON watch_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_content ON watch_sessions(content_id)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_started ON watch_sessions(started_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_session ON watch_sessions(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_activity_first_seen ON user_activity(first_seen)',
      'CREATE INDEX IF NOT EXISTS idx_user_activity_last_seen ON user_activity(last_seen DESC)',
      'CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_user_metrics(date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_live_activity_user ON live_activity(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_activity_session ON live_activity(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_live_activity_heartbeat ON live_activity(last_heartbeat DESC)',
      'CREATE INDEX IF NOT EXISTS idx_live_activity_active ON live_activity(is_active, last_heartbeat DESC)'
    ];

    for (const table of tables) {
      await this.adapter.execute(table);
    }

    for (const index of indexes) {
      await this.adapter.execute(index);
    }

    // Insert initial schema version if not exists
    const existingVersion = await this.adapter.query(
      'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1'
    );

    if (existingVersion.length === 0) {
      await this.adapter.execute(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
        [1, 'initial_schema']
      );
    }
    
    // Run migrations for new columns
    await this.runSQLiteMigrations();
  }
  
  private async runSQLiteMigrations(): Promise<void> {
    if (!this.adapter) return;
    
    // Migration v2: Add city and region columns to user_activity and live_activity
    try {
      // Check if city column exists in user_activity
      const userActivityInfo = await this.adapter.query(`PRAGMA table_info(user_activity)`);
      const hasUserActivityCity = userActivityInfo.some((col: any) => col.name === 'city');
      
      if (!hasUserActivityCity) {
        console.log('Running SQLite migration: Adding geo columns to user_activity...');
        await this.adapter.execute('ALTER TABLE user_activity ADD COLUMN city TEXT');
        await this.adapter.execute('ALTER TABLE user_activity ADD COLUMN region TEXT');
      }
      
      // Check if city column exists in live_activity
      const liveActivityInfo = await this.adapter.query(`PRAGMA table_info(live_activity)`);
      const hasLiveActivityCity = liveActivityInfo.some((col: any) => col.name === 'city');
      
      if (!hasLiveActivityCity) {
        console.log('Running SQLite migration: Adding geo columns to live_activity...');
        await this.adapter.execute('ALTER TABLE live_activity ADD COLUMN city TEXT');
        await this.adapter.execute('ALTER TABLE live_activity ADD COLUMN region TEXT');
      }
      
      console.log('✓ SQLite geo column migrations complete');
    } catch (migrationError) {
      console.warn('SQLite migration warning (may be safe to ignore):', migrationError);
    }
  }

  getAdapter(): DatabaseAdapter {
    if (!this.adapter || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.adapter;
  }

  isUsingNeon(): boolean {
    return this.isNeon;
  }

  async insertAnalyticsEvent(event: {
    id: string;
    sessionId: string;
    timestamp: number;
    eventType: string;
    metadata: any;
  }): Promise<void> {
    const adapter = this.getAdapter();

    if (this.isNeon) {
      await adapter.execute(
        'INSERT INTO analytics_events (id, session_id, timestamp, event_type, metadata) VALUES ($1, $2, $3, $4, $5)',
        [event.id, event.sessionId, event.timestamp, event.eventType, JSON.stringify(event.metadata)]
      );
    } else {
      await adapter.execute(
        'INSERT INTO analytics_events (id, session_id, timestamp, event_type, metadata) VALUES (?, ?, ?, ?, ?)',
        [event.id, event.sessionId, event.timestamp, event.eventType, JSON.stringify(event.metadata)]
      );
    }
  }

  async getAnalyticsOverview(startTime: number, endTime: number): Promise<any> {
    const adapter = this.getAdapter();

    if (this.isNeon) {
      const [views, watchTime, sessions] = await Promise.all([
        adapter.query(
          "SELECT COUNT(*) as count FROM analytics_events WHERE timestamp BETWEEN $1 AND $2 AND event_type = 'content_view'",
          [startTime, endTime]
        ),
        adapter.query(
          "SELECT SUM(CAST(metadata->>'watch_time' AS INTEGER)) as total FROM analytics_events WHERE timestamp BETWEEN $1 AND $2 AND event_type = 'watch_progress' AND metadata->>'watch_time' IS NOT NULL",
          [startTime, endTime]
        ),
        adapter.query(
          'SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE timestamp BETWEEN $1 AND $2',
          [startTime, endTime]
        )
      ]);

      return {
        totalViews: views[0]?.count || 0,
        totalWatchTime: Math.round((watchTime[0]?.total || 0) / 60),
        uniqueSessions: sessions[0]?.count || 0,
        avgSessionDuration: 0 // Calculate separately if needed
      };
    } else {
      const [views, watchTime, sessions] = await Promise.all([
        adapter.query(
          "SELECT COUNT(*) as count FROM analytics_events WHERE timestamp BETWEEN ? AND ? AND event_type = 'content_view'",
          [startTime, endTime]
        ),
        adapter.query(
          "SELECT SUM(CAST(JSON_EXTRACT(metadata, '$.watch_time') AS INTEGER)) as total FROM analytics_events WHERE timestamp BETWEEN ? AND ? AND event_type = 'watch_progress' AND JSON_EXTRACT(metadata, '$.watch_time') IS NOT NULL",
          [startTime, endTime]
        ),
        adapter.query(
          'SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE timestamp BETWEEN ? AND ?',
          [startTime, endTime]
        )
      ]);

      return {
        totalViews: views[0]?.count || 0,
        totalWatchTime: Math.round((watchTime[0]?.total || 0) / 60),
        uniqueSessions: sessions[0]?.count || 0,
        avgSessionDuration: 0 // Calculate separately if needed
      };
    }
  }

  async upsertWatchSession(session: {
    id: string;
    sessionId: string;
    userId: string;
    contentId: string;
    contentType: string;
    contentTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    startedAt: number;
    endedAt?: number;
    totalWatchTime: number;
    lastPosition: number;
    duration: number;
    completionPercentage: number;
    quality?: string;
    deviceType?: string;
    isCompleted: boolean;
    pauseCount: number;
    seekCount: number;
  }): Promise<void> {
    const adapter = this.getAdapter();
    const now = Date.now();

    if (this.isNeon) {
      await adapter.execute(`
        INSERT INTO watch_sessions(
        id, session_id, user_id, content_id, content_type, content_title,
        season_number, episode_number, started_at, ended_at, total_watch_time,
        last_position, duration, completion_percentage, quality, device_type,
        is_completed, pause_count, seek_count, created_at, updated_at
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT(id) DO UPDATE SET
          ended_at = $22,
      total_watch_time = $23,
      last_position = $24,
      completion_percentage = $25,
      is_completed = $26,
      pause_count = $27,
      seek_count = $28,
      updated_at = $29
        `, [
        session.id, session.sessionId, session.userId, session.contentId, session.contentType,
        session.contentTitle || null, session.seasonNumber || null, session.episodeNumber || null,
        session.startedAt, session.endedAt || null, session.totalWatchTime, session.lastPosition,
        session.duration, session.completionPercentage, session.quality || null, session.deviceType || null,
        session.isCompleted, session.pauseCount, session.seekCount, now, now,
        // Update values
        session.endedAt || null, session.totalWatchTime, session.lastPosition,
        session.completionPercentage, session.isCompleted, session.pauseCount, session.seekCount, now
      ]);
    } else {
      await adapter.execute(`
        INSERT INTO watch_sessions(
          id, session_id, user_id, content_id, content_type, content_title,
          season_number, episode_number, started_at, ended_at, total_watch_time,
          last_position, duration, completion_percentage, quality, device_type,
          is_completed, pause_count, seek_count, created_at, updated_at
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
          ended_at = ?,
      total_watch_time = ?,
      last_position = ?,
      completion_percentage = ?,
      is_completed = ?,
      pause_count = ?,
      seek_count = ?,
      updated_at = ?
        `, [
        session.id, session.sessionId, session.userId, session.contentId, session.contentType,
        session.contentTitle || null, session.seasonNumber || null, session.episodeNumber || null,
        session.startedAt, session.endedAt || null, session.totalWatchTime, session.lastPosition,
        session.duration, session.completionPercentage, session.quality || null, session.deviceType || null,
        session.isCompleted ? 1 : 0, session.pauseCount, session.seekCount, now, now,
        // Update values
        session.endedAt || null, session.totalWatchTime, session.lastPosition,
        session.completionPercentage, session.isCompleted ? 1 : 0, session.pauseCount, session.seekCount, now
      ]);
    }
  }

  async getWatchSessions(filters?: {
    userId?: string;
    contentId?: string;
    startDate?: number;
    endDate?: number;
    limit?: number;
  }): Promise<any[]> {
    const adapter = this.getAdapter();
    let query = 'SELECT * FROM watch_sessions WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.userId) {
      query += this.isNeon ? ` AND user_id = $${paramIndex++}` : ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters?.contentId) {
      query += this.isNeon ? ` AND content_id = $${paramIndex++} ` : ' AND content_id = ?';
      params.push(filters.contentId);
    }

    if (filters?.startDate) {
      query += this.isNeon ? ` AND started_at >= $${paramIndex++} ` : ' AND started_at >= ?';
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += this.isNeon ? ` AND started_at <= $${paramIndex++} ` : ' AND started_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY started_at DESC';

    if (filters?.limit) {
      query += this.isNeon ? ` LIMIT $${paramIndex++} ` : ' LIMIT ?';
      params.push(filters.limit);
    }

    return await adapter.query(query, params);
  }

  async upsertUserActivity(activity: {
    userId: string;
    sessionId: string;
    deviceType?: string;
    userAgent?: string;
    country?: string;
    city?: string;
    region?: string;
    watchTime?: number;
  }): Promise<void> {
    const adapter = this.getAdapter();
    const now = Date.now();
    const id = `ua_${activity.userId}_${activity.sessionId}`;

    if (this.isNeon) {
      await adapter.execute(`
        INSERT INTO user_activity(
          id, user_id, session_id, first_seen, last_seen, total_sessions,
          total_watch_time, device_type, user_agent, country, city, region, created_at, updated_at
        ) VALUES($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT(id) DO UPDATE SET
          last_seen = $14,
          total_sessions = user_activity.total_sessions + 1,
          total_watch_time = user_activity.total_watch_time + $15,
          country = COALESCE($16, user_activity.country),
          city = COALESCE($17, user_activity.city),
          region = COALESCE($18, user_activity.region),
          updated_at = $19
      `, [
        id, activity.userId, activity.sessionId, now, now, activity.watchTime || 0,
        activity.deviceType || null, activity.userAgent || null, activity.country || null,
        activity.city || null, activity.region || null, now, now,
        // Update values
        now, activity.watchTime || 0, activity.country || null, activity.city || null, 
        activity.region || null, now
      ]);
    } else {
      await adapter.execute(`
        INSERT INTO user_activity(
          id, user_id, session_id, first_seen, last_seen, total_sessions,
          total_watch_time, device_type, user_agent, country, city, region, created_at, updated_at
        ) VALUES(?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          last_seen = ?,
          total_sessions = total_sessions + 1,
          total_watch_time = total_watch_time + ?,
          country = COALESCE(?, country),
          city = COALESCE(?, city),
          region = COALESCE(?, region),
          updated_at = ?
      `, [
        id, activity.userId, activity.sessionId, now, now, activity.watchTime || 0,
        activity.deviceType || null, activity.userAgent || null, activity.country || null,
        activity.city || null, activity.region || null, now, now,
        // Update values
        now, activity.watchTime || 0, activity.country || null, activity.city || null,
        activity.region || null, now
      ]);
    }
  }

  async getUserMetrics(timeRange: { start: number; end: number }): Promise<{
    dau: number;
    wau: number;
    mau: number;
    newUsers: number;
    returningUsers: number;
    totalSessions: number;
    avgSessionDuration: number;
  }> {
    const adapter = this.getAdapter();
    const { start, end } = timeRange;

    // Calculate DAU (users active in last 24 hours)
    const dauQuery = this.isNeon
      ? 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= $1'
      : 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= ?';
    const dauResult = await adapter.query(dauQuery, [end - 24 * 60 * 60 * 1000]);
    const dau = dauResult[0]?.count || 0;

    // Calculate WAU (users active in last 7 days)
    const wauQuery = this.isNeon
      ? 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= $1'
      : 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= ?';
    const wauResult = await adapter.query(wauQuery, [end - 7 * 24 * 60 * 60 * 1000]);
    const wau = wauResult[0]?.count || 0;

    // Calculate MAU (users active in last 30 days)
    const mauQuery = this.isNeon
      ? 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= $1'
      : 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= ?';
    const mauResult = await adapter.query(mauQuery, [end - 30 * 24 * 60 * 60 * 1000]);
    const mau = mauResult[0]?.count || 0;

    // Calculate new users (first seen in time range)
    const newUsersQuery = this.isNeon
      ? 'SELECT COUNT(*) as count FROM user_activity WHERE first_seen BETWEEN $1 AND $2'
      : 'SELECT COUNT(*) as count FROM user_activity WHERE first_seen BETWEEN ? AND ?';
    const newUsersResult = await adapter.query(newUsersQuery, [start, end]);
    const newUsers = newUsersResult[0]?.count || 0;

    // Calculate returning users (first seen before range, active in range)
    const returningQuery = this.isNeon
      ? 'SELECT COUNT(*) as count FROM user_activity WHERE first_seen < $1 AND last_seen BETWEEN $2 AND $3'
      : 'SELECT COUNT(*) as count FROM user_activity WHERE first_seen < ? AND last_seen BETWEEN ? AND ?';
    const returningResult = await adapter.query(returningQuery, [start, start, end]);
    const returningUsers = returningResult[0]?.count || 0;

    // Calculate total sessions in range
    const sessionsQuery = this.isNeon
      ? 'SELECT COUNT(*) as count, COALESCE(SUM(total_watch_time), 0) as total_time FROM watch_sessions WHERE started_at BETWEEN $1 AND $2'
      : 'SELECT COUNT(*) as count, COALESCE(SUM(total_watch_time), 0) as total_time FROM watch_sessions WHERE started_at BETWEEN ? AND ?';
    const sessionsResult = await adapter.query(sessionsQuery, [start, end]);
    const totalSessions = sessionsResult[0]?.count || 0;
    const totalTime = sessionsResult[0]?.total_time || 0;
    const avgSessionDuration = totalSessions > 0 ? Math.round(totalTime / totalSessions) : 0;

    return {
      dau,
      wau,
      mau,
      newUsers,
      returningUsers,
      totalSessions,
      avgSessionDuration,
    };
  }

  async getDailyMetrics(days: number = 30): Promise<any[]> {
    const adapter = this.getAdapter();
    const query = this.isNeon
      ? 'SELECT * FROM daily_user_metrics ORDER BY date DESC LIMIT $1'
      : 'SELECT * FROM daily_user_metrics ORDER BY date DESC LIMIT ?';
    return await adapter.query(query, [days]);
  }

  async upsertLiveActivity(activity: {
    id: string;
    userId: string;
    sessionId: string;
    activityType: string;
    contentId?: string;
    contentTitle?: string;
    contentType?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    currentPosition?: number;
    duration?: number;
    quality?: string;
    deviceType?: string;
    country?: string;
    city?: string;
    region?: string;
  }): Promise<void> {
    const adapter = this.getAdapter();
    const now = Date.now();

    if (this.isNeon) {
      await adapter.execute(`
        INSERT INTO live_activity(
          id, user_id, session_id, activity_type, content_id, content_title,
          content_type, season_number, episode_number, current_position, duration,
          quality, device_type, country, city, region, started_at, last_heartbeat, is_active,
          created_at, updated_at
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, TRUE, $19, $20)
        ON CONFLICT(id) DO UPDATE SET
          activity_type = $21,
          content_id = $22,
          content_title = $23,
          current_position = $24,
          duration = $25,
          quality = $26,
          country = COALESCE($27, live_activity.country),
          city = COALESCE($28, live_activity.city),
          region = COALESCE($29, live_activity.region),
          last_heartbeat = $30,
          is_active = TRUE,
          updated_at = $31
      `, [
        activity.id, activity.userId, activity.sessionId, activity.activityType,
        activity.contentId || null, activity.contentTitle || null, activity.contentType || null,
        activity.seasonNumber || null, activity.episodeNumber || null,
        activity.currentPosition || 0, activity.duration || 0, activity.quality || null,
        activity.deviceType || null, activity.country || null, activity.city || null, 
        activity.region || null, now, now, now, now,
        // Update values
        activity.activityType, activity.contentId || null, activity.contentTitle || null,
        activity.currentPosition || 0, activity.duration || 0, activity.quality || null,
        activity.country || null, activity.city || null, activity.region || null, now, now
      ]);
    } else {
      await adapter.execute(`
        INSERT INTO live_activity(
          id, user_id, session_id, activity_type, content_id, content_title,
          content_type, season_number, episode_number, current_position, duration,
          quality, device_type, country, city, region, started_at, last_heartbeat, is_active,
          created_at, updated_at
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          activity_type = ?,
          content_id = ?,
          content_title = ?,
          current_position = ?,
          duration = ?,
          quality = ?,
          country = COALESCE(?, country),
          city = COALESCE(?, city),
          region = COALESCE(?, region),
          last_heartbeat = ?,
          is_active = 1,
          updated_at = ?
      `, [
        activity.id, activity.userId, activity.sessionId, activity.activityType,
        activity.contentId || null, activity.contentTitle || null, activity.contentType || null,
        activity.seasonNumber || null, activity.episodeNumber || null,
        activity.currentPosition || 0, activity.duration || 0, activity.quality || null,
        activity.deviceType || null, activity.country || null, activity.city || null,
        activity.region || null, now, now, now, now,
        // Update values
        activity.activityType, activity.contentId || null, activity.contentTitle || null,
        activity.currentPosition || 0, activity.duration || 0, activity.quality || null,
        activity.country || null, activity.city || null, activity.region || null, now, now
      ]);
    }
  }

  async getLiveActivities(maxAgeMinutes: number = 5): Promise<any[]> {
    const adapter = this.getAdapter();
    const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000);

    const query = this.isNeon
      ? 'SELECT * FROM live_activity WHERE is_active = TRUE AND last_heartbeat >= $1 ORDER BY last_heartbeat DESC'
      : 'SELECT * FROM live_activity WHERE is_active = 1 AND last_heartbeat >= ? ORDER BY last_heartbeat DESC';

    return await adapter.query(query, [cutoffTime]);
  }

  async deactivateLiveActivity(id: string): Promise<void> {
    const adapter = this.getAdapter();
    const now = Date.now();

    if (this.isNeon) {
      await adapter.execute(
        'UPDATE live_activity SET is_active = FALSE, updated_at = $1 WHERE id = $2',
        [now, id]
      );
    } else {
      await adapter.execute(
        'UPDATE live_activity SET is_active = 0, updated_at = ? WHERE id = ?',
        [now, id]
      );
    }
  }

  async cleanupStaleActivities(maxAgeMinutes: number = 10): Promise<number> {
    const adapter = this.getAdapter();
    const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000);
    const now = Date.now();

    if (this.isNeon) {
      const result = await adapter.execute(
        'UPDATE live_activity SET is_active = FALSE, updated_at = $1 WHERE is_active = TRUE AND last_heartbeat < $2',
        [now, cutoffTime]
      );
      return result.rowCount || 0;
    } else {
      const result = await adapter.execute(
        'UPDATE live_activity SET is_active = 0, updated_at = ? WHERE is_active = 1 AND last_heartbeat < ?',
        [now, cutoffTime]
      );
      return result.changes || 0;
    }
  }

  async updateDailyMetrics(date: string): Promise<void> {
    const adapter = this.getAdapter();
    const now = Date.now();

    // Parse date to get timestamp range
    const dateObj = new Date(date);
    const startOfDay = dateObj.setHours(0, 0, 0, 0);
    const endOfDay = dateObj.setHours(23, 59, 59, 999);

    // Get metrics for the day
    const metrics = await this.getUserMetrics({ start: startOfDay, end: endOfDay });

    // Count unique content views
    const contentQuery = this.isNeon
      ? 'SELECT COUNT(DISTINCT content_id) as count FROM watch_sessions WHERE started_at BETWEEN $1 AND $2'
      : 'SELECT COUNT(DISTINCT content_id) as count FROM watch_sessions WHERE started_at BETWEEN ? AND ?';
    const contentResult = await adapter.query(contentQuery, [startOfDay, endOfDay]);
    const uniqueContentViews = contentResult[0]?.count || 0;

    if (this.isNeon) {
      await adapter.execute(`
        INSERT INTO daily_user_metrics(
      date, daily_active_users, new_users, returning_users, total_sessions,
      total_watch_time, avg_session_duration, unique_content_views, updated_at
    ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT(date) DO UPDATE SET
daily_active_users = $10,
  new_users = $11,
  returning_users = $12,
  total_sessions = $13,
  total_watch_time = $14,
  avg_session_duration = $15,
  unique_content_views = $16,
  updated_at = $17
    `, [
        date, metrics.dau, metrics.newUsers, metrics.returningUsers, metrics.totalSessions,
        metrics.totalSessions * metrics.avgSessionDuration, metrics.avgSessionDuration,
        uniqueContentViews, now,
        // Update values
        metrics.dau, metrics.newUsers, metrics.returningUsers, metrics.totalSessions,
        metrics.totalSessions * metrics.avgSessionDuration, metrics.avgSessionDuration,
        uniqueContentViews, now
      ]);
    } else {
      await adapter.execute(`
        INSERT INTO daily_user_metrics(
      date, daily_active_users, new_users, returning_users, total_sessions,
      total_watch_time, avg_session_duration, unique_content_views, updated_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
daily_active_users = ?,
  new_users = ?,
  returning_users = ?,
  total_sessions = ?,
  total_watch_time = ?,
  avg_session_duration = ?,
  unique_content_views = ?,
  updated_at = ?
    `, [
        date, metrics.dau, metrics.newUsers, metrics.returningUsers, metrics.totalSessions,
        metrics.totalSessions * metrics.avgSessionDuration, metrics.avgSessionDuration,
        uniqueContentViews, now,
        // Update values
        metrics.dau, metrics.newUsers, metrics.returningUsers, metrics.totalSessions,
        metrics.totalSessions * metrics.avgSessionDuration, metrics.avgSessionDuration,
        uniqueContentViews, now
      ]);
    }
  }

  close(): void {
    if (this.adapter) {
      this.adapter.close();
      this.adapter = null;
      this.isInitialized = false;
      DatabaseConnection.instance = null;
      console.log('✓ Database connection closed');
    }
  }
}

// Export singleton instance
let dbInstance: DatabaseConnection | null = null;

export const initializeDB = async () => {
  if (!dbInstance) {
    dbInstance = DatabaseConnection.getInstance();
  }
  // Always await initialize to ensure it's ready, even if instance exists
  await dbInstance.initialize();
  return dbInstance;
};

export const getDB = () => {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDB() first.');
  }
  return dbInstance;
};

export { DatabaseConnection };