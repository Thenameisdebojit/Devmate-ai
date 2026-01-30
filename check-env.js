#!/usr/bin/env node

/**
 * DevMate v2.0 - Environment Variables Checker
 * Run this to verify your environment setup
 */

const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('  DevMate v2.0 - Environment Check');
console.log('========================================\n');

// Check if .env.local exists
const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local file NOT FOUND!');
  console.log('\n📝 Creating .env.local from template...\n');
  
  const examplePath = path.join(__dirname, '.env.local.example');
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('✅ Created .env.local file');
  }
  
  console.log('\n⚠️  Please edit .env.local and add your API keys:');
  console.log('   Required:');
  console.log('   1. GEMINI_API_KEY from https://makersuite.google.com/app/apikey');
  console.log('   2. MONGODB_URI from https://www.mongodb.com/cloud/atlas');
  console.log('   3. JWT_SECRET (any random secure string)');
  console.log('\n   Optional (for additional AI models):');
  console.log('   4. OPENAI_API_KEY from https://platform.openai.com/api-keys');
  console.log('   5. XAI_API_KEY from https://console.x.ai (for Grok 4)');
  console.log('   6. DEEPSEEK_API_KEY from https://platform.deepseek.com (for DeepSeek 3)');
  console.log('   7. MOONSHOT_API_KEY from https://platform.moonshot.cn (for Kimi K2)');
  console.log('   8. TAVILY_API_KEY from https://tavily.com (for web search)\n');
  process.exit(1);
}

// Read and parse .env.local
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key) envVars[key.trim()] = value;
  }
});

// Check required variables
const required = ['GEMINI_API_KEY', 'MONGODB_URI', 'JWT_SECRET'];
const results = [];
let allConfigured = true;

console.log('Checking environment variables:\n');

required.forEach(key => {
  const value = envVars[key];
  const isSet = value && value.length > 0 && !value.includes('your_') && !value.includes('_here');
  
  if (isSet) {
    console.log(`✅ ${key.padEnd(20)} - Configured`);
    results.push({ key, status: 'ok' });
  } else {
    console.log(`❌ ${key.padEnd(20)} - NOT configured`);
    results.push({ key, status: 'missing' });
    allConfigured = false;
  }
});

console.log('\n========================================\n');

if (allConfigured) {
  console.log('🎉 All environment variables are configured!');
  console.log('\nYou can now start the app with:');
  console.log('   npm run dev\n');
  process.exit(0);
} else {
  console.log('⚠️  Some environment variables are missing.\n');
  console.log('Please edit .env.local and fill in:\n');
  
  results.forEach(({ key, status }) => {
    if (status === 'missing') {
      if (key === 'GEMINI_API_KEY') {
        console.log(`📝 ${key}:`);
        console.log('   Get from: https://makersuite.google.com/app/apikey\n');
      } else if (key === 'MONGODB_URI') {
        console.log(`📝 ${key}:`);
        console.log('   Get from: https://www.mongodb.com/cloud/atlas');
        console.log('   Format: mongodb+srv://user:pass@cluster.mongodb.net/devmate\n');
      } else if (key === 'JWT_SECRET') {
        console.log(`📝 ${key}:`);
        console.log('   Use any random secure string (32+ characters)');
        console.log('   Or generate: openssl rand -base64 32\n');
      }
    }
  });
  
  console.log('After updating .env.local, run this check again:\n');
  console.log('   node check-env.js\n');
  process.exit(1);
}
