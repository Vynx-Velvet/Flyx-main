# Admin Panel - Single Source of Truth

## Architecture

All admin pages now use a unified data architecture:

### 1. Unified Stats Context (`/api/admin/unified-stats`)
Single source of truth for key metrics displayed across all pages:
- Live Users, DAU, WAU, MAU
- Total Users, New Users, Returning Users
- Sessions, Watch Time, Completion Rate
- Geographic & Device data

### 2. User Profiles API (`/api/admin/users`)
Comprehensive user tracking with detailed profiles:
- **List all users**: `GET /api/admin/users`
- **User profile**: `GET /api/admin/users?userId=xxx`

User profiles include:
- Basic info (first seen, last seen, location, device)
- Live status (online/offline, current activity)
- Engagement metrics (watch time, completion, streaks)
- Content preferences (movies vs TV, quality)
- Activity patterns (by hour, by day)
- Complete watch history
- Recent activity timeline

### 3. How Pages Use Data

```tsx
import { useStats } from '../context/StatsContext';

export default function AdminPage() {
  // Key metrics from unified stats
  const { stats: unifiedStats } = useStats();
  
  // All pages show the SAME numbers for:
  // - unifiedStats.totalUsers
  // - unifiedStats.activeToday (DAU)
  // - unifiedStats.activeThisWeek (WAU)
  // - unifiedStats.liveUsers
  // etc.
}
```

### 4. Data Flow
```
┌─────────────────────────────────────────────────────────┐
│                    StatsContext                          │
│              (auto-refreshes every 30s)                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              /api/admin/unified-stats                    │
│   (aggregates from all tables - single source)          │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
      Dashboard        Users Page      Live Page
      (same #s)        (same #s)       (same #s)
```

### 5. User Profile Features

Click any user in the Users page to see:
- **Profile Header**: User ID, online status, current activity
- **Engagement Stats**: Watch time, completion rate, streaks
- **Location & Device**: Country, city, device type
- **Preferences**: Movies vs TV, quality preferences
- **Activity Patterns**: Heatmaps by hour and day
- **Watch History**: Last 50 watched items with completion %
- **Recent Activity**: Page views, watch starts/ends

### 6. Tables Used
- `user_activity` - User sessions and activity
- `live_activity` - Real-time presence
- `watch_sessions` - Content viewing history
- `analytics_events` - Page views and events
