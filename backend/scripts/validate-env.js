#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Checks if all required environment variables are set correctly
 */

require('dotenv').config();

const chalk = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
};

console.log('\n🔍 Validating Environment Configuration...\n');

const required = [
  { key: 'NODE_ENV', example: 'development' },
  { key: 'PORT', example: '4000' },
  { key: 'DATABASE_URL', example: 'postgresql://user:pass@localhost:5432/db' },
  { key: 'DB_HOST', example: 'localhost' },
  { key: 'DB_PORT', example: '5432' },
  { key: 'DB_NAME', example: 'sales_intelligence' },
  { key: 'DB_USER', example: 'postgres' },
  { key: 'DB_PASSWORD', example: 'postgres' },
  { key: 'JWT_ACCESS_SECRET', example: 'minimum-32-characters-long-secret', minLength: 32 },
  { key: 'JWT_REFRESH_SECRET', example: 'minimum-32-characters-long-secret', minLength: 32 },
  { key: 'GEMINI_API_KEY', example: 'your-gemini-api-key', minLength: 20 },
];

const optional = [
  { key: 'TAVILY_API_KEY', example: 'tvly-xxx' },
  { key: 'SERPAPI_KEY', example: 'your-serpapi-key' },
  { key: 'REDIS_URL', example: 'redis://localhost:6379' },
  { key: 'ALLOWED_ORIGINS', example: 'http://localhost:3000' },
];

let hasErrors = false;
let hasWarnings = false;

// Check required variables
console.log(chalk.blue('Required Environment Variables:'));
required.forEach(({ key, example, minLength }) => {
  const value = process.env[key];
  
  if (!value) {
    console.log(`  ${chalk.red('✗')} ${key}: ${chalk.red('MISSING')}`);
    console.log(`     Example: ${example}`);
    hasErrors = true;
  } else if (minLength && value.length < minLength) {
    console.log(`  ${chalk.red('✗')} ${key}: ${chalk.red(`TOO SHORT (${value.length} chars, need ${minLength}+)`)}`);
    hasErrors = true;
  } else {
    const displayValue = value.length > 50 ? value.substring(0, 20) + '...' : value;
    console.log(`  ${chalk.green('✓')} ${key}: ${chalk.green(displayValue)}`);
  }
});

console.log('');

// Check optional variables
console.log(chalk.blue('Optional Environment Variables:'));
optional.forEach(({ key, example }) => {
  const value = process.env[key];
  
  if (!value) {
    console.log(`  ${chalk.yellow('○')} ${key}: ${chalk.yellow('Not set (optional)')}`);
    console.log(`     Example: ${example}`);
    hasWarnings = true;
  } else {
    const displayValue = value.length > 50 ? value.substring(0, 20) + '...' : value;
    console.log(`  ${chalk.green('✓')} ${key}: ${chalk.green(displayValue)}`);
  }
});

console.log('');

// Check web search API (at least one required)
const hasTavily = process.env.TAVILY_API_KEY;
const hasSerpAPI = process.env.SERPAPI_KEY;

if (!hasTavily && !hasSerpAPI) {
  console.log(chalk.yellow('⚠️  Warning: No web search API configured'));
  console.log('   Web search features will not work');
  console.log('   Set either TAVILY_API_KEY or SERPAPI_KEY');
  hasWarnings = true;
} else {
  console.log(chalk.green('✓ Web search API configured'));
}

// Check database connection
console.log('\n' + chalk.blue('Database Configuration:'));
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  try {
    const url = new URL(dbUrl);
    console.log(`  Protocol: ${url.protocol}`);
    console.log(`  Host: ${url.hostname}`);
    console.log(`  Port: ${url.port || '5432'}`);
    console.log(`  Database: ${url.pathname.substring(1)}`);
    console.log(`  User: ${url.username}`);
  } catch (e) {
    console.log(chalk.red('  ✗ Invalid DATABASE_URL format'));
    hasErrors = true;
  }
}

// Summary
console.log('\n' + chalk.blue('Summary:'));
if (hasErrors) {
  console.log(chalk.red('✗ Configuration has ERRORS - fix required variables'));
  process.exit(1);
} else if (hasWarnings) {
  console.log(chalk.yellow('⚠ Configuration has WARNINGS - optional features may not work'));
  console.log(chalk.green('✓ All required variables are set - safe to start'));
  process.exit(0);
} else {
  console.log(chalk.green('✓ Perfect! All variables configured correctly'));
  process.exit(0);
}

