require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Apply stealth plugin to bypass anti-bot measures
puppeteer.use(StealthPlugin());

// Configuration
const SEARCH_KEYWORD = process.env.SEARCH_KEYWORD || 'JAVA';
const EXPERIENCE_RANGE = process.env.EXPERIENCE_RANGE || '0-2';
const RESULTS_LIMIT = parseInt(process.env.RESULTS_LIMIT || '50');
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

// Function to simulate human-like scrolling
const simulateHumanScrolling = async (page) => {
  await page.evaluate(async () => {
    const scrollHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;
    let currentPosition = 0;
    
    // Random number of scroll steps (3-7)
    const scrollSteps = Math.floor(Math.random() * 5) + 3;
    
    for (let i = 0; i < scrollSteps; i++) {
      // Calculate a random scroll amount
      const scrollAmount = Math.floor(viewportHeight / scrollSteps);
      currentPosition += scrollAmount;
      
      // Add some randomness to the scroll amount
      const randomOffset = Math.floor(Math.random() * 100) - 50;
      const targetPosition = Math.min(currentPosition + randomOffset, scrollHeight);
      
      // Scroll smoothly
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
      
      // Wait a random amount of time between scrolls
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    }
    
    // Sometimes scroll back up a bit
    if (Math.random() > 0.7) {
      const upScrollAmount = Math.floor(Math.random() * (currentPosition / 2));
      window.scrollTo({
        top: currentPosition - upScrollAmount,
        behavior: 'smooth'
      });
      
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));
    }
  });
  
  await randomDelay(500, 1500);
};

// Function to simulate human-like mouse movements
const simulateHumanMouseMovement = async (page) => {
  await page.evaluate(async () => {
    // Create a div to track mouse position
    const tracker = document.createElement('div');
    tracker.style.position = 'fixed';
    tracker.style.top = '0';
    tracker.style.left = '0';
    tracker.style.width = '5px';
    tracker.style.height = '5px';
    tracker.style.backgroundColor = 'transparent';
    tracker.style.zIndex = '10000';
    tracker.style.pointerEvents = 'none';
    document.body.appendChild(tracker);
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Generate random number of mouse movements (3-7)
    const movementCount = Math.floor(Math.random() * 5) + 3;
    
    for (let i = 0; i < movementCount; i++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      
      // Move the tracker in small steps to simulate smooth movement
      const startX = parseInt(tracker.style.left) || 0;
      const startY = parseInt(tracker.style.top) || 0;
      const steps = 10;
      
      for (let j = 0; j <= steps; j++) {
        const currentX = startX + (x - startX) * (j / steps);
        const currentY = startY + (y - startY) * (j / steps);
        
        tracker.style.left = `${currentX}px`;
        tracker.style.top = `${currentY}px`;
        
        // Dispatch a real mouse event
        const mouseEvent = new MouseEvent('mousemove', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: currentX,
          clientY: currentY
        });
        
        document.elementFromPoint(currentX, currentY)?.dispatchEvent(mouseEvent);
        
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));
    }
    
    // Remove the tracker
    document.body.removeChild(tracker);
  });
  
  await randomDelay(300, 800);
};

// Function to extract job data using direct API call
const fetchJobsWithAPI = async () => {
  try {
    console.log('Attempting to fetch jobs using direct API call...');
    
    // Use curl to make the request with specific headers to mimic a browser
    const curlCommand = `curl -s -X GET \\
      "https://www.naukri.com/jobapi/v3/search?noOfResults=20&urlType=search_by_key_loc&searchType=adv&keyword=${encodeURIComponent(SEARCH_KEYWORD)}&experience=${EXPERIENCE_RANGE}&k=${encodeURIComponent(SEARCH_KEYWORD)}&seoKey=node-js-jobs&src=jobsearchDesk&latLong=" \\
      -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" \\
      -H "Accept: application/json, text/plain, */*" \\
      -H "Accept-Language: en-US,en;q=0.9" \\
      -H "Referer: https://www.naukri.com/java-jobs?experience=${EXPERIENCE_RANGE}" \\
      -H "Origin: https://www.naukri.com" \\
      -H "Connection: keep-alive" \\
      -H "appid: 109" \\
      -H "systemid: 109"`;
    
    const response = execSync(curlCommand).toString();
    
    try {
      const data = JSON.parse(response);
      
      if (data && data.jobDetails && Array.isArray(data.jobDetails)) {
        console.log(`Found ${data.jobDetails.length} jobs via API`);
        
        return data.jobDetails.map(job => ({
          title: job.title || 'N/A',
          company: job.companyName || 'N/A',
          experience: `${job.minExp || 0}-${job.maxExp || 0} years`,
          location: Array.isArray(job.locations) ? job.locations.map(loc => loc.label).join(', ') : 'N/A',
          salary: job.salary || 'N/A',
          skills: Array.isArray(job.keySkills) ? job.keySkills.map(skill => skill.label).join(', ') : 'N/A',
          jobDescription: job.jobDescription ? job.jobDescription.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : 'N/A',
          postedDate: job.createdDate || 'N/A',
          url: `https://www.naukri.com/job-listings-${job.jobId}`
        }));
      } else {
        console.log('No job details found in API response');
        return [];
      }
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      
      // Save the raw response for debugging
      fs.writeFileSync('api_response.txt', response);
      console.log('Saved raw API response to api_response.txt');
      
      return [];
    }
  } catch (error) {
    console.error('Error fetching jobs with API:', error);
    return [];
  }
};

// Function to extract job data using direct HTML scraping
const scrapeJobsFromHTML = async (page) => {
  try {
    console.log('Attempting to scrape jobs from HTML...');
    
    // Wait for job cards to load with a more flexible approach
    await page.waitForFunction(() => {
      return document.querySelectorAll('div[data-job-id], article.jobTuple, .jobTupleWrapper, .job-card, .job-container').length > 0;
    }, { timeout: 30000 }).catch(() => {
      console.log('Timeout waiting for job cards to load');
    });
    
    // Take a screenshot
    const screenshotPath = path.join(__dirname, 'screenshots', `search-results-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved screenshot to ${screenshotPath}`);
    
    // Extract job data
    const jobs = await page.evaluate(() => {
      // Try multiple selectors to find job cards
      const selectors = [
        'div[data-job-id]',
        'article.jobTuple',
        '.jobTupleWrapper',
        '.job-card',
        '.job-container',
        '.jobTuple',
        '.job-tuple'
      ];
      
      let jobCards = [];
      
      // Try each selector until we find job cards
      for (const selector of selectors) {
        const cards = document.querySelectorAll(selector);
        if (cards.length > 0) {
          jobCards = Array.from(cards);
          console.log(`Found ${jobCards.length} job cards with selector: ${selector}`);
          break;
        }
      }
      
      if (jobCards.length === 0) {
        console.log('No job cards found with any selector');
        return [];
      }
      
      return jobCards.map(card => {
        // Try multiple selectors for each piece of information
        const getTextContent = (selectors, parent = card) => {
          for (const selector of selectors) {
            const element = parent.querySelector(selector);
            if (element) {
              return element.textContent.trim();
            }
          }
          return 'N/A';
        };
        
        const getUrl = (selectors, parent = card) => {
          for (const selector of selectors) {
            const element = parent.querySelector(selector);
            if (element && element.href) {
              return element.href;
            }
          }
          return '';
        };
        
        // Extract job details
        const title = getTextContent([
          'a.title', 
          'a.jobTitle', 
          '.jobTitleText a',
          '.title a',
          'a.job-title'
        ]);
        
        const company = getTextContent([
          'a.companyName', 
          'a.company', 
          '.companyInfo a',
          '.company-name',
          '.company'
        ]);
        
        const experience = getTextContent([
          '.experience', 
          '.expwdth span', 
          '.exp span',
          'li.experience',
          '.exp'
        ]);
        
        const location = getTextContent([
          '.location', 
          '.locwdth span', 
          '.loc span',
          'li.location',
          '.loc'
        ]);
        
        const salary = getTextContent([
          '.salary', 
          '.sal span',
          'li.salary',
          '.sal'
        ]);
        
        const url = getUrl([
          'a.title', 
          'a.jobTitle', 
          '.jobTitleText a',
          '.title a',
          'a.job-title'
        ]);
        
        // Get the job ID from the URL
        let jobId = '';
        if (url) {
          const match = url.match(/job-listings-([\\w-]+)/);
          if (match) jobId = match[1];
        } else if (card.dataset && card.dataset.jobId) {
          jobId = card.dataset.jobId;
        }
        
        return {
          title,
          company,
          experience,
          location,
          salary,
          jobId,
          url,
          skills: 'N/A', // Will be populated later if needed
          jobDescription: 'N/A', // Will be populated later if needed
          postedDate: 'N/A' // Will be populated later if needed
        };
      });
    });
    
    console.log(`Extracted ${jobs.length} jobs from HTML`);
    return jobs;
  } catch (error) {
    console.error('Error scraping jobs from HTML:', error);
    return [];
  }
};

// Function to fetch job details for a specific job
const fetchJobDetails = async (jobUrl) => {
  try {
    console.log(`Fetching details for job: ${jobUrl}`);
    
    // Use curl to fetch the job details page
    const curlCommand = `curl -s -L \\
      "${jobUrl}" \\
      -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" \\
      -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" \\
      -H "Accept-Language: en-US,en;q=0.9" \\
      -H "Referer: https://www.naukri.com/" \\
      -H "Connection: keep-alive"`;
    
    const html = execSync(curlCommand).toString();
    
    // Save the HTML to a temporary file
    const tempFile = path.join(__dirname, `temp_job_${Date.now()}.html`);
    fs.writeFileSync(tempFile, html);
    
    // Extract job details using regex
    const skillsRegex = /<div[^>]*class="[^"]*key-skill[^"]*"[^>]*>([\s\S]*?)<\/div>|<span[^>]*class="[^"]*chip[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
    const descriptionRegex = /<div[^>]*class="[^"]*job-desc[^"]*"[^>]*>([\s\S]*?)<\/div>|<div[^>]*class="[^"]*dang-inner-html[^"]*"[^>]*>([\s\S]*?)<\/div>/;
    const postedDateRegex = /<div[^>]*class="[^"]*stat-value[^"]*"[^>]*>([\s\S]*?)<\/div>|<span[^>]*class="[^"]*time[^"]*"[^>]*>([\s\S]*?)<\/span>/;
    
    // Extract skills
    let skills = [];
    let match;
    while ((match = skillsRegex.exec(html)) !== null) {
      const skill = match[1] || match[2];
      if (skill) {
        skills.push(skill.replace(/<[^>]*>/g, '').trim());
      }
    }
    
    // Extract job description
    const descriptionMatch = html.match(descriptionRegex);
    const jobDescription = descriptionMatch 
      ? descriptionMatch[1] || descriptionMatch[2]
      : 'N/A';
    
    // Extract posted date
    const postedDateMatch = html.match(postedDateRegex);
    const postedDate = postedDateMatch 
      ? postedDateMatch[1] || postedDateMatch[2]
      : 'N/A';
    
    // Clean up the temporary file
    fs.unlinkSync(tempFile);
    
    return {
      skills: skills.join(', ') || 'N/A',
      jobDescription: jobDescription.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim() || 'N/A',
      postedDate: postedDate.replace(/<[^>]*>/g, '').trim() || 'N/A'
    };
  } catch (error) {
    console.error(`Error fetching job details for ${jobUrl}:`, error);
    return {
      skills: 'N/A',
      jobDescription: 'N/A',
      postedDate: 'N/A'
    };
  }
};

// Main crawler function
const crawlNaukri = async () => {
  console.log('Starting enhanced Naukri crawler...');
  
  // Create screenshots directory if it doesn't exist
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }
  
  // Try API approach first
  const apiJobs = await fetchJobsWithAPI();
  
  if (apiJobs.length > 0) {
    console.log(`Successfully fetched ${apiJobs.length} jobs via API. Writing to CSV...`);
    await csvWriter.writeRecords(apiJobs.slice(0, RESULTS_LIMIT));
    console.log(`Wrote ${Math.min(apiJobs.length, RESULTS_LIMIT)} jobs to ${OUTPUT_FILE}`);
    return;
  }
  
  console.log('API approach failed. Trying browser approach...');
  
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
    
    // Randomize the order of setting up the page to avoid fingerprinting
    if (Math.random() > 0.5) {
      // Override the navigator properties to avoid detection
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Overwrite the plugins property to use a custom getter
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            // This just needs to have a length property
            return { length: 3 };
          },
        });
        
        // Overwrite the languages property to use a custom getter
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      });
    }
    
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
        headers['Referer'] = 'https://www.google.com/search?q=java+jobs+naukri';
        request.continue({ headers });
      } else {
        request.continue();
      }
    });
    
    // Navigate to Naukri.com
    console.log('Navigating to Naukri.com...');
    await page.goto('https://www.naukri.com/', { waitUntil: 'networkidle2', timeout: 60000 });
    await randomDelay(3000, 5000);
    
    // Take a screenshot
    const homepageScreenshot = path.join(screenshotsDir, `homepage-${Date.now()}.png`);
    await page.screenshot({ path: homepageScreenshot, fullPage: true });
    console.log(`Saved screenshot to ${homepageScreenshot}`);
    
    // Simulate human-like behavior
    await simulateHumanScrolling(page);
    await simulateHumanMouseMovement(page);
    
    // Search for Node.js jobs
    console.log(`Searching for ${SEARCH_KEYWORD} jobs...`);
    
    // Try different selectors for the search box
    const searchSelectors = [
      'input#qsb-keyword-sugg',
      'input#keyword',
      'input[placeholder="Skills, Designations, Companies"]',
      'input[name="keyword"]',
      'input.suggestor-input',
      'input[type="text"]'
    ];
    
    let searchBoxFound = false;
    for (const selector of searchSelectors) {
      try {
        const searchBox = await page.$(selector);
        if (searchBox) {
          await searchBox.click();
          await randomDelay(500, 1000);
          
          // Type with random delays between keystrokes
          for (const char of SEARCH_KEYWORD) {
            await searchBox.type(char, { delay: Math.floor(Math.random() * 100) + 50 });
            await randomDelay(50, 150);
          }
          
          searchBoxFound = true;
          console.log(`Found search box with selector: ${selector}`);
          break;
        }
      } catch (error) {
        console.log(`Error with selector ${selector}:`, error.message);
      }
    }
    
    if (!searchBoxFound) {
      console.log('Could not find search box, trying direct URL navigation...');
      await page.goto(`https://www.naukri.com/java-jobs-${EXPERIENCE_RANGE}-years`, { waitUntil: 'networkidle2', timeout: 60000 });
    } else {
      // Try to submit the search
      try {
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      } catch (error) {
        console.error('Error submitting search:', error);
      }
    }
    
    await randomDelay(3000, 5000);
    
    // Take a screenshot of search results
    const searchResultsScreenshot = path.join(screenshotsDir, `search-results-${Date.now()}.png`);
    await page.screenshot({ path: searchResultsScreenshot, fullPage: true });
    console.log(`Saved screenshot to ${searchResultsScreenshot}`);
    
    // Simulate human-like behavior
    await simulateHumanScrolling(page);
    await simulateHumanMouseMovement(page);
    
    // Scrape jobs from the page
    const jobs = await scrapeJobsFromHTML(page);
    
    if (jobs.length === 0) {
      console.log('No jobs found on the page. Trying direct URL navigation...');
      
      // Try a different URL format
      await page.goto(`https://www.naukri.com/java-jobs?experience=${EXPERIENCE_RANGE}`, { waitUntil: 'networkidle2', timeout: 60000 });
      await randomDelay(3000, 5000);
      
      // Take another screenshot
      const altUrlScreenshot = path.join(screenshotsDir, `alt-url-${Date.now()}.png`);
      await page.screenshot({ path: altUrlScreenshot, fullPage: true });
      console.log(`Saved screenshot to ${altUrlScreenshot}`);
      
      // Simulate human-like behavior
      await simulateHumanScrolling(page);
      await simulateHumanMouseMovement(page);
      
      // Try scraping again
      const altJobs = await scrapeJobsFromHTML(page);
      
      if (altJobs.length > 0) {
        console.log(`Found ${altJobs.length} jobs with alternative URL`);
        
        // Process jobs
        const processedJobs = [];
        
        for (let i = 0; i < Math.min(altJobs.length, RESULTS_LIMIT); i++) {
          const job = altJobs[i];
          
          if (job.url) {
            // Fetch additional details
            const details = await fetchJobDetails(job.url);
            
            // Combine the data
            const completeJob = {
              ...job,
              ...details
            };
            
            processedJobs.push(completeJob);
            console.log(`Processed job ${i + 1}/${Math.min(altJobs.length, RESULTS_LIMIT)}: ${job.title}`);
          } else {
            processedJobs.push(job);
          }
        }
        
        // Write to CSV
        console.log(`Writing ${processedJobs.length} jobs to ${OUTPUT_FILE}...`);
        await csvWriter.writeRecords(processedJobs);
        console.log('Crawling completed successfully!');
      } else {
        console.log('Still no jobs found. Crawling failed.');
      }
    } else {
      console.log(`Found ${jobs.length} jobs. Processing...`);
      
      // Process jobs
      const processedJobs = [];
      
      for (let i = 0; i < Math.min(jobs.length, RESULTS_LIMIT); i++) {
        const job = jobs[i];
        
        if (job.url) {
          // Fetch additional details
          const details = await fetchJobDetails(job.url);
          
          // Combine the data
          const completeJob = {
            ...job,
            ...details
          };
          
          processedJobs.push(completeJob);
          console.log(`Processed job ${i + 1}/${Math.min(jobs.length, RESULTS_LIMIT)}: ${job.title}`);
        } else {
          processedJobs.push(job);
        }
      }
      
      // Write to CSV
      console.log(`Writing ${processedJobs.length} jobs to ${OUTPUT_FILE}...`);
      await csvWriter.writeRecords(processedJobs);
      console.log('Crawling completed successfully!');
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
