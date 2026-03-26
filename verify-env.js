// Environment Variables Verification Script
// Run this to check if all required env vars are set

console.log('=== Environment Variables Check ===');

// Check production environment variables
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

const optionalVars = [
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'NEXT_PUBLIC_AUTH_COOKIE_DOMAIN',
  'AUTH_COOKIE_DOMAIN'
];

console.log('\n--- Required Variables ---');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName}: MISSING`);
  }
});

console.log('\n--- Optional Variables ---');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value}`);
  } else {
    console.log(`⚪ ${varName}: not set`);
  }
});

console.log('\n--- Environment Info ---');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`VERCEL_ENV: ${process.env.VERCEL_ENV}`);
console.log(`VERCEL_URL: ${process.env.VERCEL_URL}`);

// Check if Supabase URL is correctly configured
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  if (supabaseUrl.includes('supabase.co')) {
    console.log('✅ Supabase URL format looks correct');
  } else {
    console.log('❌ Supabase URL format may be incorrect');
  }
}
