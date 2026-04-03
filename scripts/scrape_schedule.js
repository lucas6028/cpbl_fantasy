const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: "new"
  });
  
  const page = await browser.newPage();
  
  // We'll intercept network requests to grab the raw JSON data the API provides
  // This is much more reliable than parsing the DOM.
  let scheduleData = null;
  
  page.on('response', async (response) => {
    const url = response.url();
    // The schedule API usually looks something like /api/schedule or similar
    // We will dump the responses for any API that looks like it returns JSON
    if (url.includes('cpbl.com.tw') && response.request().resourceType() === 'xhr' || response.request().resourceType() === 'fetch') {
        try {
            const text = await response.text();
            if (text.includes('GameSno') || text.includes('VisitingTeamName')) {
                console.log('Intercepted schedule API response from:', url);
                scheduleData = JSON.parse(text);
            }
        } catch (e) {
            // Ignore parsing errors for non-JSON requests
        }
    }
  });

  console.log('Navigating to schedule page...');
  await page.goto('https://cpbl.com.tw/schedule', {
    waitUntil: 'networkidle2'
  });
  
  // Wait a bit just in case
  await new Promise(r => setTimeout(r, 2000));
  
  if (scheduleData) {
      console.log('Successfully captured JSON schedule data!');
      fs.writeFileSync('cpbl_schedule_data.json', JSON.stringify(scheduleData, null, 2));
      console.log('Saved to cpbl_schedule_data.json');
      console.log(`Found data (preview):`, scheduleData.length ? scheduleData.slice(0,2) : scheduleData);
  } else {
      console.log('Could not intercept JSON data natively. Falling back to DOM scraping...');
      
      // Fallback DOM scraping if we didn't intercept the API
      const games = await page.evaluate(() => {
          const results = [];
          const gameElements = document.querySelectorAll('.game'); // Adjusted based on generic vue lists
          gameElements.forEach(el => {
              results.push(el.innerText.replace(/\n/g, ' '));
          });
          return results;
      });
      
      console.log('Scraped from DOM:', games.length, 'games');
      fs.writeFileSync('cpbl_schedule_data_dom.json', JSON.stringify(games, null, 2));
  }

  await browser.close();
})();
