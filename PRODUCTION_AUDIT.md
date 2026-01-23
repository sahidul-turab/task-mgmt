# Production Readiness Audit - Ops Task Portal

## Priority Issues Found

### P0 (Critical - Must Fix Before Production)

1. **Delete confirmation doesn't show task name**
   - Location: `app/page.tsx:254-256`, `components/TaskDrawer.tsx:104-109`
   - Issue: Generic "Delete this task?" doesn't show which task
   - Risk: Accidental deletion of wrong task

2. **todayDateStr never updates (stale date)**
   - Location: `app/page.tsx:143-146`
   - Issue: Memoized with empty deps, date stays same across days
   - Risk: "Due today" logic breaks after midnight

3. **Missing description field in saveEdit**
   - Location: `app/page.tsx:241-247`
   - Issue: saveEdit doesn't include description, could lose data
   - Risk: Data loss on edit

4. **No error handling for Firestore operations**
   - Location: Multiple (handleAddTask, saveEdit, deleteTask, toggleStatus)
   - Issue: No try/catch, silent failures
   - Risk: User actions fail silently

5. **TaskDrawer delete bypasses confirmation UI**
   - Location: `components/TaskDrawer.tsx:104-109`
   - Issue: Uses simple confirm() instead of proper confirmation UI
   - Risk: Inconsistent UX, bypasses safety

### P1 (High Priority - Should Fix)

6. **Sorting logic doesn't match spec**
   - Location: `app/page.tsx:295-323`
   - Issue: Missing "Due soon (<=7 days)" category, no priority tie-breaker
   - Expected: Overdue (oldest first) -> Due today -> Due soon (<=7d) -> Upcoming -> No deadline, then priority (high>med>low), then createdAt

7. **Performance: Expensive computation in render loop**
   - Location: `app/page.tsx:584-594`
   - Issue: isFirstOverdue/isFirstDueToday computed for every task in map
   - Risk: O(n²) complexity with 500+ tasks

8. **No loading state**
   - Location: `app/page.tsx:103-125`
   - Issue: No loading indicator during initial fetch
   - Risk: Confusing empty state on slow connections

9. **Missing useCallback for handlers**
   - Location: Multiple handlers passed to TaskDrawer
   - Issue: Functions recreated on every render, causes unnecessary re-renders
   - Risk: Performance degradation

10. **Empty state doesn't distinguish "no tasks" vs "filtered out"**
    - Location: `app/page.tsx:571-574`
    - Issue: Same message for both cases
    - Risk: User confusion

### P2 (Medium Priority - Nice to Have)

11. **Hardcoded "white" color**
    - Location: `app/page.tsx:347`
    - Issue: `text-white` should use theme token
    - Risk: Theme inconsistency

12. **todayPretty recalculated every render**
    - Location: `app/page.tsx:223-228`
    - Issue: Should be memoized
    - Risk: Minor performance impact

13. **No error boundaries**
    - Issue: Unhandled errors crash entire app
    - Risk: Poor UX on errors

## Fix Plan

### Fix 1: Delete confirmation with task name (P0)
**File:** `app/page.tsx`
**Location:** Line 254-256
**Change:** Pass task name to deleteTask, show in confirmation

**File:** `components/TaskDrawer.tsx`
**Location:** Line 104-109, 296-335
**Change:** Use existing confirmation UI properly

### Fix 2: Update todayDateStr daily (P0)
**File:** `app/page.tsx`
**Location:** Line 143-146
**Change:** Add effect to update date at midnight or use function

### Fix 3: Add description to saveEdit (P0)
**File:** `app/page.tsx`
**Location:** Line 241-247
**Change:** Include description field in updateDoc

### Fix 4: Add error handling (P0)
**File:** `app/page.tsx`
**Location:** Multiple functions
**Change:** Wrap Firestore operations in try/catch

### Fix 5: Fix sorting logic (P1)
**File:** `app/page.tsx`
**Location:** Line 295-323
**Change:** Implement correct sorting with priority tie-breaker

### Fix 6: Optimize render loop (P1)
**File:** `app/page.tsx`
**Location:** Line 584-594
**Change:** Pre-compute grouping flags in useMemo

### Fix 7: Add loading state (P1)
**File:** `app/page.tsx`
**Location:** Line 103-125
**Change:** Add loading state, show spinner

### Fix 8: Add useCallback (P1)
**File:** `app/page.tsx`
**Location:** Handler functions
**Change:** Wrap handlers in useCallback

### Fix 9: Improve empty states (P1)
**File:** `app/page.tsx`
**Location:** Line 571-574
**Change:** Distinguish no tasks vs filtered out

### Fix 10: Remove hardcoded white (P2)
**File:** `app/page.tsx`
**Location:** Line 347
**Change:** Use CSS variable


