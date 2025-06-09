require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');

// Apply stealth plugin to bypass anti-bot measures
puppeteer.use(StealthPlugin());

// Configuration
const SEARCH_KEYWORD = 'Node.js';
const EXPERIENCE_RANGE = '2-5'; // Change as needed: '0-1', '1-2', '2-5', '5-7', '7-10', '10-15'
const RESULTS_LIMIT = 50; // Number of results to scrape
const OUTPUT_FILE = 'naukri_results.csv';
const HEADLESS = process.env.HEADLESS === 'true';
const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// Proxy configuration (if available)
const PROXY_SERVER = process.env.PROXY_SERVER;
const PROXY_USERNAME = process.env.PROXY_USERNAME;
const PROXY_PASSWORD = process.env.PROXY_PASSWORD;

// CSV writer setup
const csvWriter = createObjectCsvWriter({
  path: OUTPUT_FILE,
  header: [
    { id: 'title', title: 'Job Title' },
    { id: 'company', title: 'Company' },
    { id: 'experience', title: 'Experience' },
    { id: 'location', title: 'Location' },
    { id: 'salary', title: 'Salary' },
    { id: 'skills', title: 'Skills' },
    { id: 'jobDescription', title: 'Job Description' },
    { id: 'postedDate', title: 'Posted Date' },
    { id: 'url', title: 'Job URL' }
  ]
});

// Random delay function with variable timing to mimic human behavior
const randomDelay = async (min = 1000, max = 3000) => {
  const delay = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delay));
};

// Function to simulate human-like scrolling
const simulateHumanScrolling = async (page) => {
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  
  let currentPosition = 0;
  const scrollSteps = Math.floor(Math.random() * 5) + 3; // Random number of scroll steps (3-7)
  
  for (let i = 0; i < scrollSteps; i++) {
    const scrollAmount = Math.floor(viewportHeight / scrollSteps);
    currentPosition += scrollAmount;
    
    // Add some randomness to the scroll amount
    const randomOffset = Math.floor(Math.random() * 100) - 50;
    const targetPosition = Math.min(currentPosition + randomOffset, scrollHeight);
    
    await page.evaluate((pos) => {
      window.scrollTo({
        top: pos,
        behavior: 'smooth'
      });
    }, targetPosition);
    
    // Random pause between scrolls
    await randomDelay(500, 1500);
  }
  
  // Sometimes scroll back up a bit
  if (Math.random() > 0.7) {
    const upScrollAmount = Math.floor(Math.random() * (currentPosition / 2));
    await page.evaluate((pos) => {
      window.scrollTo({
        top: pos,
        behavior: 'smooth'
      });
    }, currentPosition - upScrollAmount);
    
    await randomDelay(500, 1000);
  }
};

// Function to simulate human-like mouse movements
const simulateHumanMouseMovement = async (page) => {
  const width = await page.evaluate(() => window.innerWidth);
  const height = await page.evaluate(() => window.innerHeight);
  
  // Generate random number of mouse movements (2-5)
  const movementCount = Math.floor(Math.random() * 4) + 2;
  
  for (let i = 0; i < movementCount; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    
    await page.mouse.move(x, y);
    await randomDelay(100, 500);
  }
};

// Function to extract job details from a job card
const extractJobDetails = async (page, jobCard) => {
  try {
    // Simulate human behavior before clicking
    await simulateHumanMouseMovement(page);
    
    // Click on the job card to open job details
    await jobCard.click();
    await randomDelay(2000, 4000);
    
    // Simulate scrolling through the job details
    await simulateHumanScrolling(page);
    
    // Extract data from the job details page
    const jobData = await page.evaluate(() => {
      // Job title
      const title = document.querySelector('.jd-header-title')?.textContent.trim() || 'N/A';
      
      // Company name
      const company = document.querySelector('.jd-header-comp-name')?.textContent.trim() || 'N/A';
      
      // Experience
      const experience = document.querySelector('.exp .ni-info-icon + span')?.textContent.trim() || 'N/A';
      
      // Location
      const location = document.querySelector('.loc .ni-info-icon + span')?.textContent.trim() || 'N/A';
      
      // Salary (if available)
      const salary = document.querySelector('.salary .ni-info-icon + span')?.textContent.trim() || 'N/A';
      
      // Skills
      const skillElements = document.querySelectorAll('.key-skill');
      const skills = Array.from(skillElements).map(el => el.textContent.trim()).join(', ');
      
      // Job description
      const jobDescription = document.querySelector('.job-desc')?.textContent.trim() || 'N/A';
      
      // Posted date
      const postedDate = document.querySelector('.jd-stats .stat:nth-child(1) .stat-value')?.textContent.trim() || 'N/A';
      
      // Job URL
      const url = window.location.href;
      
      return {
        title,
        company,
        experience,
        location,
        salary,
        skills,
        jobDescription,
        postedDate,
        url
      };
    });
    
    return jobData;
  } catch (error) {
    console.error('Error extracting job details:', error);
    return null;
  }
};

// Function to bypass CAPTCHA (basic detection)
const handleCaptcha = async (page) => {
  try {
    // Check if CAPTCHA is present
    const captchaExists = await page.evaluate(() => {
      return document.body.textContent.includes('CAPTCHA') || 
             document.body.textContent.includes('captcha') ||
             document.body.textContent.includes('robot') ||
             document.body.textContent.includes('verification');
    });
    
    if (captchaExists) {
      console.log('CAPTCHA detected! Waiting for manual intervention...');
      // Wait for manual intervention (up to 2 minutes)
      await page.waitForNavigation({ timeout: 120000 }).catch(() => {});
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error handling CAPTCHA:', error);
    return false;
  }
};

// Function to check if we're blocked
const checkIfBlocked = async (page) => {
  try {
    const isBlocked = await page.evaluate(() => {
      return document.body.textContent.includes('Access Denied') || 
             document.body.textContent.includes('blocked') ||
             document.body.textContent.includes('403') ||
             document.title.includes('Access Denied');
    });
    
    return isBlocked;
  } catch (error) {
    console.error('Error checking if blocked:', error);
    return false;
  }
};

// Main crawler function
const crawlNaukri = async () => {
  console.log('Starting Naukri advanced crawler...');
  
  // Configure browser launch options
  const launchOptions = {
    headless: HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-features=site-per-process',
    ],
    defaultViewport: { width: 1920, height: 1080 }
  };
  
  // Add proxy if configured
  if (PROXY_SERVER) {
    console.log(`Using proxy: ${PROXY_SERVER}`);
    launchOptions.args.push(`--proxy-server=${PROXY_SERVER}`);
  }
  
  // Launch browser with stealth mode
  const browser = await puppeteer.launch(launchOptions);
  
  try {
    const page = await browser.newPage();
    
    // Set proxy credentials if needed
    if (PROXY_SERVER && PROXY_USERNAME && PROXY_PASSWORD) {
      await page.authenticate({
        username: PROXY_USERNAME,
        password: PROXY_PASSWORD
      });
    }
    
    // Set user agent to mimic a real browser
    await page.setUserAgent(USER_AGENT);
    
    // Set extra HTTP headers to appear more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    });
    
    // Enable JavaScript
    await page.setJavaScriptEnabled(true);
    
    // Set cookies to appear as a returning user
    await page.setCookie({
      name: 'returning_user',
      value: 'true',
      domain: 'naukri.com',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
    });
    
    // Randomize the order of setting up the page to avoid fingerprinting
    if (Math.random() > 0.5) {
      await page.evaluateOnNewDocument(() => {
        // Override the navigator properties to avoid detection
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });
    }
    
    // Intercept and modify requests to avoid detection patterns
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Modify headers for specific requests
      if (request.resourceType() === 'document' || request.resourceType() === 'xhr') {
        const headers = request.headers();
        headers['Referer'] = 'https://www.google.com/';
        request.continue({ headers });
      } else {
        request.continue();
      }
    });
    
    // Navigate to Naukri.com
    console.log('Navigating to Naukri.com...');
    await page.goto('https://www.naukri.com/', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    // Check if we're blocked
    if (await checkIfBlocked(page)) {
      console.log('Access blocked! Try using a different proxy or user agent.');
      return;
    }
    
    // Handle CAPTCHA if present
    await handleCaptcha(page);
    
    // Wait for page to load completely
    await randomDelay(3000, 5000);
    
    // Simulate human scrolling and mouse movement
    await simulateHumanScrolling(page);
    await simulateHumanMouseMovement(page);
    
    // Search for Node.js jobs
    console.log(`Searching for ${SEARCH_KEYWORD} jobs...`);
    
    // Type the search keyword with variable timing
    const keyword = SEARCH_KEYWORD;
    for (let i = 0; i < keyword.length; i++) {
      await page.type('#qsb-keyword-sugg', keyword[i], { delay: Math.floor(Math.random() * 100) + 50 });
    }
    
    await randomDelay(1000, 2000);
    
    // Click search button
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
      page.click('.qsbSubmit')
    ]);
    
    // Check if we're blocked after search
    if (await checkIfBlocked(page)) {
      console.log('Access blocked after search! Try using a different proxy or user agent.');
      return;
    }
    
    // Handle CAPTCHA if present
    await handleCaptcha(page);
    
    // Apply experience filter
    console.log(`Applying experience filter: ${EXPERIENCE_RANGE} years...`);
    await page.waitForSelector('.filter-item:nth-child(1) .filter-head', { timeout: 30000 });
    
    // Simulate human behavior before clicking
    await simulateHumanMouseMovement(page);
    
    await page.click('.filter-item:nth-child(1) .filter-head');
    await randomDelay(1000, 2000);
    
    // Find and click the appropriate experience range checkbox
    const expCheckboxes = await page.$$('.filter-item:nth-child(1) .filter-body .chkbox');
    for (let i = 0; i < expCheckboxes.length; i++) {
      const labelText = await page.evaluate(el => {
        return el.nextElementSibling.textContent.trim();
      }, expCheckboxes[i]);
      
      if (labelText.includes(EXPERIENCE_RANGE)) {
        // Simulate human behavior before clicking
        await simulateHumanMouseMovement(page);
        await expCheckboxes[i].click();
        break;
      }
    }
    
    await randomDelay(2000, 4000);
    
    // Collect job data
    console.log('Collecting job data...');
    const jobResults = [];
    
    let jobsScraped = 0;
    let currentPage = 1;
    
    while (jobsScraped < RESULTS_LIMIT) {
      console.log(`Scraping page ${currentPage}...`);
      
      // Wait for job cards to load
      await page.waitForSelector('.jobTuple', { timeout: 30000 });
      
      // Simulate human scrolling
      await simulateHumanScrolling(page);
      
      // Get all job cards on the current page
      const jobCards = await page.$$('.jobTuple');
      
      // Process each job card
      for (let i = 0; i < jobCards.length && jobsScraped < RESULTS_LIMIT; i++) {
        console.log(`Processing job ${jobsScraped + 1}/${RESULTS_LIMIT}`);
        
        try {
          // Extract job details
          const jobData = await extractJobDetails(page, jobCards[i]);
          
          if (jobData) {
            jobResults.push(jobData);
            jobsScraped++;
            
            // Go back to the search results page
            await page.goBack({ waitUntil: 'networkidle2', timeout: 30000 });
            await randomDelay(2000, 3000);
            
            // Handle CAPTCHA if present
            await handleCaptcha(page);
            
            // Re-get job cards as the page has been reloaded
            const updatedJobCards = await page.$$('.jobTuple');
            jobCards[i] = updatedJobCards[i];
          }
        } catch (error) {
          console.error(`Error processing job ${i + 1}:`, error);
          // Try to go back to the search results page if there's an error
          try {
            await page.goBack({ waitUntil: 'networkidle2', timeout: 30000 });
            await randomDelay(2000, 3000);
            
            // Handle CAPTCHA if present
            await handleCaptcha(page);
          } catch (e) {
            console.error('Error navigating back:', e);
          }
        }
      }
      
      // Check if we need to go to the next page
      if (jobsScraped < RESULTS_LIMIT) {
        try {
          // Simulate human scrolling and mouse movement
          await simulateHumanScrolling(page);
          await simulateHumanMouseMovement(page);
          
          // Click the next page button
          const nextPageButton = await page.$('.pagination a.fright');
          if (nextPageButton) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
              nextPageButton.click()
            ]);
            currentPage++;
            await randomDelay(3000, 5000);
            
            // Handle CAPTCHA if present
            await handleCaptcha(page);
          } else {
            console.log('No more pages available.');
            break;
          }
        } catch (error) {
          console.error('Error navigating to next page:', error);
          break;
        }
      }
    }
    
    // Write results to CSV
    console.log(`Writing ${jobResults.length} job results to ${OUTPUT_FILE}...`);
    await csvWriter.writeRecords(jobResults);
    
    console.log('Crawling completed successfully!');
  } catch (error) {
    console.error('Error during crawling:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
};

// Start the crawler
crawlNaukri().catch(error => {
  console.error('Crawler failed:', error);
});
