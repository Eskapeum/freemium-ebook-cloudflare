const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('🚀 Testing freemium e-book at http://localhost:3003');
    
    // Navigate to the homepage
    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');
    
    // Check if the page loaded correctly
    const title = await page.title();
    console.log('📄 Page title:', title);
    
    // Check for the updated hero text
    const heroText = await page.textContent('h1').catch(() => 'Not found');
    console.log('🎯 Hero heading:', heroText);
    
    // Check for the "Start Reading Free" button
    const startButton = await page.locator('text=Start Reading Free').first();
    const buttonExists = await startButton.count() > 0;
    console.log('🔘 "Start Reading Free" button exists:', buttonExists);
    
    if (buttonExists) {
      console.log('✅ Freemium UI elements detected!');
      
      // Click the button to go to reader
      await startButton.click();
      await page.waitForLoadState('networkidle');
      
      // Check if we're on the reader page
      const currentUrl = page.url();
      console.log('📍 Current URL:', currentUrl);
      
      // Check for chapter content
      const chapterContent = await page.locator('[data-testid="chapter-content"], .chapter-content, h2, h3').first().textContent().catch(() => 'No content found');
      console.log('📖 Chapter content preview:', chapterContent.substring(0, 100) + '...');
      
      // Try to navigate to chapter 8 to test email gate
      console.log('🔒 Testing email gate at chapter 8...');
      
      // Look for navigation or chapter selector
      const nextButton = await page.locator('text=Next', 'button:has-text("Next")', '[aria-label="Next"]').first();
      const nextExists = await nextButton.count() > 0;
      
      if (nextExists) {
        // Navigate through chapters to reach chapter 8
        for (let i = 1; i < 8; i++) {
          try {
            await nextButton.click();
            await page.waitForTimeout(1000);
            console.log(`📄 Navigated to chapter ${i + 1}`);
          } catch (e) {
            console.log(`⚠️ Could not navigate to chapter ${i + 1}`);
            break;
          }
        }
        
        // Check if email gate appears
        const emailGate = await page.locator('text=Unlock All Chapters Free', 'text=Get Free Access', 'input[type="email"]').first();
        const emailGateExists = await emailGate.count() > 0;
        console.log('🔐 Email gate appears:', emailGateExists);
        
        if (emailGateExists) {
          console.log('🎉 SUCCESS: Freemium email gate is working!');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing page:', error.message);
  }
  
  console.log('🏁 Test completed. Browser will stay open for manual inspection.');
  // Keep browser open for manual inspection
  // await browser.close();
})();
