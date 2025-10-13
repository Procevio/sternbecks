# Spröjs Functionality Updates Summary

## Changes Made

### 1. Updated Spröjs Prices (CONFIG)
**File:** `assets/js/app.js`
- **Old prices:**
  - 1-3 spröjs: 150kr per ruta
  - 4+ spröjs: 300kr per ruta
- **New prices:**
  - 1-3 spröjs: 250kr per ruta (+67% increase)
  - 4+ spröjs: 400kr per ruta (+33% increase)

### 2. Added New Field: "Hur många av fönstren har spröjs?"
**File:** `index.html`
- **Location:** After the existing spröjs fields, before LE-glas section
- **Element ID:** `antal_fonster_med_sprojs`
- **Input type:** Number with min="0"
- **Placeholder:** "Ange antal fönster"
- **Visibility:** Only shown when user selects "Ja" for spröjs

**File:** `assets/js/app.js`
- **Added to visibility logic:** Shows/hides with sprojs-antal-group
- **Added to data collection:** `windowsWithSprojs` field
- **Reset functionality:** Value reset to 0 when spröjs is set to "Nej"

### 3. Updated Spröjs Calculation Formula
**File:** `assets/js/app.js` - `calculateExtrasCost()` method

**Old formula:**
```
Total spröjs cost = Price per ruta × antal spröjs × total antal luftare × all windows
```

**New formula:**
```
Spröjs cost = Price per ruta × antal spröjs × genomsnittligt antal luftare per fönster × antal fönster MED spröjs
```

**Calculation steps:**
1. Calculate total window count: sum of all luftare types
2. Calculate total luftare: weighted sum (1×antal_1_luftare + 2×antal_2_luftare + etc.)
3. Calculate average luftare per window: totalLuftare / totalWindowCount
4. Apply formula: pricePerRuta × sprojsPerWindow × avgLuftarePerWindow × windowsWithSprojs

### 4. Updated Test Cases
**File:** `assets/js/app.js` - `testSprojsCalculations()` method

**Test scenarios updated to include `windowsWithSprojs` field:**
- Test 1: 2st 3-luftare med 2 spröjs på 2 fönster = 3,000kr
- Test 2: 1st 3-luftare med 4 spröjs på 1 fönster = 4,800kr
- Test 3: Blandade luftare med 3 spröjs på 1 fönster = 1,875kr
- **Test 4 (Specification example):** 4st 3-luftare med 3 spröjs på 2 fönster = 4,500kr ✓

### 5. Created Test File
**File:** `tests/test-sprojs-functionality.html`
- **Purpose:** Verify functionality in browser
- **Tests:**
  - Field visibility toggle
  - Calculation accuracy
  - Specification example validation

## Formula Verification

**Example from specification:** "3 spröjs på 2st av 4st 3-luftare = 4,500kr"

**Calculation:**
- Total windows: 4st 3-luftare
- Average luftare per window: (4×3)/4 = 3 luftare
- Windows with spröjs: 2st
- Price per ruta: 250kr (since 3 ≤ 3)
- **Formula:** 250kr × 3 spröjs × 3 luftare × 2 fönster = **4,500kr** ✓

## Files Modified

1. **`assets/js/app.js`**
   - Updated CONFIG.EXTRAS prices
   - Added visibility logic for new field
   - Updated data collection to include `windowsWithSprojs`
   - Rewrote spröjs calculation formula
   - Updated all test cases

2. **`index.html`**
   - Added new input field `antal_fonster_med_sprojs`
   - Proper form group structure with visibility control

3. **`tests/test-sprojs-functionality.html`** (new)
   - Comprehensive testing interface
   - Browser-based validation

## Validation Results

All functionality has been implemented and tested:
- ✅ Prices updated (250kr/400kr)
- ✅ New field added with proper visibility
- ✅ Calculation formula updated and verified
- ✅ Test cases pass specification example
- ✅ Browser testing interface created

## Usage Instructions

1. **For users:**
   - Select "Ja" for spröjs to show additional fields
   - Enter antal spröjs per båge
   - **NEW:** Enter antal fönster som HAR spröjs (not total fönster)
   - Calculation will use only windows with spröjs

2. **For developers:**
   - Run tests using `tests/test-sprojs-functionality.html`
   - Check browser console for detailed calculation logs
   - Test specification example: 4,500kr result expected

## Technical Notes

- The new calculation method is more accurate as it only calculates spröjs cost for windows that actually have spröjs
- Average luftare per window accounts for mixed luftare types in the same project
- All existing functionality remains backward compatible
- Form validation and reset functionality included for new field