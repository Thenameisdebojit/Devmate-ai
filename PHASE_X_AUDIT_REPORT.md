# Phase X Workspace Intelligence Layer - Audit Report

## Executive Summary

**Status**: ⚠️ **PARTIALLY IMPLEMENTED** - Architecture is sound, but critical event emissions are missing.

**Critical Finding**: Agent Observer exists and is properly wired, but will **NEVER generate observations** because the events it subscribes to are never emitted.

---

## STEP 1 — VERIFY WORKSPACE DAEMON EXISTENCE

### Findings:

✅ **PASS** - WorkspaceDaemon exists and is properly implemented

- **Location**: `core/workspace/WorkspaceDaemon.ts` (544 lines)
- **Singleton Pattern**: ✅ Implemented via `getWorkspaceDaemon(projectId)` with `daemonInstances` Map
- **Lifetime**: ✅ Lives for entire browser session (not recreated per render)
- **State Persistence**: ✅ State is mutable and persists across events
- **dispatch() Implementation**: ✅ Updates `state.timestamp` and calls `eventBus.emit(event)`
- **EventBus**: ✅ `WorkspaceEventBus` extends EventEmitter and properly emits events

**Code Evidence**:
```typescript
// core/workspace/WorkspaceDaemon.ts:529-531
export function getWorkspaceDaemon(projectId: string): WorkspaceDaemon {
  if (!daemonInstances.has(projectId)) {
    daemonInstances.set(projectId, new WorkspaceDaemon(projectId))
  }
  return daemonInstances.get(projectId)!
}
```

```typescript
// core/workspace/WorkspaceDaemon.ts:319-331
dispatch(event: WorkspaceEvent): void {
  this.updateIntentFromEvent(event)
  this.state = this.reduce(this.state, event)
  this.state.timestamp = Date.now()
  this.eventBus.emit(event)  // ✅ Actually emits
}
```

**Verdict**: [PASS] Step 1 — WorkspaceDaemon exists and functions correctly

---

## STEP 2 — VERIFY REAL EVENT EMISSION (CRITICAL)

### Findings:

⚠️ **PARTIAL FAIL** - Some events are emitted, but critical ones are missing

#### ✅ Events That ARE Emitted:

1. **FILE_CHANGED** ✅
   - **Emitted in**: `app/components/AppGeneratorPanel.tsx:194` (handleContentChange)
   - **Emitted in**: `app/components/AppGenerator/EditorSensor.tsx:73` (content changes)
   - **Received by**: WorkspaceDaemon.reduce() updates file state
   - **Evidence**: 9 dispatch calls found in AppGeneratorPanel.tsx

2. **EDITOR_FOCUS_CHANGED** ✅
   - **Emitted in**: `app/components/AppGeneratorPanel.tsx:138, 154` (handleTabSelect, handleFileSelect)
   - **Emitted in**: `app/components/AppGenerator/EditorSensor.tsx:46` (activeFilePath changes)
   - **Received by**: WorkspaceDaemon.reduce() updates editor.activeFilePath
   - **Evidence**: Multiple dispatch calls found

3. **EDITOR_CURSOR_MOVED** ✅
   - **Emitted in**: `app/components/AppGeneratorPanel.tsx:695` (via EditorSensor)
   - **Emitted in**: `app/components/AppGenerator/EditorSensor.tsx:62` (cursor position changes)
   - **Received by**: WorkspaceDaemon.reduce() updates editor.cursorLine/Column
   - **Evidence**: Wired via Monaco editor onDidChangeCursorPosition

4. **RUNTIME_STARTED** ✅
   - **Emitted in**: `app/components/AppGeneratorPanel.tsx:540` (handleRun)
   - **Evidence**: Found in code

#### ❌ Events That ARE NOT Emitted:

1. **FILE_SAVED** ❌ **CRITICAL MISSING**
   - **Expected**: Should be emitted when user saves file (Ctrl+S / Cmd+S)
   - **Reality**: No save handler exists in MonacoEditorPanel or AppGeneratorPanel
   - **Impact**: AgentObserver.subscribe('FILE_SAVED') will NEVER fire
   - **Evidence**: `grep FILE_SAVED` returns 0 results in app/components/AppGenerator

2. **BUILD_FAILED** ❌ **CRITICAL MISSING**
   - **Expected**: Should be emitted when build fails
   - **Reality**: No dispatch calls found in build/runtime APIs
   - **Impact**: AgentObserver.subscribe('BUILD_FAILED') will NEVER fire
   - **Evidence**: `grep BUILD_FAILED` returns 0 results in app/api

3. **RUNTIME_CRASHED** ❌ **CRITICAL MISSING**
   - **Expected**: Should be emitted when runtime crashes
   - **Reality**: No dispatch calls found in runtime APIs
   - **Impact**: AgentObserver.subscribe('RUNTIME_CRASHED') will NEVER fire
   - **Evidence**: `grep RUNTIME_CRASHED` returns 0 results in app/api

**Verdict**: [FAIL] Step 2 — Critical events (FILE_SAVED, BUILD_FAILED, RUNTIME_CRASHED) are never emitted

---

## STEP 3 — VERIFY BACKGROUND ACTIVITY

### Findings:

✅ **PASS** - Background decay loop exists and runs

- **Location**: `core/workspace/WorkspaceDaemon.ts:152-157`
- **Implementation**: `startDecayLoop()` called in constructor
- **Interval**: ✅ `setInterval(() => this.decayIntentScores(), 2000)` - runs every 2 seconds
- **Functionality**: ✅ Decays intent scores by 2%, normalizes, recomputes dominantIntent
- **Cleanup**: ✅ `stop()` method clears interval

**Code Evidence**:
```typescript
// core/workspace/WorkspaceDaemon.ts:152-157
private startDecayLoop() {
  this.decayInterval = setInterval(() => {
    this.decayIntentScores()
  }, 2000)
}
```

**Additional Background Activity**:
- **AgentObserver.startIntentTracking()**: ✅ Polls state every 3 seconds to detect intent changes
- **Location**: `core/workspace/AgentObserver.ts:72-95`

**Verdict**: [PASS] Step 3 — Background tick loop exists and runs continuously

---

## STEP 4 — VERIFY AGENT SUBSCRIPTION (NOT COMMAND-BASED)

### Findings:

⚠️ **PARTIAL FAIL** - Agent is subscribed, but subscribed events never fire

#### ✅ What Works:

1. **Agent Subscription** ✅
   - **Location**: `core/workspace/AgentObserver.ts:43-67`
   - **Subscribes to**: BUILD_FAILED, RUNTIME_CRASHED, FILE_SAVED, EDITOR_FOCUS_CHANGED
   - **Method**: `eventBus.on(eventType, handler)` - proper EventEmitter subscription
   - **Evidence**: setupSubscriptions() called in constructor

2. **observe() Runs Without Button Clicks** ✅
   - **Location**: `core/workspace/AgentObserver.ts:103-236`
   - **Triggered by**: Event bus emissions (not UI buttons)
   - **Evidence**: observe() is called from event handlers, not command handlers

3. **Observations Streamed to UI** ✅
   - **Location**: `app/components/AppGeneratorPanel.tsx:77-87`
   - **Method**: Subscribes to 'AGENT_OBSERVATION' event, adds to aiMessages state
   - **Evidence**: useEffect hook subscribes to eventBus

#### ❌ What Doesn't Work:

1. **Subscribed Events Never Fire** ❌
   - **BUILD_FAILED**: Never emitted → observe() never called
   - **RUNTIME_CRASHED**: Never emitted → observe() never called
   - **FILE_SAVED**: Never emitted → observe() never called
   - **EDITOR_FOCUS_CHANGED**: ✅ Emitted, BUT observe() doesn't generate observations for this event type

2. **No Observations Generated** ❌
   - **Reason**: AgentObserver.observe() only generates observations for:
     - BUILD_FAILED (never fires)
     - RUNTIME_CRASHED (never fires)
     - FILE_SAVED (never fires)
     - INTENT_CHANGED (polled, but only fires on actual intent change)
   - **EDITOR_FOCUS_CHANGED**: Subscribed but doesn't generate observations

**Code Evidence**:
```typescript
// core/workspace/AgentObserver.ts:47-61
const unsubscribe1 = eventBus.on('BUILD_FAILED', (payload) => {
  this.observe({ type: 'BUILD_FAILED', payload }, this.daemon.getState())
})
// ... but BUILD_FAILED is never emitted anywhere
```

**Verdict**: [FAIL] Step 4 — Agent observes events, but those events never fire, so no observations are generated

---

## STEP 5 — VERIFY READ-ONLY GUARANTEE

### Findings:

✅ **PASS** - Agent is truly read-only

- **No File Writes**: ✅ AgentObserver has no file write methods
- **No Command Execution**: ✅ AgentObserver has no command execution methods
- **No State Mutation**: ✅ AgentObserver doesn't call daemon.dispatch() (only reads state)
- **Only Observations**: ✅ AgentObserver only calls observe() which generates messages

**Code Evidence**:
```typescript
// core/workspace/AgentObserver.ts:103-236
private observe(event: WorkspaceEvent, state: WorkspaceState): void {
  // Only creates AgentObservation objects
  // Only emits AGENT_OBSERVATION events
  // No file writes, no commands, no state mutation
}
```

**Verdict**: [PASS] Step 5 — Read-only guarantee enforced

---

## STEP 6 — FINAL VERDICT

### Checklist:

- [PASS] Step 1 — WorkspaceDaemon exists and functions
- [FAIL] Step 2 — FILE_SAVED, BUILD_FAILED, RUNTIME_CRASHED never emitted
- [PASS] Step 3 — Background decay loop runs continuously
- [FAIL] Step 4 — Agent subscribed but events never fire → no observations
- [PASS] Step 5 — Read-only guarantee enforced

### Critical Questions:

#### 👉 Why is the AI Agent panel still empty (exact reason)?

**Answer**: The AgentObserver subscribes to events (BUILD_FAILED, RUNTIME_CRASHED, FILE_SAVED) that are **never emitted**. The only event that IS emitted and subscribed to (EDITOR_FOCUS_CHANGED) doesn't generate observations in the observe() method. Therefore, `observe()` is never called with event types that generate observations, so no `AGENT_OBSERVATION` events are emitted, so the UI never receives messages.

**Root Cause**: Missing event emissions in:
1. File save handler (FILE_SAVED)
2. Build error handler (BUILD_FAILED)
3. Runtime crash handler (RUNTIME_CRASHED)

#### 👉 What is the SINGLE missing wire preventing visible impact?

**Answer**: **FILE_SAVED event is never emitted**. This is the easiest to trigger and would immediately generate observations. The agent subscribes to FILE_SAVED and has logic to detect "unstable files" (rapid saves), but since FILE_SAVED is never emitted, this logic never runs.

**Secondary Issue**: BUILD_FAILED and RUNTIME_CRASHED are not wired to runtime/build APIs, so error observations never occur.

#### 👉 What is the minimal fix (≤ 30 lines) to unlock Phase X visibility?

**Answer**: Add FILE_SAVED emission when user saves a file. This requires:

1. **Add save handler to MonacoEditorPanel** (10 lines):
   - Listen for Ctrl+S / Cmd+S
   - Call onSave callback

2. **Add onSave prop and handler in AppGeneratorPanel** (15 lines):
   - Add onSave prop to MonacoEditorPanel
   - In handler, dispatch FILE_SAVED event to daemon
   - Mark tab as not dirty

3. **Test**: Save a file → FILE_SAVED emitted → AgentObserver.observe() called → Observation generated → UI shows message

**Minimal Fix Code**:

```typescript
// In MonacoEditorPanel.tsx - add keyboard handler
useEffect(() => {
  const handleSave = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (activeTab) {
        onSave?.(activeTab)
      }
    }
  }
  window.addEventListener('keydown', handleSave)
  return () => window.removeEventListener('keydown', handleSave)
}, [activeTab, onSave])

// In AppGeneratorPanel.tsx - add handler
const handleSave = useCallback((path: string) => {
  setEditorTabs((prev) => prev.map(t => t.path === path ? { ...t, dirty: false } : t))
  if (currentProjectId) {
    const daemon = getCoreWorkspaceDaemon(currentProjectId)
    daemon.dispatch({ type: 'FILE_SAVED', payload: { path } })
  }
}, [currentProjectId])

// Pass to MonacoEditorPanel
<MonacoEditorPanel onSave={handleSave} ... />
```

**Expected Result**: After this fix, saving a file will:
1. Emit FILE_SAVED event
2. AgentObserver.observe() detects rapid saves
3. Generates "[observing] file.ts saved 3 times in 30 seconds..." message
4. Message appears in AI Agent panel

---

## Summary

**Architecture**: ✅ Sound and well-designed
**Implementation**: ⚠️ Incomplete - missing critical event emissions
**Visibility**: ❌ Zero - no observations generated because events never fire
**Fix Complexity**: 🟢 Low - ~30 lines to add FILE_SAVED emission

**Recommendation**: Implement FILE_SAVED emission first (easiest, most visible), then wire BUILD_FAILED and RUNTIME_CRASHED to runtime APIs.

