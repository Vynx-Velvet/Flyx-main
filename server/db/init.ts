/**
 * Database Initialization Script
 * Run this to set up the database for the first time
 */

import { initializeDatabase, getMigrationManager, DatabaseConnection } from '@/lib/db';

async function main() {
  console.log('🚀 Initializing Flyx database...\n');

  try {
    // Initialize database and run migrations
    await initializeDatabase();
    console.log('');

    // Show migration status
    const migrationManager = getMigrationManager();
    const status = migrationManager.getStatus();
    
    console.log('📊 Database Status:');
    console.log(`   Current Version: ${status.currentVersion}`);
    console.log(`   Latest Version: ${status.latestVersion}`);
    console.log(`   Pending Migrations: ${status.pendingMigrations}`);
    console.log(`   Applied Migrations: ${status.appliedMigrations.length}`);
    console.log('');

    // Get database connection instance for stats and health check
    const dbConnection = DatabaseConnection.getInstance();

    // Health check
    const isHealthy = dbConnection.healthCheck();
    console.log(`🏥 Health Check: ${isHealthy ? '✓ Healthy' : '✗ Unhealthy'}`);
    console.log('');

    // Optional: Create a default admin user (commented out for security)
    // Uncomment and modify to create your first admin user
    /*
    const adminExists = queries.admin.adminExists('admin');
    if (!adminExists) {
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash('changeme', 12);
      queries.admin.createAdmin(
        crypto.randomUUID(),
        'admin',
        passwordHash
      );
      console.log('✓ Default admin user created (username: admin, password: changeme)');
      console.log('⚠️  Please change the password immediately!\n');
    }
    */

    console.log('✅ Database initialization complete!\n');
    
    // Close connection
    dbConnection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { main as initDatabase };
