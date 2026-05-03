# CrisisNet Phase 5 - Day 5 Test Plan

**Date**: 2026-05-02T22:05:00Z  
**Status**: Day 5/14 - Test Suite Specification  
**Gate Criteria**: 15/15 tests passing

---

## 📋 Test Suite Overview

**Total Tests**: 15  
**Framework**: Jest + React Native Testing Library  
**Coverage Target**: 80%+ for critical paths

### Test Categories:

1. **Service Tests** (6 tests) - Core business logic
2. **Hook Tests** (3 tests) - React integration layer
3. **Component Tests** (3 tests) - UI components
4. **Screen Tests** (3 tests) - End-to-end flows

---

## 1️⃣ Service Tests (6 tests)

### Test 1: LocationService - Permissions & Capture ✅

**File**: `__tests__/services/LocationService.test.ts` (CREATED)

**Test Cases**:
1. ✅ `requestPermissions` returns 'granted' when permission granted
2. ✅ `requestPermissions` returns 'denied' when permission denied
3. ✅ `getCurrentLocation` returns location with good accuracy on first try
4. ✅ `getCurrentLocation` retries up to 3 times if accuracy is poor
5. ✅ `getCurrentLocation` falls back to last known location if all retries fail
6. ✅ `getCurrentLocation` uses default fallback (0,0) if no last known location
7. ✅ `startWatching` starts watching and calls callback
8. ✅ `stopWatching` clears watch ID

**Mocks**:
- `react-native-geolocation-service`
- `react-native` PermissionsAndroid

**Critical Assertions**:
```typescript
// Retry logic
expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(3);

// Fallback
expect(location.lat).toBe(20.0000); // Last known
expect(location.accuracy).toBe(999999); // Default fallback
```

---

### Test 2: APIService - HTTP Calls & Error Handling

**File**: `__tests__/services/APIService.test.ts`

**Test Cases**:
1. `submitCrisisReport` returns 200 on success
2. `submitCrisisReport` returns error object on network failure
3. `submitCrisisReport` times out after 15s
4. `getHeatmap` returns heatmap data
5. `getAllocation` returns allocation result
6. `ping` returns true when reachable

**Mocks**:
- `axios` with mock adapter

**Critical Assertions**:
```typescript
// Success
expect(response.statusCode).toBe(200);
expect(response.data).toHaveProperty('severity');

// Error handling (never throws)
expect(response.statusCode).toBe(500);
expect(response.error).toBeDefined();

// Timeout
await expect(APIService.submitCrisisReport(report))
  .resolves.toHaveProperty('error', 'Request timeout');
```

---

### Test 3: GemmaService - Init, Inference, Fallback

**File**: `__tests__/services/GemmaService.test.ts`

**Test Cases**:
1. `initialize` loads model and sets status to 'ready'
2. `initialize` sets status to 'fallback' on error
3. `runInference` returns AI response when model ready
4. `runInference` returns rule-based fallback when model not ready
5. `runInferenceStream` emits tokens progressively
6. Fallback triage returns valid TriageOutput

**Mocks**:
- `react-native-gemma` (hypothetical native module)

**Critical Assertions**:
```typescript
// Model ready
expect(GemmaService.getStatus()).toBe('ready');

// Fallback
const result = await GemmaService.runInference(prompt);
expect(result).toContain('Move to high ground'); // Rule-based

// Streaming
const tokens: string[] = [];
await GemmaService.runInferenceStream(prompt, (token) => {
  tokens.push(token);
});
expect(tokens.length).toBeGreaterThan(0);
```

---

### Test 4: SyncService - Queue, Sync, Retry

**File**: `__tests__/services/SyncService.test.ts`

**Test Cases**:
1. `queueReport` adds report to SQLite
2. `getPendingReports` returns all pending reports
3. `syncPendingReports` uploads reports and updates status
4. `syncPendingReports` retries failed reports with exponential backoff
5. `syncPendingReports` marks as 'failed' after max retries
6. `getPendingCount` returns correct count

**Mocks**:
- SQLite database (in-memory)
- APIService

**Critical Assertions**:
```typescript
// Queue
await SyncService.queueReport(report);
const pending = await SyncService.getPendingReports();
expect(pending).toHaveLength(1);

// Sync success
const result = await SyncService.syncPendingReports();
expect(result.synced).toBe(1);
expect(result.total).toBe(1);

// Retry logic
expect(report.sync_attempts).toBe(3);
expect(report.sync_status).toBe('failed');
```

---

### Test 5: Zustand Store - State Management

**File**: `__tests__/store/useAppStore.test.ts`

**Test Cases**:
1. `setConnectivity` updates isOnline and connectionType
2. `setGemmaStatus` updates gemmaStatus
3. `setCurrentLocation` updates currentLocation
4. `setPendingCount` updates pendingCount
5. `addToHistory` adds report to history (max 10)
6. `resetAll` clears all state

**Mocks**:
- AsyncStorage

**Critical Assertions**:
```typescript
const { result } = renderHook(() => useAppStore());

act(() => {
  result.current.setConnectivity(true, 'wifi');
});

expect(result.current.isOnline).toBe(true);
expect(result.current.connectionType).toBe('wifi');

// History max 10
for (let i = 0; i < 15; i++) {
  act(() => result.current.addToHistory(mockReport));
}
expect(result.current.history).toHaveLength(10);
```

---

### Test 6: Database Schema - Migrations

**File**: `__tests__/db/schema.test.ts`

**Test Cases**:
1. `initDatabase` creates tables
2. `getMigrationSQL` returns correct migrations
3. Tables have correct indexes
4. Foreign key constraints work

**Mocks**:
- SQLite (in-memory)

**Critical Assertions**:
```typescript
await initDatabase();

// Check tables exist
const tables = await db.getAllTableNames();
expect(tables).toContain('pending_reports');
expect(tables).toContain('sync_log');

// Check indexes
const indexes = await db.getAllIndexes('pending_reports');
expect(indexes).toContain('idx_pending_reports_sync_status');
```

---

## 2️⃣ Hook Tests (3 tests)

### Test 7: useConnectivity - Auto-Sync & Polling

**File**: `__tests__/hooks/useConnectivity.test.ts`

**Test Cases**:
1. Hook subscribes to NetInfo and updates store
2. Auto-sync triggers 3s after offline→online transition
3. Pending count polling works every 5s
4. Cleanup unsubscribes from NetInfo

**Mocks**:
- `@react-native-community/netinfo`
- SyncService

**Critical Assertions**:
```typescript
const { result } = renderHook(() => useConnectivity());

// NetInfo subscription
expect(NetInfo.addEventListener).toHaveBeenCalled();

// Auto-sync after 3s
act(() => {
  mockNetInfo.emit({ isConnected: true, type: 'wifi' });
});

await waitFor(() => {
  expect(SyncService.syncPendingReports).toHaveBeenCalled();
}, { timeout: 4000 });
```

---

### Test 8: useGemmaInference - Run, Stream, Parse

**File**: `__tests__/hooks/useGemmaInference.test.ts`

**Test Cases**:
1. `run` calls GemmaService and updates state
2. `runStream` accumulates tokens and updates response
3. JSON parsing extracts TriageOutput correctly
4. Fallback mode works when Gemma unavailable
5. `reset` clears all state

**Mocks**:
- GemmaService

**Critical Assertions**:
```typescript
const { result } = renderHook(() => useGemmaInference());

act(() => {
  result.current.run(prompt, 'triage');
});

await waitFor(() => {
  expect(result.current.status).toBe('complete');
  expect(result.current.parsedResponse).toHaveProperty('severity');
  expect(result.current.inferenceMs).toBeGreaterThan(0);
});
```

---

### Test 9: useLocationCapture - Permissions & Capture

**File**: `__tests__/hooks/useLocationCapture.test.ts`

**Test Cases**:
1. Hook requests permissions on mount
2. `recapture` calls LocationService.getCurrentLocation
3. Accuracy status updates correctly (excellent/good/poor/insufficient)
4. Background watching starts/stops correctly
5. Store updates with current location

**Mocks**:
- LocationService

**Critical Assertions**:
```typescript
const { result } = renderHook(() => useLocationCapture());

await waitFor(() => {
  expect(result.current.location).toBeDefined();
  expect(result.current.accuracyStatus).toBe('good'); // <30m
});

// Recapture
act(() => {
  result.current.recapture();
});

expect(LocationService.getCurrentLocation).toHaveBeenCalledTimes(2);
```

---

## 3️⃣ Component Tests (3 tests)

### Test 10: AIAssistant - Streaming & JSON Parsing

**File**: `__tests__/components/AIAssistant.test.tsx`

**Test Cases**:
1. Shows loading state initially
2. Streaming displays tokens with cursor blink
3. Triage response renders structured fields
4. Follow-up question input works
5. Auto-scrolls during streaming

**Mocks**:
- useGemmaInference hook

**Critical Assertions**:
```typescript
const mockHook = {
  status: 'streaming',
  response: 'Move to high ground',
  parsedResponse: null,
  run: jest.fn(),
  runStream: jest.fn(),
};

jest.mock('../../src/hooks/useGemmaInference', () => ({
  useGemmaInference: () => mockHook,
}));

render(<AIAssistant prompt={prompt} promptType="triage" streaming />);

expect(screen.getByText(/Move to high ground/)).toBeInTheDocument();
expect(screen.getByText('|')).toBeInTheDocument(); // Cursor
```

---

### Test 11: LocationCapture - Accuracy Ring & Recapture

**File**: `__tests__/components/LocationCapture.test.tsx`

**Test Cases**:
1. Displays accuracy ring with correct color
2. Shows coordinates with 6 decimal places
3. Recapture button calls onLocationUpdate
4. Compact mode renders single line
5. Warning shows for insufficient accuracy

**Mocks**:
- useLocationCapture hook

**Critical Assertions**:
```typescript
const mockHook = {
  location: { lat: 19.9975, lng: 73.7898 },
  accuracy: 45,
  accuracyStatus: 'poor',
  recapture: jest.fn(),
};

render(<LocationCapture onLocationUpdate={jest.fn()} />);

expect(screen.getByText('45m')).toBeInTheDocument();
expect(screen.getByText('Poor')).toBeInTheDocument();
expect(screen.getByText(/19.997500, 73.789800/)).toBeInTheDocument();
```

---

### Test 12: ConnectivityBanner - 4 States

**File**: `__tests__/components/ConnectivityBanner.test.tsx`

**Test Cases**:
1. Shows online state (green) when connected
2. Shows offline state (amber) when disconnected
3. Shows syncing state with progress
4. Shows pending state with badge count
5. Tap calls onTapQueue when pending > 0

**Mocks**:
- useConnectivity hook

**Critical Assertions**:
```typescript
// Online
const mockHook = { isOnline: true, connectionType: 'wifi', pendingCount: 0 };
render(<ConnectivityBanner />);
expect(screen.getByText(/Online \(WiFi\)/)).toBeInTheDocument();

// Pending
mockHook.pendingCount = 3;
rerender(<ConnectivityBanner onTapQueue={mockTap} />);
expect(screen.getByText('3')).toBeInTheDocument(); // Badge
fireEvent.press(screen.getByText(/3 reports pending/));
expect(mockTap).toHaveBeenCalled();
```

---

## 4️⃣ Screen Tests (3 tests)

### Test 13: VictimReportScreen - ≤4 Taps & Offline Submission

**File**: `__tests__/screens/VictimReportScreen.test.tsx`

**Test Cases**:
1. ≤4 taps to submit (crisis type → casualties → GPS → submit)
2. Offline submission queues to SyncService
3. Online submission calls APIService
4. Post-submit shows amber screen (offline) or green screen (online)
5. AI triage guidance displays

**Mocks**:
- useConnectivity, useAppStore
- SyncService, APIService

**Critical Assertions**:
```typescript
render(<VictimReportScreen />);

// Tap 1: Crisis type
fireEvent.press(screen.getByText('Flood'));

// Tap 2: Casualties (optional, skip if 0)

// Tap 3: GPS auto-captured (no tap needed)

// Tap 4: Submit
fireEvent.press(screen.getByText(/SUBMIT REPORT/));

await waitFor(() => {
  expect(SyncService.queueReport).toHaveBeenCalled();
  expect(screen.getByText(/Saved Locally/)).toBeInTheDocument();
});
```

---

### Test 14: OfflineQueueScreen - List, Delete, Sync

**File**: `__tests__/screens/OfflineQueueScreen.test.tsx`

**Test Cases**:
1. Renders list of pending reports
2. Shows correct status icons (⏳/⟳/✓/✗)
3. Swipe to delete shows confirmation
4. Pull to refresh reloads data
5. Fab sync button triggers sync

**Mocks**:
- SyncService
- useConnectivity

**Critical Assertions**:
```typescript
SyncService.getPendingReports.mockResolvedValue([
  { id: '1', crisis_type: 'flood', sync_status: 'pending', ... },
  { id: '2', crisis_type: 'fire', sync_status: 'failed', ... },
]);

render(<OfflineQueueScreen />);

await waitFor(() => {
  expect(screen.getByText('FLOOD')).toBeInTheDocument();
  expect(screen.getByText('⏳')).toBeInTheDocument(); // Pending icon
  expect(screen.getByText('✗')).toBeInTheDocument(); // Failed icon
});

// Delete
fireEvent.press(screen.getByText('🗑️'));
expect(screen.getByText(/Delete Report/)).toBeInTheDocument();
```

---

### Test 15: SettingsScreen - Demo Data & Reset

**File**: `__tests__/screens/SettingsScreen.test.tsx`

**Test Cases**:
1. API URL input updates
2. Test connection button calls APIService.ping
3. Load demo data creates 5 reports
4. Reset app clears all data
5. Model status displays correctly

**Mocks**:
- useAppStore
- APIService, SyncService
- AsyncStorage

**Critical Assertions**:
```typescript
render(<SettingsScreen />);

// Load demo data
fireEvent.press(screen.getByText('Load Demo Data'));
fireEvent.press(screen.getByText('Load')); // Confirmation

await waitFor(() => {
  expect(SyncService.queueReport).toHaveBeenCalledTimes(5);
});

// Reset app
fireEvent.press(screen.getByText('Reset App'));
fireEvent.press(screen.getByText('Reset')); // Confirmation

await waitFor(() => {
  expect(AsyncStorage.clear).toHaveBeenCalled();
  expect(useAppStore.getState().resetAll).toHaveBeenCalled();
});
```

---

## 🎯 Test Execution Plan

### Setup

```bash
cd mobile/CrisisNetMobile

# Install dependencies
npm install

# Install test dependencies
npm install --save-dev @testing-library/react-native @testing-library/jest-native jest

# Run tests
npm test
```

### Jest Configuration

**File**: `jest.config.js`

```javascript
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
};
```

---

## 📊 Expected Test Results

### Coverage Targets:

| Category | Target | Critical |
|----------|--------|----------|
| Services | 90%+ | ✅ Core logic |
| Hooks | 85%+ | ✅ Integration |
| Components | 75%+ | UI rendering |
| Screens | 70%+ | E2E flows |
| **Overall** | **80%+** | **Gate** |

### Gate Criteria:

✅ **15/15 tests passing**  
✅ **80%+ code coverage**  
✅ **No critical bugs**  
✅ **All mocks working correctly**

---

## 🚀 Test Execution Commands

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test LocationService.test.ts

# Run in watch mode
npm test -- --watch

# Run with verbose output
npm test -- --verbose
```

---

## 🔧 Mock Setup Examples

### NetInfo Mock:

```typescript
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
  addEventListener: jest.fn((callback) => {
    return () => {}; // Unsubscribe
  }),
}));
```

### AsyncStorage Mock:

```typescript
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));
```

### SQLite Mock:

```typescript
jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn((callback) => {
      callback({
        executeSql: jest.fn((sql, params, success) => {
          success(null, { rows: { _array: [] } });
        }),
      });
    }),
  })),
}));
```

---

## 📝 Test Documentation

Each test file includes:
- **Purpose**: What is being tested
- **Setup**: Mocks and fixtures
- **Test Cases**: Specific scenarios
- **Assertions**: Expected outcomes
- **Cleanup**: Teardown logic

---

## ✅ Day 5 Completion Criteria

**All 15 tests must**:
1. ✅ Pass consistently
2. ✅ Have meaningful assertions
3. ✅ Use proper mocks
4. ✅ Cover critical paths
5. ✅ Run in <30 seconds total

**Code coverage must**:
1. ✅ Meet 80%+ overall threshold
2. ✅ Cover all critical services
3. ✅ Cover all hooks
4. ✅ Cover key component logic

**Documentation must**:
1. ✅ Explain test purpose
2. ✅ Document mock setup
3. ✅ Provide run instructions

---

## 🎯 Next Steps After Day 5

**If 15/15 tests pass** → Proceed to Day 6 (OR-Tools)  
**If <15/15 tests pass** → Fix failing tests, do not proceed

**Day 6 Preview**: OR-Tools AllocationOptimizer
- Unit tests first (TDD)
- TSP optimization
- Constraint satisfaction
- Benchmark against naive allocation

---

**Status**: Test plan complete  
**Files Created**: 1 (LocationService.test.ts as example)  
**Remaining**: 14 test files to implement  
**Estimated Time**: 6-8 hours to write all tests  
**Gate**: 15/15 passing required to proceed

---

*Test Plan Created: 2026-05-02T22:05:00Z*
