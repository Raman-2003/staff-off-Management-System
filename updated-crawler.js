require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');

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
const extractJobDetails = async (page, jobCard, index) => {
  try {
    console.log(`Extracting details for job ${index + 1}...`);
    
    // Extract data directly from the job card
    const jobData = await page.evaluate((card) => {
      // Use document.evaluate to find elements within the specific job card
      const getTextContent = (xpath, contextNode) => {
        const result = document.evaluate(
          xpath, 
          contextNode, 
          null, 
          XPathResult.FIRST_ORDERED_NODE_TYPE, 
          null
        );
        return result.singleNodeValue ? result.singleNodeValue.textContent.trim() : 'N/A';
      };
      
      // Job title
      const title = getTextContent('.//a[contains(@class, "title")]', card) || 
                    getTextContent('.//a[contains(@class, "jobTitle")]', card);
      
      // Company name
      const company = getTextContent('.//a[contains(@class, "companyName")]', card) || 
                      getTextContent('.//a[contains(@class, "company")]', card) ||
                      getTextContent('.//div[contains(@class, "company")]', card);
      
      // Experience
      const experience = getTextContent('.//span[contains(@class, "experience")]', card) || 
                         getTextContent('.//li[contains(text(), "yrs")]', card);
      
      // Location
      const location = getTextContent('.//span[contains(@class, "location")]', card) || 
                       getTextContent('.//li[contains(@class, "location")]', card);
      
      // Salary (if available)
      const salary = getTextContent('.//span[contains(@class, "salary")]', card) || 
                     getTextContent('.//li[contains(@class, "salary")]', card) || 'N/A';
      
      // Job URL
      const url = card.querySelector('a.title')?.href || 
                  card.querySelector('a.jobTitle')?.href || '';
      
      return {
        title,
        company,
        experience,
        location,
        salary,
        url
      };
    }, jobCard);
    
    // Click on the job card to open job details
    await page.evaluate(card => {
      const titleLink = card.querySelector('a.title') || card.querySelector('a.jobTitle');
      if (titleLink) titleLink.click();
    }, jobCard);
    
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await randomDelay(2000, 4000);
    
    // Extract additional data from the job details page
    const additionalData = await page.evaluate(() => {
      // Skills
      const skillElements = document.querySelectorAll('.key-skill') || 
                           document.querySelectorAll('.chip');
      const skills = Array.from(skillElements).map(el => el.textContent.trim()).join(', ');
      
      // Job description
      const jobDescription = document.querySelector('.job-desc')?.textContent.trim() || 
                            document.querySelector('.dang-inner-html')?.textContent.trim() || 'N/A';
      
      // Posted date
      const postedDate = document.querySelector('.stat-value')?.textContent.trim() || 
                         document.querySelector('.time')?.textContent.trim() || 'N/A';
      
      return {
        skills,
        jobDescription,
        postedDate
      };
    });
    
    // Combine the data
    const completeJobData = {
      ...jobData,
      ...additionalData
    };
    
    // Go back to the search results page
    await page.goBack({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await randomDelay(2000, 3000);
    
    return completeJobData;
  } catch (error) {
    console.error('Error extracting job details:', error);
    
    // Try to go back to the search results page if there's an error
    try {
      await page.goBack({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await randomDelay(2000, 3000);
    } catch (e) {
      console.error('Error navigating back:', e);
    }
    
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
    
    // Take a screenshot to see what we're dealing with
    await page.screenshot({ path: 'naukri-homepage.png' });
    console.log('Saved screenshot of homepage to naukri-homepage.png');
    
    // Search for Node.js jobs - using the search box that's visible
    console.log(`Searching for ${SEARCH_KEYWORD} jobs...`);
    
    // Try different selectors for the search box
    const searchSelectors = [
      'input#qsb-keyword-sugg',
      'input#keyword',
      'input[placeholder="Skills, Designations, Companies"]',
      'input[name="keyword"]',
      'input.suggestor-input'
    ];
    
    let searchBoxFound = false;
    for (const selector of searchSelectors) {
      const searchBox = await page.$(selector);
      if (searchBox) {
        await searchBox.click();
        await searchBox.type(SEARCH_KEYWORD);
        searchBoxFound = true;
        console.log(`Found search box with selector: ${selector}`);
        break;
      }
    }
    
    if (!searchBoxFound) {
      console.log('Could not find search box, trying to interact with the page...');
      // Take another screenshot
      await page.screenshot({ path: 'naukri-search-attempt.png' });
      console.log('Saved screenshot to naukri-search-attempt.png');
      
      // Try to directly navigate to search results
      await page.goto(`https://www.naukri.com/node-js-jobs?experience=${EXPERIENCE_RANGE}`, 
        { waitUntil: 'networkidle2', timeout: 60000 });
    } else {
      // Click search button
      const searchButtonSelectors = [
        'button.qsbSubmit',
        'button[type="submit"]',
        'button.search-btn',
        'form button'
      ];
      
      let searchButtonFound = false;
      for (const selector of searchButtonSelectors) {
        const searchButton = await page.$(selector);
        if (searchButton) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
            searchButton.click()
          ]);
          searchButtonFound = true;
          console.log(`Clicked search button with selector: ${selector}`);
          break;
        }
      }
      
      if (!searchButtonFound) {
        console.log('Could not find search button, trying to submit the form...');
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
      }
    }
    
    // Take a screenshot of search results
    await page.screenshot({ path: 'naukri-search-results.png' });
    console.log('Saved screenshot of search results to naukri-search-results.png');
    
    // Apply experience filter if not already in the URL
    if (!page.url().includes('experience=')) {
      console.log(`Applying experience filter: ${EXPERIENCE_RANGE} years...`);
      
      // Try different selectors for experience filter
      const expFilterSelectors = [
        '.filter-item:nth-child(1) .filter-head',
        '.experience-filter',
        'div[data-filter="experience"]',
        'a[data-filter="experience"]'
      ];
      
      let expFilterFound = false;
      for (const selector of expFilterSelectors) {
        const expFilter = await page.$(selector);
        if (expFilter) {
          await expFilter.click();
          await randomDelay(1000, 2000);
          expFilterFound = true;
          console.log(`Clicked experience filter with selector: ${selector}`);
          break;
        }
      }
      
      if (expFilterFound) {
        // Find and click the appropriate experience range checkbox
        const expRangeSelectors = [
          `.filter-item:nth-child(1) .filter-body input[value="${EXPERIENCE_RANGE}"] + label`,
          `input[value="${EXPERIENCE_RANGE}"] + label`,
          `label:contains("${EXPERIENCE_RANGE}")`,
          `.experience-filter-container input[value="${EXPERIENCE_RANGE}"] + label`
        ];
        
        let expRangeFound = false;
        for (const selector of expRangeSelectors) {
          try {
            const expRange = await page.$(selector);
            if (expRange) {
              await expRange.click();
              await randomDelay(2000, 4000);
              expRangeFound = true;
              console.log(`Selected experience range with selector: ${selector}`);
              break;
            }
          } catch (error) {
            console.log(`Error with selector ${selector}:`, error.message);
          }
        }
        
        if (!expRangeFound) {
          console.log('Could not find specific experience range, trying to modify URL...');
          await page.goto(`${page.url()}&experience=${EXPERIENCE_RANGE}`, 
            { waitUntil: 'networkidle2', timeout: 60000 });
        }
      } else {
        console.log('Could not find experience filter, trying to modify URL...');
        await page.goto(`${page.url()}&experience=${EXPERIENCE_RANGE}`, 
          { waitUntil: 'networkidle2', timeout: 60000 });
      }
    }
    
    await randomDelay(2000, 4000);
    
    // Take a screenshot after applying filters
    await page.screenshot({ path: 'naukri-filtered-results.png' });
    console.log('Saved screenshot of filtered results to naukri-filtered-results.png');
    
    // Collect job data
    console.log('Collecting job data...');
    const jobResults = [];
    
    let jobsScraped = 0;
    let currentPage = 1;
    
    while (jobsScraped < RESULTS_LIMIT) {
      console.log(`Scraping page ${currentPage}...`);
      
      // Try different selectors for job cards
      const jobCardSelectors = [
        '.jobTuple',
        '.job-card',
        '.jobTupleWrapper',
        'article.jobTuple',
        'div[type="tuple"]'
      ];
      
      let jobCards = [];
      for (const selector of jobCardSelectors) {
        jobCards = await page.$$(selector);
        if (jobCards.length > 0) {
          console.log(`Found ${jobCards.length} job cards with selector: ${selector}`);
          break;
        }
      }
      
      if (jobCards.length === 0) {
        console.log('No job cards found on this page.');
        break;
      }
      
      // Process each job card
      for (let i = 0; i < jobCards.length && jobsScraped < RESULTS_LIMIT; i++) {
        console.log(`Processing job ${jobsScraped + 1}/${RESULTS_LIMIT}`);
        
        try {
          // Extract job details
          const jobData = await extractJobDetails(page, jobCards[i], i);
          
          if (jobData) {
            jobResults.push(jobData);
            jobsScraped++;
            console.log(`Successfully extracted data for job ${jobsScraped}`);
          }
        } catch (error) {
          console.error(`Error processing job ${i + 1}:`, error);
        }
      }
      
      // Check if we need to go to the next page
      if (jobsScraped < RESULTS_LIMIT) {
        try {
          // Try different selectors for next page button
          const nextPageSelectors = [
            '.pagination a.fright',
            'a.next',
            'a[title="Next"]',
            '.pagination a:last-child',
            'a.nextPage'
          ];
          
          let nextPageFound = false;
          for (const selector of nextPageSelectors) {
            const nextPageButton = await page.$(selector);
            if (nextPageButton) {
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
                nextPageButton.click()
              ]);
              currentPage++;
              await randomDelay(3000, 5000);
              nextPageFound = true;
              console.log(`Navigated to next page using selector: ${selector}`);
              break;
            }
          }
          
          if (!nextPageFound) {
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
