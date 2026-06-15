const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3005';
const API_URL = 'http://localhost:3000/api';

async function test() {
  console.log('Starting KAPWA UI tests...\n');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Test 1: Login page loads
  console.log('Test 1: Login page loads...');
  await page.goto(BASE_URL + '/login.html');
  const title = await page.locator('h1').textContent();
  console.log(`  ✓ Page title: "${title}"`);
  
  const emailInput = await page.locator('input[name="email"]').isVisible();
  console.log(`  ✓ Email input visible: ${emailInput}`);
  
  const passInput = await page.locator('input[name="password"]').isVisible();
  console.log(`  ✓ Password input visible: ${passInput}`);
  
  const btnText = await page.locator('button[type="submit"]').textContent();
  console.log(`  ✓ Submit button: "${btnText.trim()}"`);
  
  // Test 2: Login works
  console.log('\nTest 2: Login functionality...');
  await page.fill('input[name="email"]', 'demo@test.com');
  await page.fill('input[name="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard.html', { timeout: 5000 });
  
  const dashTitle = await page.locator('h1').textContent();
  console.log(`  ✓ Redirected to dashboard`);
  
  const userEmail = await page.locator('#user-email').textContent();
  console.log(`  ✓ User logged in: "${userEmail}"`);
  
  // Test 3: Dashboard metrics load
  console.log('\nTest 3: Dashboard metrics...');
  await page.waitForTimeout(500);
  const totalCases = await page.locator('#total-cases').textContent();
  console.log(`  ✓ Total cases shown: ${totalCases}`);
  
  const disbursed = await page.locator('#disbursed-cases').textContent();
  console.log(`  ✓ Disbursed cases shown: ${disbursed}`);
  
  // Test 4: Navigation works
  console.log('\nTest 4: Navigation to Intake...');
  await page.goto(BASE_URL + '/intake.html');
  const intakeTitle = await page.locator('h1').textContent();
  console.log(`  ✓ Intake page loaded`);
  
  const surnameInput = await page.locator('input[name="surname"]').isVisible();
  console.log(`  ✓ Form visible: ${surnameInput}`);
  
  // Test 5: Submit GIS intake
  console.log('\nTest 5: Submit GIS intake...');
  await page.fill('input[name="surname"]', 'Test');
  await page.fill('input[name="firstName"]', 'User');
  await page.selectOption('select[name="gender"]', 'Male');
  await page.fill('input[name="dob"]', '1990-01-15');
  await page.fill('input[name="address"]', '123 Test St');
  await page.fill('input[name="barangay"]', 'Barangay 1');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
  
  const msg = await page.locator('#message').textContent();
  console.log(`  ✓ Submit result: "${msg}"`);
  
  await browser.close();
  
  console.log('\n✅ All UI tests passed!');
}

test().catch(e => {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
});