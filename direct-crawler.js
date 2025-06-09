require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');

// Apply stealth plugin to bypass anti-bot measures
puppeteer.use(StealthPlugin());

// Configuration - Load from .env file or use defaults
const SEARCH_KEYWORD = process.env.SEARCH_KEYWORD || 'Node.js';
const EXPERIENCE_RANGE = process.env.EXPERIENCE_RANGE || '2-5';
const RESULTS_LIMIT = parseInt(process.env.RESULTS_LIMIT || '50');
const OUTPUT_FILE = 'naukri_results.csv';

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir);
}

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

// Random delay function to make the crawler behavior more human-like
const randomDelay = async (min = 1000, max = 3000) => {
  const delay = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delay));
};

// Function to take a screenshot with timestamp
const takeScreenshot = async (page, name) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(screenshotsDir, `${name}-${timestamp}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Saved screenshot to ${filename}`);
  return filename;
};

// Function to extract job data directly from Naukri's search results
const extractJobsFromHTML = async (html) => {
  try {
    // Create a temporary file to store the HTML
    const tempFile = path.join(__dirname, 'temp.html');
    fs.writeFileSync(tempFile, html);
    
    // Parse the HTML using regex to extract job listings
    const jobRegex = /<div[^>]*class="[^"]*jobTuple[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    const titleRegex = /<a[^>]*class="[^"]*title[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/;
    const companyRegex = /<a[^>]*class="[^"]*companyName[^"]*"[^>]*>([\s\S]*?)<\/a>/;
    const experienceRegex = /<li[^>]*class="[^"]*experience[^"]*"[^>]*>([\s\S]*?)<\/li>/;
    const locationRegex = /<li[^>]*class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/li>/;
    const salaryRegex = /<li[^>]*class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\/li>/;
    
    const jobs = [];
    let match;
    
    // Read the HTML file
    const htmlContent = fs.readFileSync(tempFile, 'utf8');
    
    // Extract job listings
    while ((match = jobRegex.exec(htmlContent)) !== null) {
      const jobHTML = match[0];
      
      // Extract job details
      const titleMatch = jobHTML.match(titleRegex);
      const companyMatch = jobHTML.match(companyRegex);
      const experienceMatch = jobHTML.match(experienceRegex);
      const locationMatch = jobHTML.match(locationRegex);
      const salaryMatch = jobHTML.match(salaryRegex);
      
      if (titleMatch) {
        const url = titleMatch[1];
        const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();
        const company = companyMatch ? companyMatch[1].replace(/<[^>]*>/g, '').trim() : 'N/A';
        const experience = experienceMatch ? experienceMatch[1].replace(/<[^>]*>/g, '').trim() : 'N/A';
        const location = locationMatch ? locationMatch[1].replace(/<[^>]*>/g, '').trim() : 'N/A';
        const salary = salaryMatch ? salaryMatch[1].replace(/<[^>]*>/g, '').trim() : 'N/A';
        
        jobs.push({
          title,
          company,
          experience,
          location,
          salary,
          url,
          skills: 'N/A', // Will be filled in later
          jobDescription: 'N/A', // Will be filled in later
          postedDate: 'N/A' // Will be filled in later
        });
      }
    }
    
    // Clean up the temporary file
    fs.unlinkSync(tempFile);
    
    return jobs;
  } catch (error) {
    console.error('Error extracting jobs from HTML:', error);
    return [];
  }
};

// Function to extract job details directly from the page content
const extractJobDetailsFromPage = async (page) => {
  try {
    // Wait for job cards to load
    await page.waitForSelector('.jobTuple, .job-tuple, article.jobTuple', { timeout: 30000 }).catch(() => {
      console.log('Could not find job cards with standard selectors');
    });
    
    // Take a screenshot
    await takeScreenshot(page, 'search-results');
    
    // Get the page HTML
    const html = await page.content();
    
    // Extract jobs from HTML
    const jobs = await extractJobsFromHTML(html);
    console.log(`Extracted ${jobs.length} jobs from HTML`);
    
    return jobs;
  } catch (error) {
    console.error('Error extracting job details from page:', error);
    return [];
  }
};

// Function to fetch job details using curl (as a backup method)
const fetchWithCurl = async (url) => {
  try {
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      
      const command = `curl -s -L -A "${userAgent}" "${url}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        
        resolve(stdout);
      });
    });
  } catch (error) {
    console.error('Error fetching with curl:', error);
    return null;
  }
};

// Main crawler function
const crawlNaukri = async () => {
  console.log('Starting Naukri direct crawler...');
  
  // Launch browser with stealth mode
  const browser = await puppeteer.launch({
    headless: false, // Set to true for production
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security'
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Set user agent to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
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
    
    // Intercept requests to modify headers
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Add referer header to make requests look more legitimate
      if (request.resourceType() === 'document' || request.resourceType() === 'xhr') {
        const headers = request.headers();
        headers['Referer'] = 'https://www.google.com/search?q=node.js+jobs+naukri';
        request.continue({ headers });
      } else {
        request.continue();
      }
    });
    
    // Try direct URL approach first
    const searchUrl = `https://www.naukri.com/node-js-jobs-${EXPERIENCE_RANGE}-years`;
    console.log(`Navigating to: ${searchUrl}`);
    
    // Navigate to the search URL
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await randomDelay(3000, 5000);
    
    // Take a screenshot
    await takeScreenshot(page, 'initial-page');
    
    // Check if we're on a CAPTCHA page
    const isCaptcha = await page.evaluate(() => {
      return document.body.textContent.includes('CAPTCHA') || 
             document.body.textContent.includes('captcha') ||
             document.body.textContent.includes('robot') ||
             document.body.textContent.includes('verification');
    });
    
    if (isCaptcha) {
      console.log('CAPTCHA detected! Waiting for manual intervention...');
      console.log('Please solve the CAPTCHA in the browser window...');
      
      // Wait for user to solve CAPTCHA (2 minutes)
      await new Promise(resolve => setTimeout(resolve, 120000));
      
      // Take another screenshot after CAPTCHA
      await takeScreenshot(page, 'after-captcha');
    }
    
    // Collect job data
    console.log('Collecting job data...');
    const jobResults = [];
    
    let jobsScraped = 0;
    let currentPage = 1;
    
    while (jobsScraped < RESULTS_LIMIT) {
      console.log(`Scraping page ${currentPage}...`);
      
      // Try to extract jobs using Puppeteer
      let pageJobs = await extractJobDetailsFromPage(page);
      
      // If no jobs found, try alternative method with curl
      if (pageJobs.length === 0) {
        console.log('No jobs found with Puppeteer, trying curl...');
        const html = await fetchWithCurl(page.url());
        
        if (html) {
          pageJobs = await extractJobsFromHTML(html);
          console.log(`Found ${pageJobs.length} jobs with curl`);
        }
      }
      
      // If still no jobs found, try another URL format
      if (pageJobs.length === 0) {
        console.log('Still no jobs found, trying alternative URL format...');
        const altUrl = `https://www.naukri.com/job-listings-node-js-${EXPERIENCE_RANGE}-years`;
        
        await page.goto(altUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await randomDelay(3000, 5000);
        
        await takeScreenshot(page, 'alternative-url');
        
        pageJobs = await extractJobDetailsFromPage(page);
      }
      
      // Process found jobs
      for (const job of pageJobs) {
        if (jobsScraped >= RESULTS_LIMIT) break;
        
        jobResults.push(job);
        jobsScraped++;
        
        console.log(`Added job ${jobsScraped}/${RESULTS_LIMIT}: ${job.title}`);
      }
      
      // Check if we need to go to the next page
      if (jobsScraped < RESULTS_LIMIT && pageJobs.length > 0) {
        currentPage++;
        
        // Try to click next page button
        const nextPageClicked = await page.evaluate(() => {
          const nextButtons = [
            ...document.querySelectorAll('.pagination a.fright'),
            ...document.querySelectorAll('a.nextPage'),
            ...document.querySelectorAll('a[title="Next"]'),
            ...document.querySelectorAll('.pagination a:last-child')
          ];
          
          for (const btn of nextButtons) {
            if (btn && btn.textContent.includes('Next') || btn.textContent.includes('>')) {
              btn.click();
              return true;
            }
          }
          
          return false;
        });
        
        if (nextPageClicked) {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
          await randomDelay(3000, 5000);
        } else {
          // Try direct URL navigation to next page
          await page.goto(`${searchUrl}?pageNo=${currentPage}`, { waitUntil: 'networkidle2', timeout: 30000 });
          await randomDelay(3000, 5000);
        }
        
        await takeScreenshot(page, `page-${currentPage}`);
      } else {
        break;
      }
    }
    
    // Write results to CSV
    console.log(`Writing ${jobResults.length} job results to ${OUTPUT_FILE}...`);
    await csvWriter.writeRecords(jobResults);
    
    console.log('Crawling completed successfully!');
    
    // Open the CSV file to show results
    if (jobResults.length > 0) {
      console.log('Results saved to:', path.resolve(OUTPUT_FILE));
    }
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
