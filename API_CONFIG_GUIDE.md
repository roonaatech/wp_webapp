# Web Admin Backend URL Configuration

## Overview
All backend API URLs for the web admin are now centralized in a single configuration file.

## Configuration File Location
```
/src/config/api.config.js
```

## How to Change the Backend URL

### Edit the Configuration File
```javascript
// /src/config/api.config.js
const API_CONFIG = {
  development: {
    baseUrl: 'http://localhost:3000',        // Local development
    description: 'Local Development'
  },
  production: {
    baseUrl: 'https://api.roonaa.in:3343',  // Production server
    description: 'Production Server'
  }
};
```

### Update URLs Based on Your Environment

**For Local Development:**
```javascript
development: {
  baseUrl: 'http://localhost:3000',
  description: 'Local Development'
}
```

**For Production:**
```javascript
production: {
  baseUrl: 'https://api.roonaa.in:3343',
  description: 'Production Server'
}
```

## How to Use in Components

### Import the Config
```javascript
import API_BASE_URL from '../config/api.config';
```

### Use in API Calls
```javascript
// Single endpoint
const response = await axios.get(`${API_BASE_URL}/api/admin/stats`);

// With parameters
const response = await axios.get(`${API_BASE_URL}/api/admin/reports`, {
  headers: { 'x-access-token': token }
});
```

## Files Updated to Use Config

✅ `src/pages/Dashboard.jsx`  
✅ `src/pages/Login.jsx`  
✅ `src/pages/Reports.jsx`  
✅ `src/pages/Approvals.jsx`  
✅ `src/pages/Users.jsx`  

## Environment Detection

The configuration automatically detects the environment:

- **Development Mode:** `http://localhost:3000`
- **Production Mode:** `https://api.roonaa.in:3343`

To build for production:
```bash
npm run build
```

## Benefits

✅ **Single Point of Change** - Update URL in one file  
✅ **No Hardcoding** - All URLs managed centrally  
✅ **Easy Maintenance** - Simple to switch between environments  
✅ **Automatic Detection** - Uses correct URL based on build mode  
✅ **Scalable** - Easy to add new endpoints  

## Adding New Endpoints

To add new API endpoints to the config:

```javascript
export const API_ENDPOINTS = {
  // ... existing endpoints ...
  
  // New endpoint
  NEW_FEATURE: `${API_BASE_URL}/api/new-feature`,
  NEW_FEATURE_DETAIL: (id) => `${API_BASE_URL}/api/new-feature/${id}`,
};
```

Then import and use in your component:

```javascript
import { API_ENDPOINTS } from '../config/api.config';

const response = await axios.get(API_ENDPOINTS.NEW_FEATURE);
```

## Quick Reference

| Environment | URL |
|-------------|-----|
| Local Development | `http://localhost:3000` |
| Production | `https://api.roonaa.in:3343` |

---

That's it! All web admin API URLs are now centralized and easy to maintain. 🎉
