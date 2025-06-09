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

// Function to extract job details from a job card
const extractJobDetails = async (page, jobCard) => {
  try {
    // Click on the job card to open job details
    await jobCard.click();
    await randomDelay(2000, 4000);
    
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

// Main crawler function
const crawlNaukri = async () => {
  console.log('Starting Naukri crawler...');
  
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
      'Upgrade-Insecure-Requests': '1'
    });
    
    // Enable JavaScript
    await page.setJavaScriptEnabled(true);
    
    // Navigate to Naukri.com
    console.log('Navigating to Naukri.com...');
    await page.goto('https://www.naukri.com/', { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for page to load completely
    await randomDelay(3000, 5000);
    
    // Search for Node.js jobs
    console.log(`Searching for ${SEARCH_KEYWORD} jobs...`);
    await page.type('#qsb-keyword-sugg', SEARCH_KEYWORD);
    await randomDelay(1000, 2000);
    
    // Click search button
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
      page.click('.qsbSubmit')
    ]);
    
    // Apply experience filter
    console.log(`Applying experience filter: ${EXPERIENCE_RANGE} years...`);
    await page.waitForSelector('.filter-item:nth-child(1) .filter-head', { timeout: 30000 });
    await page.click('.filter-item:nth-child(1) .filter-head');
    await randomDelay(1000, 2000);
    
    // Find and click the appropriate experience range checkbox
    const expCheckboxes = await page.$$('.filter-item:nth-child(1) .filter-body .chkbox');
    for (let i = 0; i < expCheckboxes.length; i++) {
      const labelText = await page.evaluate(el => {
        return el.nextElementSibling.textContent.trim();
      }, expCheckboxes[i]);
      
      if (labelText.includes(EXPERIENCE_RANGE)) {
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
          } catch (e) {
            console.error('Error navigating back:', e);
          }
        }
      }
      
      // Check if we need to go to the next page
      if (jobsScraped < RESULTS_LIMIT) {
        try {
          // Click the next page button
          const nextPageButton = await page.$('.pagination a.fright');
          if (nextPageButton) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
              nextPageButton.click()
            ]);
            currentPage++;
            await randomDelay(3000, 5000);
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
