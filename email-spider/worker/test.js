const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');

const CAPTCHA_API_KEY = 'd9ebd22cba2e892471a56d3068f75451';

puppeteer.use(StealthPlugin());
puppeteer.use(
  RecaptchaPlugin({
    provider: {
      id: '2captcha',
      token: CAPTCHA_API_KEY,
    },
    visualFeedback: true,
  })
);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function test2CaptchaBalance() {
  console.log('Testing 2captcha API key...\n');
  
  try {
    const balanceResponse = await axios.get(
      `https://2captcha.com/res.php?key=${CAPTCHA_API_KEY}&action=getbalance&json=1`
    );
    
    console.log('✓ API Key is valid!');
    console.log(`Balance: $${balanceResponse.data.request}\n`);
    
    if (parseFloat(balanceResponse.data.request) <= 0) {
      console.log('⚠️  WARNING: Your balance is $0. You need to add funds!');
      console.log('Add funds here: https://2captcha.com/pay\n');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('✗ API Key test failed:');
    console.error(error.response?.data || error.message);
    return false;
  }
}

// Test on Google's official reCAPTCHA demo page
async function testRecaptchaV2Demo() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Google reCAPTCHA v2 Demo');
  console.log('='.repeat(60) + '\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log('Navigating to reCAPTCHA v2 demo page...');
    await page.goto('https://www.google.com/recaptcha/api2/demo', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    console.log('✓ Page loaded\n');
    
    // Check if recaptcha is present
    const recaptchaFrame = await page.$('iframe[src*="recaptcha"]');
    if (!recaptchaFrame) {
      console.log('✗ No reCAPTCHA found on page!');
      await browser.close();
      return false;
    }
    
    console.log('✓ reCAPTCHA detected!');
    console.log('\n⏳ Attempting to solve reCAPTCHA...');
    console.log('This will take 20-40 seconds as a real human solves it...\n');
    
    const startTime = Date.now();
    
    try {
      // This will send the captcha to 2captcha and wait for solution
      await page.solveRecaptchas();
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✓ reCAPTCHA solved in ${elapsed} seconds!\n`);
      
      // Try to submit the form
      await page.click('#recaptcha-demo-submit');
      await wait(2000);
      
      // Check if we passed
      const currentUrl = page.url();
      if (currentUrl.includes('success') || currentUrl !== 'https://www.google.com/recaptcha/api2/demo') {
        console.log('✅ SUCCESS! Captcha was solved correctly!\n');
        await browser.close();
        return true;
      } else {
        console.log('⚠️  Captcha solved but form submission unclear\n');
        await browser.close();
        return true;
      }
      
    } catch (error) {
      console.error('✗ Failed to solve captcha:', error.message);
      await page.screenshot({ path: 'captcha-error.png' });
      console.log('Screenshot saved to captcha-error.png\n');
      await browser.close();
      return false;
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    if (browser) await browser.close();
    return false;
  }
}

// Test manual 2captcha API (without puppeteer plugin)
async function testManual2CaptchaAPI() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Manual 2captcha API Test (Image Captcha)');
  console.log('='.repeat(60) + '\n');
  
  // Sample base64 image of a simple text captcha (very small test image)
  const sampleCaptchaBase64 = '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';
  
  try {
    console.log('Submitting captcha to 2captcha...');
    const submitResponse = await axios.post('https://2captcha.com/in.php', {
      key: CAPTCHA_API_KEY,
      method: 'base64',
      body: sampleCaptchaBase64,
      json: 1
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (submitResponse.data.status !== 1) {
      console.error('✗ Failed to submit:', submitResponse.data);
      return false;
    }
    
    const captchaId = submitResponse.data.request;
    console.log(`✓ Captcha submitted! ID: ${captchaId}`);
    console.log('⏳ Waiting for human worker to solve (15-20 seconds)...\n');
    
    // Wait for solution
    await wait(15000);
    
    // Check for solution
    for (let i = 0; i < 10; i++) {
      const resultResponse = await axios.get(
        `https://2captcha.com/res.php?key=${CAPTCHA_API_KEY}&action=get&id=${captchaId}&json=1`
      );
      
      if (resultResponse.data.status === 1) {
        console.log(`✅ CAPTCHA SOLVED: "${resultResponse.data.request}"`);
        console.log('✓ 2captcha API is working correctly!\n');
        return true;
      }
      
      if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
        console.error('✗ Error:', resultResponse.data);
        return false;
      }
      
      console.log(`  Attempt ${i + 1}/10: Still processing...`);
      await wait(5000);
    }
    
    console.log('✗ Timeout waiting for solution\n');
    return false;
    
  } catch (error) {
    console.error('✗ API Error:', error.response?.data || error.message);
    return false;
  }
}

// Test on a page that always shows reCAPTCHA
async function testForceRecaptcha() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Force reCAPTCHA Challenge (High Certainty)');
  console.log('='.repeat(60) + '\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    console.log('Navigating to 2captcha demo page...');
    await page.goto('https://2captcha.com/demo/recaptcha-v2', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    console.log('✓ Page loaded\n');
    await wait(2000);
    
    const recaptchaFrame = await page.$('iframe[src*="recaptcha"]');
    if (!recaptchaFrame) {
      console.log('✗ No reCAPTCHA found!');
      await browser.close();
      return false;
    }
    
    console.log('✓ reCAPTCHA detected!');
    console.log('⏳ Solving captcha (20-40 seconds)...\n');
    
    const startTime = Date.now();
    
    try {
      await page.solveRecaptchas();
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✓ Solved in ${elapsed} seconds!`);
      
      // Check if token was set
      const token = await page.evaluate(() => {
        return document.getElementById('g-recaptcha-response')?.value || '';
      });
      
      if (token && token.length > 0) {
        console.log('✅ SUCCESS! Token received:', token.substring(0, 50) + '...');
        console.log('Token length:', token.length, 'characters\n');
        await browser.close();
        return true;
      } else {
        console.log('⚠️  No token found in g-recaptcha-response\n');
        await browser.close();
        return false;
      }
      
    } catch (error) {
      console.error('✗ Failed to solve:', error.message);
      await page.screenshot({ path: 'recaptcha-fail.png' });
      console.log('Screenshot saved to recaptcha-fail.png\n');
      await browser.close();
      return false;
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    if (browser) await browser.close();
    return false;
  }
}

// Main test runner
(async () => {
  console.log('='.repeat(60));
  console.log('2CAPTCHA SOLVER TEST SUITE');
  console.log('='.repeat(60));
  console.log('This will test if 2captcha can actually solve captchas\n');
  
  // Test 1: Check balance
  const hasBalance = await test2CaptchaBalance();
  if (!hasBalance) {
    console.log('⚠️  Please add funds to your 2captcha account first!');
    console.log('Visit: https://2captcha.com/pay\n');
    process.exit(1);
  }
  
  // Test 2: Manual API test (simple image captcha)
  console.log('Starting manual API test...');
  const manualTest = await testManual2CaptchaAPI();
  
  // Test 3: reCAPTCHA v2 Demo
  console.log('Starting reCAPTCHA v2 demo test...');
  const demoTest = await testRecaptchaV2Demo();
  
  // Test 4: Force reCAPTCHA (most reliable)
  console.log('Starting forced reCAPTCHA test...');
  const forceTest = await testForceRecaptcha();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Manual API Test:        ${manualTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`reCAPTCHA Demo Test:    ${demoTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Forced reCAPTCHA Test:  ${forceTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(60));
  
  if (manualTest || demoTest || forceTest) {
    console.log('\n✅ 2captcha is working! At least one test passed.');
    console.log('You can now use it in your scraper.\n');
  } else {
    console.log('\n❌ All tests failed. Possible issues:');
    console.log('  1. No balance in 2captcha account');
    console.log('  2. API key is invalid');
    console.log('  3. Network/firewall issues');
    console.log('  4. 2captcha service is down\n');
  }
  
  process.exit(0);
})();