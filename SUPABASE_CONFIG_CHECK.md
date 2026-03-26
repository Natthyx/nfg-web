# Supabase Configuration Checklist for Custom Domain

## Required Supabase Settings

### 1. Site URL Configuration
Go to Supabase Dashboard → Project → Settings → General

**Site URL**: `https://nfg-admin.company`

### 2. Redirect URLs
Go to Supabase Dashboard → Authentication → URL Configuration

Add these URLs:
- `https://nfg-admin.company`
- `https://nfg-admin.company/**` (wildcard for all paths)
- `http://localhost:3000` (for local development)

### 3. CORS Configuration
Go to Supabase Dashboard → Project → Settings → API

Add to CORS origins:
- `https://nfg-admin.company`
- `http://localhost:3000`

### 4. JWT Settings
Go to Supabase Dashboard → Authentication → Settings

**JWT expiry**: Set to 7 days (604800 seconds)
**Refresh token expiry**: 30 days (default)

### 5. Additional Settings
Go to Supabase Dashboard → Authentication → Settings

Ensure these are enabled:
- Enable email confirmations: OFF (for testing)
- Enable phone confirmations: OFF (if not used)
- Enable custom SMTP: If using email

## Common Issues & Solutions

### Issue: Sessions lost on refresh
**Cause**: Site URL not configured for custom domain
**Fix**: Update Site URL in Supabase settings

### Issue: Authentication hangs
**Cause**: Redirect URL not configured for custom domain
**Fix**: Add custom domain to redirect URLs

### Issue: CORS errors
**Cause**: API not configured for custom domain
**Fix**: Add custom domain to CORS origins

### Issue: Ghost user (??)
**Cause**: JWT token validation failing
**Fix**: Check JWT settings and ensure proper site URL

## Testing Steps

1. Clear all browser data for nfg-admin.company
2. Update Supabase settings above
3. Redeploy application
4. Test login flow
5. Test refresh behavior

## Debug Script

Run this in browser console to diagnose issues:
```javascript
// Copy the contents of debug-auth.js and run in console
```
