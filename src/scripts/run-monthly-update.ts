/**
 * Run Monthly Market Update
 * 
 * This script runs the monthly market update generator.
 * Can be scheduled via cron: 0 0 1 * * (first day of every month at midnight)
 */

import dotenv from 'dotenv';
import { generateMonthlyMarketUpdate } from './generate-market-update';
import { logger } from '../logger';

dotenv.config();

async function run(): Promise<void> {
  logger.info('Starting monthly market update...');
  
  try {
    const result = await generateMonthlyMarketUpdate();
    
    if (result.success) {
      logger.info('Monthly market update completed successfully', {
        postId: result.postId,
        stats: result.stats,
      });
      console.log(`✅ Published: Post ID ${result.postId}`);
      console.log(`📊 Stats: ${result.stats?.citiesAnalyzed} cities analyzed`);
      console.log(`🏆 Top City: ${result.stats?.topCity} (${result.stats?.avgCapRate?.toFixed(2)}% avg)`);
    } else {
      logger.error('Monthly market update failed', {
        error: result.error,
      });
      console.error(`❌ Failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Unexpected error in monthly market update', {
      error: message,
    });
    console.error(`💥 Unexpected error: ${message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  run()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default run;