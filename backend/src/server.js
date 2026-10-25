import app from './app.js';
import { config, validateSupabaseConfig, isGeminiConfigured } from './config/env.js';
import { whatsappScheduler } from './services/whatsapp-scheduler.service.js';

// Pre-flight environment validation
const supabaseValidation = validateSupabaseConfig();
if (!supabaseValidation.valid) {
  console.warn('\n' + '='.repeat(70));
  console.warn('⚠️  [SUPABASE CONFIGURATION NOTICE]');
  console.warn(supabaseValidation.message);
  console.warn('To connect your live PostgreSQL database, add to backend/.env:');
  console.warn('  SUPABASE_URL=https://your-project.supabase.co');
  console.warn('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret_key');
  console.warn('='.repeat(70) + '\n');
}

// Start background WhatsApp milestone reminder scheduler
if (config.nodeEnv !== 'test') {
  whatsappScheduler.start();
  console.log('⏰ WhatsApp Spaced Repetition Scheduler initialized.');
}

const host = config.host || '0.0.0.0';
const server = app.listen(config.port, host, () => {
  const displayHost = host === '0.0.0.0' ? 'localhost' : host;
  console.log('='.repeat(60));
  console.log(`🚀 ReviseCode Backend running successfully!`);
  console.log(`📡 URL: http://${displayHost}:${config.port}`);
  console.log(`🏥 Health Check: http://${displayHost}:${config.port}/health`);
  console.log(`🌐 Allowed Frontend: ${config.clientOrigin}`);
  console.log(`🗄️  Database Storage: Supabase PostgreSQL`);
  console.log(`⚙️  Environment: ${config.nodeEnv}`);
  console.log('='.repeat(60));
});

function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Closing ReviseCode HTTP server cleanly...`);
  whatsappScheduler.stop();
  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  // Force termination if clean shutdown hangs past 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown: Timed out waiting for active connections to close.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default server;
