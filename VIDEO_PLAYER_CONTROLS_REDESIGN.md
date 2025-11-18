# Video Player Controls Redesign

## Changes Made

### 1. Removed Playback Speed Selector ✅
- Removed `playbackRate` state
- Removed `changePlaybackRate` function
- Removed speed selection UI from settings menu
- Simplified player controls

### 2. Added CC (Subtitles) Button ✅
- New CC button with closed captions icon
- Shows active state (red color) when subtitles are enabled
- Dropdown menu for subtitle selection
- "Off" option to disable subtitles
- Supports multiple subtitle languages

### 3. Redesigned Settings Button ✅
- Settings gear icon now shows **Video Sources** only
- No more playback speed options
- Clean, focused interface

### 4. Enhanced Source Selection ✅
- Shows ALL available sources from 2embed
- Each source displays its full title (not just quality)
- Sources sorted by quality (2160p → 1080p → 720p → 480p)
- Includes language/audio information in titles

## New UI Layout

```
[Play] [Volume ━━━━] [Time] ... [CC] [⚙️] [Fullscreen]
                                  ↓    ↓
                            Subtitles Sources
                            ├─ Off   ├─ 1080p English
                            ├─ EN    ├─ 1080p Dual Audio
                            └─ ES    ├─ 720p English
                                     └─ 480p English
```

## Features

### CC Button
- **Icon**: Closed captions symbol
- **Active State**: Red color (#e50914) when subtitles enabled
- **Menu**: Dropdown with subtitle options
- **Functionality**: 
  - Load/unload subtitle tracks
  - Support for VTT and SRT formats
  - Multiple language support

### Settings Button (Sources)
- **Icon**: Gear/cog symbol
- **Purpose**: Video source selection only
- **Display**: Shows full source titles with quality and audio info
- **Examples**:
  - "1080p English"
  - "1080p Dual Audio (Hin-Eng)"
  - "720p English with Subtitles"
  - "480p"

## Technical Implementation

### VideoPlayer Component
```typescript
// New State
const [showSubtitles, setShowSubtitles] = useState(false);
const [subtitles, setSubtitles] = useState<any[]>([]);
const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);

// Removed State
// const [playbackRate, setPlaybackRate] = useState(1);
// const [showSources, setShowSources] = useState(false);

// New Function
const loadSubtitle = (subtitleUrl: string | null) => {
  // Manages subtitle track loading
}
```

### 2Embed Extractor Updates
```typescript
interface StreamSource {
  quality: string;
  url: string;
  title: string;        // NEW: Full source title
  referer: string;
  type: 'hls' | 'm3u8';
  requiresSegmentProxy?: boolean;
}

// Returns ALL sources (not just one per quality)
// Sorted by quality: 2160p, 1080p, 720p, 480p, other
```

### Source Title Examples
From 2embed extraction:
- "Movie.Name.2024.2160p.WEB-DL.English"
- "Movie.Name.2024.1080p.BluRay.Dual.Audio.Hin-Eng"
- "Movie.Name.2024.720p.WEB-DL.English.ESubs"
- "Movie.Name.2024.480p.WEB-DL"

## CSS Updates

### Active Button State
```css
.btn.active {
  color: #e50914;
  opacity: 1;
}
```

Applied to CC button when subtitles are active.

## User Experience

### Before
- Cluttered with playback speed options
- Only one source per quality tier
- Generic quality labels (1080p, 720p)
- No subtitle support in UI

### After
- Clean, focused controls
- ALL available sources visible
- Descriptive source titles
- Dedicated CC button for subtitles
- Settings focused on source selection

## Future Enhancements

### Subtitles
- [ ] Auto-fetch subtitles from OpenSubtitles API
- [ ] Show subtitle language flags
- [ ] Subtitle styling options
- [ ] Auto-select based on browser language

### Sources
- [ ] Show source provider icons
- [ ] Indicate source reliability/speed
- [ ] Remember user's preferred source
- [ ] Auto-switch on playback errors

### UI
- [ ] Keyboard shortcuts for subtitles (C key)
- [ ] Subtitle preview on hover
- [ ] Source quality badges
- [ ] Loading indicators for source switching

## Files Modified

1. **app/components/player/VideoPlayer.tsx**
   - Removed playback speed functionality
   - Added subtitle management
   - Redesigned control buttons
   - Updated settings menu

2. **app/components/player/VideoPlayer.module.css**
   - Added `.btn.active` style for active state

3. **app/lib/services/2embed-extractor.ts**
   - Updated `StreamSource` interface to include `title`
   - Changed to return ALL sources (not just best per quality)
   - Sources sorted by quality tier

## Testing Checklist

- [x] CC button appears in controls
- [x] CC button shows active state when subtitles enabled
- [x] Settings button shows all sources
- [x] Source titles display correctly
- [x] Sources sorted by quality
- [ ] Subtitle loading works
- [ ] Subtitle switching works
- [ ] Source switching works
- [ ] Mobile responsive
- [ ] Keyboard shortcuts

## Known Limitations

1. **Subtitles**: Currently set up but needs API integration to fetch actual subtitles
2. **Source Titles**: Depend on 2embed providing descriptive titles
3. **Performance**: Loading all sources may take slightly longer initially

## Migration Notes

- Playback speed removed - users who need this can use browser extensions
- Source selection now more granular - users have full control
- Subtitle support added - enhances accessibility
