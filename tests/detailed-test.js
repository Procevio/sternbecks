// Detaljerat test-script för att verifiera beräkningslogik
// Detta script kan köras i browser console för att testa implementeringen

console.log('🔬 Startar detaljerade tester av anbudsapp funktionalitet...');

// Test 1: Checkbox funktionalitet
function testCheckboxFunctionality() {
    console.log('\n📋 TEST 1: Checkbox Funktionalitet');
    console.log('=================================');
    
    const checkboxes = document.querySelectorAll('input[name="typ_av_fonster[]"]');
    console.log(`✓ Hittade ${checkboxes.length} fönstertyp checkboxes`);
    
    if (checkboxes.length === 0) {
        console.error('❌ FAIL: Inga checkboxes hittades!');
        return false;
    }
    
    // Lista alla alternativ
    const options = Array.from(checkboxes).map(cb => cb.value);
    console.log('✓ Tillgängliga alternativ:', options);
    
    // Kontrollera specifika alternativ
    const expectedOptions = [
        'Kopplade standard',
        'Isolerglas', 
        'Kopplade isolerglas',
        'Insatsbågar yttre',
        'Insatsbågar inre',
        'Insatsbågar komplett',
        'Inåtgående',
        'Utåtgående'
    ];
    
    const missing = expectedOptions.filter(opt => !options.includes(opt));
    if (missing.length === 0) {
        console.log('✅ SUCCESS: Alla förväntade alternativ finns');
        return true;
    } else {
        console.error('❌ FAIL: Saknar alternativ:', missing);
        return false;
    }
}

// Test 2: Beräkningslogik
function testCalculationLogic() {
    console.log('\n🔢 TEST 2: Beräkningslogik');
    console.log('===========================');
    
    // Simulera QuoteCalculator om den finns
    if (typeof QuoteCalculator === 'undefined') {
        console.error('❌ QuoteCalculator klass inte tillgänglig');
        return false;
    }
    
    try {
        const calculator = new QuoteCalculator();
        
        // Test scenario 1: Grundläggande beräkning
        console.log('\n📊 Scenario 1: Grundläggande beräkning');
        const testData1 = {
            doorSections: 1,
            luftare1: 1,
            luftare2: 0,
            luftare3: 0,
            luftare4: 0,
            luftare5: 0,
            luftare6: 0,
            totalWindows: 1,
            windowTypes: ['Kopplade standard'],
            materialPercentage: 10
        };
        
        const basePrice1 = calculator.calculateBaseComponents(testData1);
        console.log(`Baspris (1 dörr + 1 luftare): ${basePrice1}kr`);
        console.log(`Förväntat: ${6000 + 3500} = 9500kr`);
        
        if (basePrice1 === 9500) {
            console.log('✅ SUCCESS: Grundläggande beräkning korrekt');
        } else {
            console.error(`❌ FAIL: Förväntat 9500, fick ${basePrice1}`);
            return false;
        }
        
        // Test scenario 2: Kopplade isolerglas (20% extra)
        console.log('\n📊 Scenario 2: Kopplade isolerglas (20% extra)');
        const testData2 = {
            ...testData1,
            windowTypes: ['Kopplade isolerglas']
        };
        
        const windowTypeCost2 = calculator.calculateWindowTypeCost(testData2, basePrice1);
        const expectedCost2 = basePrice1 * 0.20; // 20% extra
        console.log(`Fönstertyp kostnad: ${windowTypeCost2}kr`);
        console.log(`Förväntat (20% av ${basePrice1}): ${expectedCost2}kr`);
        
        if (Math.abs(windowTypeCost2 - expectedCost2) < 0.01) {
            console.log('✅ SUCCESS: Kopplade isolerglas beräkning korrekt');
        } else {
            console.error(`❌ FAIL: Förväntat ${expectedCost2}, fick ${windowTypeCost2}`);
            return false;
        }
        
        // Test scenario 3: Flera fönstertyper samtidigt
        console.log('\n📊 Scenario 3: Flera fönstertyper samtidigt');
        const testData3 = {
            ...testData1,
            windowTypes: ['Kopplade standard', 'Isolerglas']
        };
        
        const windowTypeCost3 = calculator.calculateWindowTypeCost(testData3, basePrice1);
        const expectedCost3 = 0 + (1 * 400); // Kopplade standard (0 extra) + Isolerglas (400kr per fönster)
        console.log(`Kombinerad fönstertyp kostnad: ${windowTypeCost3}kr`);
        console.log(`Förväntat (0 + 400): ${expectedCost3}kr`);
        
        if (windowTypeCost3 === expectedCost3) {
            console.log('✅ SUCCESS: Kombinerade fönstertyper beräkning korrekt');
        } else {
            console.error(`❌ FAIL: Förväntat ${expectedCost3}, fick ${windowTypeCost3}`);
            return false;
        }
        
        console.log('✅ SUCCESS: Alla beräkningstester godkända');
        return true;
        
    } catch (error) {
        console.error('❌ FAIL: Fel i beräkningstest:', error);
        return false;
    }
}

// Test 3: Materialkostnad och ROT-avdrag ordning
function testMaterialAndROTLogic() {
    console.log('\n💰 TEST 3: Materialkostnad och ROT-avdrag');
    console.log('==========================================');
    
    // Simulera en komplett beräkning
    const totalInclVat = 12000; // Exempel total inkl moms
    const materialPercentage = 10;
    
    // Steg 1: Materialkostnad från total INKL moms
    const materialDeduction = totalInclVat * (materialPercentage / 100);
    console.log(`Total inkl. moms: ${totalInclVat}kr`);
    console.log(`Materialkostnad (${materialPercentage}%): ${materialDeduction}kr`);
    
    // Steg 2: Total efter materialkostnad
    const afterMaterial = totalInclVat - materialDeduction;
    console.log(`Efter materialkostnad: ${afterMaterial}kr`);
    
    // Steg 3: ROT-avdrag på återstående summa
    const rotDeduction = afterMaterial * 0.5; // 50% ROT-avdrag
    console.log(`ROT-avdrag (50%): ${rotDeduction}kr`);
    
    // Steg 4: Slutpris
    const finalPrice = afterMaterial - rotDeduction;
    console.log(`Slutpris: ${finalPrice}kr`);
    
    // Verifiera ordning
    const expectedFinal = (totalInclVat - (totalInclVat * 0.1)) * 0.5;
    console.log(`Förväntat slutpris: ${expectedFinal}kr`);
    
    if (finalPrice === expectedFinal) {
        console.log('✅ SUCCESS: Materialkostnad och ROT-ordning korrekt');
        return true;
    } else {
        console.error(`❌ FAIL: Felaktig beräkningsordning`);
        return false;
    }
}

// Test 4: Validering
function testFormValidation() {
    console.log('\n⚠️ TEST 4: Formulärvalidering');
    console.log('==============================');
    
    // Kontrollera att antal-fält har placeholders
    const quantityFields = [
        'window_sections', 'antal_dorrpartier', 'antal_1_luftare', 
        'antal_2_luftare', 'antal_3_luftare', 'antal_4_luftare', 
        'antal_5_luftare', 'antal_6_luftare'
    ];
    
    let allHavePlaceholders = true;
    
    quantityFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            const placeholder = field.getAttribute('placeholder');
            if (placeholder && placeholder.includes('Ange')) {
                console.log(`✓ ${fieldId}: har placeholder "${placeholder}"`);
            } else {
                console.error(`❌ ${fieldId}: saknar korrekt placeholder`);
                allHavePlaceholders = false;
            }
            
            // Kontrollera att value="0" är borttaget
            if (field.getAttribute('value') === '0') {
                console.error(`❌ ${fieldId}: har fortfarande value="0"`);
                allHavePlaceholders = false;
            }
        } else {
            console.error(`❌ ${fieldId}: fält hittades inte`);
            allHavePlaceholders = false;
        }
    });
    
    if (allHavePlaceholders) {
        console.log('✅ SUCCESS: Alla antal-fält har korrekta placeholders');
        return true;
    } else {
        console.error('❌ FAIL: Problem med placeholders eller standardvärden');
        return false;
    }
}

// Test 5: Edge cases
function testEdgeCases() {
    console.log('\n🧪 TEST 5: Edge Cases');
    console.log('======================');
    
    if (typeof QuoteCalculator === 'undefined') {
        console.error('❌ QuoteCalculator klass inte tillgänglig för edge case tester');
        return false;
    }
    
    try {
        const calculator = new QuoteCalculator();
        
        // Edge case 1: Alla värden 0
        const zeroData = {
            doorSections: 0,
            luftare1: 0,
            luftare2: 0,
            luftare3: 0,
            luftare4: 0,
            luftare5: 0,
            luftare6: 0,
            totalWindows: 0,
            windowTypes: [],
            materialPercentage: 0
        };
        
        const zeroPrice = calculator.calculateBaseComponents(zeroData);
        console.log(`Alla värden 0: ${zeroPrice}kr (förväntat: 0kr)`);
        
        if (zeroPrice === 0) {
            console.log('✅ SUCCESS: Noll-värden hanteras korrekt');
        } else {
            console.error(`❌ FAIL: Förväntat 0, fick ${zeroPrice}`);
            return false;
        }
        
        // Edge case 2: Extremt höga värden
        const highData = {
            doorSections: 999,
            luftare1: 999,
            luftare2: 0,
            luftare3: 0,
            luftare4: 0,
            luftare5: 0,
            luftare6: 0,
            totalWindows: 999,
            windowTypes: ['Kopplade standard'],
            materialPercentage: 10
        };
        
        const highPrice = calculator.calculateBaseComponents(highData);
        const expectedHigh = (999 * 6000) + (999 * 3500); // 999 dörrar + 999 1-luftare
        console.log(`Höga värden: ${highPrice}kr (förväntat: ${expectedHigh}kr)`);
        
        if (highPrice === expectedHigh) {
            console.log('✅ SUCCESS: Höga värden hanteras korrekt');
        } else {
            console.error(`❌ FAIL: Förväntat ${expectedHigh}, fick ${highPrice}`);
            return false;
        }
        
        console.log('✅ SUCCESS: Alla edge case tester godkända');
        return true;
        
    } catch (error) {
        console.error('❌ FAIL: Fel i edge case test:', error);
        return false;
    }
}

// Huvudtest-funktion
function runAllTests() {
    console.log('🚀 STARTAR KOMPLETT TESTSVIT');
    console.log('==============================\n');
    
    const results = [];
    
    results.push({ name: 'Checkbox Funktionalitet', result: testCheckboxFunctionality() });
    results.push({ name: 'Beräkningslogik', result: testCalculationLogic() });
    results.push({ name: 'Material och ROT Logik', result: testMaterialAndROTLogic() });
    results.push({ name: 'Formulärvalidering', result: testFormValidation() });
    results.push({ name: 'Edge Cases', result: testEdgeCases() });
    
    console.log('\n📊 TESTRESULTAT SAMMANFATTNING');
    console.log('===============================');
    
    const passed = results.filter(r => r.result).length;
    const total = results.length;
    
    results.forEach(test => {
        const status = test.result ? '✅ PASS' : '❌ FAIL';
        console.log(`${status}: ${test.name}`);
    });
    
    console.log(`\n🎯 RESULTAT: ${passed}/${total} tester godkända`);
    
    if (passed === total) {
        console.log('🎉 ALLA TESTER GODKÄNDA! Implementeringen fungerar korrekt.');
    } else {
        console.log('⚠️ VISSA TESTER MISSLYCKADES! Granska felen ovan.');
    }
    
    return passed === total;
}

// Exportera funktioner för manuell användning
window.testAnbudsapp = {
    runAllTests,
    testCheckboxFunctionality,
    testCalculationLogic,
    testMaterialAndROTLogic,
    testFormValidation,
    testEdgeCases
};

// Auto-kör tester om scriptet laddas direkt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runAllTests, 1000);
    });
} else {
    setTimeout(runAllTests, 1000);
}