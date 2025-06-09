require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const axios = require('axios');

// Apply stealth plugin to bypass anti-bot measures
puppeteer.use(StealthPlugin());

// Configuration
const SEARCH_KEYWORD = 'Node.js';
const EXPERIENCE_RANGE = '2-5'; // Change as needed: '0-1', '1-2', '2-5', '5-7', '7-10', '10-15'
const RESULTS_LIMIT = 50; // Number of results to scrape
const OUTPUT_FILE = 'naukri_results.csv';

// Bright Data configuration
// Note: You need to sign up for Bright Data and get your own credentials
const BRIGHT_DATA_USERNAME = process.env.BRIGHT_DATA_USERNAME || 'YOUR_USERNAME';
const BRIGHT_DATA_PASSWORD = process.env.BRIGHT_DATA_PASSWORD || 'YOUR_PASSWORD';
const BRIGHT_DATA_HOST = process.env.BRIGHT_DATA_HOST || 'brd.superproxy.io';
const BRIGHT_DATA_PORT = process.env.BRIGHT_DATA_PORT || '22225';

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

// Function to extract job details from search results page
const extractJobsFromSearchPage = async (page) => {
  console.log('Extracting jobs from search page...');
  
  // Wait for job listings to load
  await page.waitForSelector('div[data-job-id]', { timeout: 30000 }).catch(() => {
    console.log('Could not find job listings with data-job-id selector');
  });
  
  // Take a screenshot to see what we're dealing with
  await page.screenshot({ path: 'naukri-search-results.png' });
  console.log('Saved screenshot of search results to naukri-search-results.png');
  
  // Extract job data
  const jobsData = await page.evaluate(() => {
    const jobCards = document.querySelectorAll('div[data-job-id], article.jobTuple, .jobTupleWrapper');
    
    if (jobCards.length === 0) {
      console.log('No job cards found on the page');
      return [];
    }
    
    return Array.from(jobCards).map(card => {
      // Extract job details
      const titleElement = card.querySelector('a.title, a.jobTitle, .jobTitleText a');
      const companyElement = card.querySelector('a.companyName, a.company, .companyInfo a');
      const experienceElement = card.querySelector('.experience, .expwdth span, .exp span');
      const locationElement = card.querySelector('.location, .locwdth span, .loc span');
      const salaryElement = card.querySelector('.salary, .sal span');
      
      // Get the job URL
      const jobUrl = titleElement ? titleElement.href : '';
      
      // Get the job ID from the URL or data attribute
      let jobId = '';
      if (jobUrl) {
        const match = jobUrl.match(/job-listings-(\w+)/);
        if (match) jobId = match[1];
      } else if (card.dataset.jobId) {
        jobId = card.dataset.jobId;
      }
      
      return {
        title: titleElement ? titleElement.textContent.trim() : 'N/A',
        company: companyElement ? companyElement.textContent.trim() : 'N/A',
        experience: experienceElement ? experienceElement.textContent.trim() : 'N/A',
        location: locationElement ? locationElement.textContent.trim() : 'N/A',
        salary: salaryElement ? salaryElement.textContent.trim() : 'N/A',
        jobId,
        url: jobUrl
      };
    });
  });
  
  console.log(`Found ${jobsData.length} jobs on this page`);
  return jobsData;
};

// Function to extract detailed job information
const extractJobDetails = async (page, jobUrl) => {
  console.log(`Extracting details from: ${jobUrl}`);
  
  // Navigate to the job page
  await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await randomDelay(2000, 4000);
  
  // Take a screenshot
  await page.screenshot({ path: `job-details-${Date.now()}.png` });
  
  // Extract additional job details
  const jobDetails = await page.evaluate(() => {
    // Skills
    const skillElements = document.querySelectorAll('.key-skill, .chip, .tags-gt');
    const skills = Array.from(skillElements).map(el => el.textContent.trim()).join(', ');
    
    // Job description
    const jobDescriptionElement = document.querySelector('.job-desc, .dang-inner-html, .job-description');
    const jobDescription = jobDescriptionElement ? jobDescriptionElement.textContent.trim() : 'N/A';
    
    // Posted date
    const postedDateElement = document.querySelector('.stat-value, .time, .date');
    const postedDate = postedDateElement ? postedDateElement.textContent.trim() : 'N/A';
    
    return {
      skills,
      jobDescription,
      postedDate
    };
  });
  
  return jobDetails;
};

// Alternative method: Use Bright Data's Web Unlocker API
const fetchWithBrightDataAPI = async (url) => {
  try {
    // This is a simplified example. In a real implementation, you would use
    // Bright Data's Web Unlocker API with proper authentication
    const response = await axios({
      method: 'get',
      url: 'https://api.brightdata.com/web-unlocker/request',
      params: {
        url: url
      },
      headers: {
        'Authorization': `Bearer ${process.env.BRIGHT_DATA_API_KEY}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error using Bright Data API:', error.message);
    return null;
  }
};

// Main crawler function
const crawlNaukri = async () => {
  console.log('Starting Naukri crawler with Bright Data...');
  
  // Bright Data proxy configuration
  const proxyUrl = `http://${BRIGHT_DATA_USERNAME}:${BRIGHT_DATA_PASSWORD}@${BRIGHT_DATA_HOST}:${BRIGHT_DATA_PORT}`;
  
  // Launch browser with proxy
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      `--proxy-server=${proxyUrl}`
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Set user agent to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Authenticate with the proxy if needed
    await page.authenticate({
      username: BRIGHT_DATA_USERNAME,
      password: BRIGHT_DATA_PASSWORD
    });
    
    // Navigate directly to the search results page
    const searchUrl = `https://www.naukri.com/node-js-jobs-${EXPERIENCE_RANGE}-years`;
    console.log(`Navigating to: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await randomDelay(3000, 5000);
    
    // Take a screenshot to see what we're dealing with
    await page.screenshot({ path: 'naukri-homepage.png' });
    console.log('Saved screenshot to naukri-homepage.png');
    
    // Collect job data
    console.log('Collecting job data...');
    const jobResults = [];
    
    let jobsScraped = 0;
    let currentPage = 1;
    
    while (jobsScraped < RESULTS_LIMIT) {
      console.log(`Scraping page ${currentPage}...`);
      
      // Extract jobs from the current page
      const pageJobs = await extractJobsFromSearchPage(page);
      
      if (pageJobs.length === 0) {
        console.log('No jobs found on this page. Trying alternative method...');
        
        // If we have a Bright Data API key, try using their Web Unlocker API
        if (process.env.BRIGHT_DATA_API_KEY) {
          console.log('Using Bright Data Web Unlocker API...');
          const data = await fetchWithBrightDataAPI(page.url());
          
          if (data && data.html) {
            // Parse the HTML response
            await page.setContent(data.html);
            const apiJobs = await extractJobsFromSearchPage(page);
            
            if (apiJobs.length > 0) {
              pageJobs.push(...apiJobs);
            }
          }
        }
        
        if (pageJobs.length === 0) {
          console.log('Still no jobs found. Moving on...');
          break;
        }
      }
      
      // Process each job
      for (const job of pageJobs) {
        if (jobsScraped >= RESULTS_LIMIT) break;
        
        try {
          if (job.url) {
            // Get detailed job information
            const details = await extractJobDetails(page, job.url);
            
            // Combine basic and detailed information
            const completeJobData = {
              ...job,
              ...details
            };
            
            jobResults.push(completeJobData);
            jobsScraped++;
            
            console.log(`Successfully scraped job ${jobsScraped}/${RESULTS_LIMIT}: ${job.title}`);
          }
        } catch (error) {
          console.error(`Error processing job:`, error);
        }
        
        // Go back to search results
        await page.goto(searchUrl + `?pageNo=${currentPage}`, { waitUntil: 'networkidle2', timeout: 30000 });
        await randomDelay(2000, 4000);
      }
      
      // Move to the next page if needed
      if (jobsScraped < RESULTS_LIMIT) {
        currentPage++;
        await page.goto(searchUrl + `?pageNo=${currentPage}`, { waitUntil: 'networkidle2', timeout: 30000 });
        await randomDelay(3000, 5000);
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

// Instructions for using this crawler:
/*
1. Sign up for Bright Data (https://brightdata.com/) and get your credentials
2. Create a .env file with your Bright Data credentials:
   BRIGHT_DATA_USERNAME=your_username
   BRIGHT_DATA_PASSWORD=your_password
   BRIGHT_DATA_HOST=brd.superproxy.io
   BRIGHT_DATA_PORT=22225
   BRIGHT_DATA_API_KEY=your_api_key (optional, for Web Unlocker API)
3. Install dependencies: npm install
4. Run the crawler: node bright-data-crawler.js
*/