# SplashScreen Component

Production-ready app initialization screen with branding, progress tracking, and error handling.

## Usage

### Basic Usage

```tsx
import { SplashScreen } from './components/SplashScreen';

<SplashScreen 
  isVisible={true}
  message="Initializing application..."
/>
```

### With Progress Tracking

```tsx
<SplashScreen 
  isVisible={true}
  message="Loading assets..."
  progress={45}
/>
```

### With Error Handling

```tsx
<SplashScreen 
  isVisible={true}
  error="Failed to load configuration"
  onRetry={() => window.location.reload()}
/>
```

### Using the Hook

```tsx
import { SplashScreen, useSplashScreen } from './components/SplashScreen';

function App() {
  const { 
    isVisible, 
    progress, 
    message, 
    error,
    setProgress, 
    setMessage, 
    setError,
    completeSplash 
  } = useSplashScreen();

  useEffect(() => {
    async function initialize() {
      try {
        setMessage('Loading configuration...');
        await loadConfig();
        setProgress(33);
        
        setMessage('Initializing services...');
        await initServices();
        setProgress(66);
        
        setMessage('Setting up UI...');
        await setupUI();
        setProgress(100);
        
        completeSplash();
      } catch (err) {
        setError(err.message);
      }
    }
    
    initialize();
  }, []);

  return (
    <>
      <SplashScreen 
        isVisible={isVisible}
        progress={progress}
        message={message}
        error={error}
      />
      {!isVisible && <MainApp />}
    </>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `string` | `'Initializing kinetiCORE...'` | Loading message to display |
| `progress` | `number \| undefined` | `undefined` | Progress percentage (0-100), omit for indeterminate spinner |
| `error` | `string \| undefined` | `undefined` | Error message if initialization failed |
| `onRetry` | `() => void \| undefined` | `undefined` | Callback when retry button is clicked (error state) |
| `isVisible` | `boolean` | `true` | Whether to show the splash screen |
| `fadeOutDuration` | `number` | `500` | Duration of fade-out animation in milliseconds |

## Features

### ✅ Core Features
- **Branded Logo**: kinetiCORE logo with gradient background
- **Progress Tracking**: Determinate (0-100%) or indeterminate spinner
- **Error Handling**: Error state with retry button
- **Smooth Animations**: Fade-out transition when initialization completes
- **Responsive Design**: Mobile-friendly layout
- **Accessibility**: Respects `prefers-reduced-motion`

### 🎨 Visual Design
- **Gradient Background**: Purple gradient (667eea → 764ba2)
- **Glass Morphism**: Semi-transparent elements with backdrop blur
- **Subtle Animations**: Pulsing logo, rotating spinner, fading text
- **High DPI Support**: Crisp rendering on Retina displays

### ⚡ Performance
- **Minimal Re-renders**: Uses React best practices
- **GPU Accelerated**: CSS transforms and animations
- **Smooth Fade-out**: Hardware-accelerated opacity transition
- **Auto-cleanup**: Unmounts after fade-out completes

## States

### 1. Loading State (Indeterminate)
```tsx
<SplashScreen 
  message="Initializing..."
/>
```
Shows spinning rings animation.

### 2. Loading State (Determinate)
```tsx
<SplashScreen 
  message="Loading assets..."
  progress={60}
/>
```
Shows progress bar with percentage.

### 3. Error State
```tsx
<SplashScreen 
  error="Connection failed"
  onRetry={handleRetry}
/>
```
Shows error icon, message, and retry button.

### 4. Fade-out State
```tsx
<SplashScreen 
  isVisible={false}
  fadeOutDuration={500}
/>
```
Fades out smoothly and unmounts.

## Styling

### Customization

Override CSS variables or classes:

```css
.splash-screen {
  background: linear-gradient(135deg, #your-color-1, #your-color-2);
}

.splash-title {
  font-family: 'Your Custom Font';
}
```

### Animation Duration

```tsx
<SplashScreen 
  fadeOutDuration={1000} // 1 second fade-out
/>
```

## Accessibility

- ✅ Keyboard navigation for retry button
- ✅ ARIA labels where appropriate
- ✅ Respects `prefers-reduced-motion`
- ✅ High contrast text for readability
- ✅ Focus visible states

## Browser Support

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Backdrop filter support (with fallbacks)

## Integration Example

### App.tsx

```tsx
import { SplashScreen } from './ui/components/SplashScreen';
import { useState, useEffect } from 'react';

function App() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function init() {
      try {
        await initializeApp();
        // Minimum 800ms splash for better UX
        await new Promise(r => setTimeout(r, 800));
        setInitialized(true);
      } catch (err) {
        setError(err.message);
      }
    }
    init();
  }, []);

  if (!initialized) {
    return (
      <SplashScreen
        isVisible={true}
        message="Initializing kinetiCORE..."
        error={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return <MainApp />;
}
```

## Hook API

### `useSplashScreen()`

Returns an object with:

```typescript
{
  isVisible: boolean;          // Current visibility state
  progress: number | undefined; // Current progress (0-100)
  message: string;             // Current message
  error: string | undefined;   // Current error
  setProgress: (n: number) => void;
  setMessage: (s: string) => void;
  setError: (s: string) => void;
  completeSplash: () => void;  // Hide splash screen
  reset: () => void;           // Reset to initial state
}
```

## Best Practices

### ✅ Do

- Show splash for minimum 500-800ms for perceived performance
- Use progress bar for multi-step initialization
- Provide meaningful error messages
- Include retry mechanism for recoverable errors
- Fade out smoothly when done

### ❌ Don't

- Show splash for less than 300ms (jarring)
- Use for small UI updates
- Show indefinitely without progress indication
- Hide important error details
- Skip fade-out animation (jarring)

## Troubleshooting

**Issue:** Splash screen disappears too quickly
- **Solution:** Add minimum display time with `setTimeout()`

**Issue:** Fade-out animation not smooth
- **Solution:** Ensure `fadeOutDuration` prop is set correctly

**Issue:** Logo not visible
- **Solution:** Check Lucide React is installed: `npm install lucide-react`

**Issue:** Background not showing
- **Solution:** Check CSS is imported in component or globally

---

**Owner:** Agent 6 (Edwin)  
**Created:** 2025-10-23  
**Version:** 1.0.0
