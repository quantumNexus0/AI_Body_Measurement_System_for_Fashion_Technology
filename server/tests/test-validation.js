async function testValidation() {
  const baseUrl = 'http://localhost:3001/api';

  console.log('--- Testing Validation ---');

  // 1. Test /measure with invalid height
  try {
    console.log('Test 1: /measure with invalid height (30cm)');
    const res = await fetch(`${baseUrl}/measure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calibrationData: JSON.stringify({ type: 'height', value: 30, unit: 'cm' })
      })
    });
    
    if (res.status === 422) {
      const data = await res.json();
      console.log('SUCCESS: Got status 422');
      console.log('Error details:', JSON.stringify(data.errors));
    } else {
      console.log('FAIL: Expected status 422, got', res.status);
    }
  } catch (err) {
    console.log('FAIL: Error occurred', err.message);
  }

  // 2. Test /recommendations with out-of-range waist
  try {
    console.log('\nTest 2: /recommendations with out-of-range waist (10cm)');
    const res = await fetch(`${baseUrl}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        measurements: {
          chest: '90 cm',
          waist: '10 cm'
        }
      })
    });

    if (res.status === 422) {
      const data = await res.json();
      console.log('SUCCESS: Got status 422');
      console.log('Error details:', JSON.stringify(data.errors));
    } else {
      console.log('FAIL: Expected status 422, got', res.status);
    }
  } catch (err) {
    console.log('FAIL: Error occurred', err.message);
  }

  // 3. Test /users with invalid height
  try {
    console.log('\nTest 3: /users with invalid height (300cm)');
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        email: 'test@example.com',
        height: 300
      })
    });

    if (res.status === 422) {
      const data = await res.json();
      console.log('SUCCESS: Got status 422');
      console.log('Error details:', JSON.stringify(data.errors));
    } else {
      console.log('FAIL: Expected status 422, got', res.status);
    }
  } catch (err) {
    console.log('FAIL: Error occurred', err.message);
  }

  console.log('\n--- Validation Testing Complete ---');
}

testValidation();
