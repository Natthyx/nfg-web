// Debug script to identify authentication issues
// Run this in browser console on your deployed site

console.log('=== NFG Auth Debug ===');

// 1. Check current session
(async () => {
  const { createClient } = await import('/lib/supabase/client.js');
  const supabase = createClient();
  
  console.log('1. Checking current session...');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log('Session:', session);
  console.log('Session Error:', sessionError);
  
  console.log('2. Checking user...');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('User:', user);
  console.log('User Error:', userError);
  
  console.log('3. Checking cookies...');
  document.cookie.split(';').forEach(cookie => {
    if (cookie.trim().startsWith('sb-')) {
      console.log('Auth Cookie:', cookie.trim());
    }
  });
  
  console.log('4. Environment check...');
  console.log('Current URL:', window.location.href);
  console.log('Protocol:', window.location.protocol);
  console.log('Hostname:', window.location.hostname);
  
  console.log('5. Local storage check...');
  const keys = Object.keys(localStorage);
  const supabaseKeys = keys.filter(key => key.includes('supabase') || key.includes('auth'));
  console.log('Supabase localStorage keys:', supabaseKeys);
  
  console.log('6. Session storage check...');
  const sessionKeys = Object.keys(sessionStorage);
  const supabaseSessionKeys = sessionKeys.filter(key => key.includes('supabase') || key.includes('auth'));
  console.log('Supabase sessionStorage keys:', supabaseSessionKeys);
})();
