require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');

// Configuration
const SEARCH_KEYWORD = 'Node.js';
const EXPERIENCE_MIN = 2;
const EXPERIENCE_MAX = 5;
const RESULTS_LIMIT = 50;
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

// Random delay function to make requests more human-like
const randomDelay = async (min = 1000, max = 3000) => {
  const delay = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delay));
};

// Function to generate random user agent
const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

// Function to search for jobs using Naukri's API
const searchJobs = async (keyword, experienceMin, experienceMax, page = 1) => {
  try {
    console.log(`Searching for ${keyword} jobs (Experience: ${experienceMin}-${experienceMax} years) - Page ${page}...`);
    
    // Create request headers to mimic a browser
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.naukri.com/',
      'Origin': 'https://www.naukri.com',
      'Connection': 'keep-alive',
      'sec-ch-ua': '"Google Chrome";v="91", "Chromium";v="91", ";Not A Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site'
    };

    // Construct the search URL
    // Note: This is based on observing Naukri's network requests, may need adjustments
    const url = `https://www.naukri.com/jobapi/v3/search?noOfResults=20&urlType=search_by_keyword&searchType=adv&keyword=${encodeURIComponent(keyword)}&experience=${experienceMin}to${experienceMax}&k=${encodeURIComponent(keyword)}&seoKey=node-js-jobs&src=jobsearchDesk&latLong=&pageNo=${page}`;
    
    const response = await axios.get(url, { headers });
    
    if (response.status === 200 && response.data) {
      return response.data;
    } else {
      console.error('Failed to get search results:', response.status);
      return null;
    }
  } catch (error) {
    console.error('Error searching jobs:', error.message);
    return null;
  }
};

// Function to get job details using job ID
const getJobDetails = async (jobId) => {
  try {
    console.log(`Fetching details for job ID: ${jobId}...`);
    
    // Create request headers to mimic a browser
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://www.naukri.com/job-listings-${jobId}`,
      'Origin': 'https://www.naukri.com',
      'Connection': 'keep-alive',
      'sec-ch-ua': '"Google Chrome";v="91", "Chromium";v="91", ";Not A Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site'
    };

    // Construct the job details URL
    const url = `https://www.naukri.com/jobapi/v4/job/${jobId}`;
    
    const response = await axios.get(url, { headers });
    
    if (response.status === 200 && response.data) {
      return response.data;
    } else {
      console.error('Failed to get job details:', response.status);
      return null;
    }
  } catch (error) {
    console.error(`Error getting details for job ${jobId}:`, error.message);
    return null;
  }
};

// Function to extract job data from API response
const extractJobData = (jobData) => {
  try {
    // Extract basic job information
    const jobInfo = {
      title: jobData.title || 'N/A',
      company: jobData.companyName || 'N/A',
      experience: `${jobData.minExp || 0}-${jobData.maxExp || 0} years`,
      location: jobData.locations?.map(loc => loc.label).join(', ') || 'N/A',
      salary: jobData.salary || 'N/A',
      skills: jobData.keySkills?.map(skill => skill.label).join(', ') || 'N/A',
      jobDescription: jobData.jobDescription?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'N/A',
      postedDate: jobData.createdDate || 'N/A',
      url: `https://www.naukri.com/job-listings-${jobData.jobId}`
    };
    
    return jobInfo;
  } catch (error) {
    console.error('Error extracting job data:', error);
    return null;
  }
};

// Main function to crawl Naukri.com using API
const crawlNaukriAPI = async () => {
  console.log('Starting Naukri API crawler...');
  
  try {
    const jobResults = [];
    let currentPage = 1;
    let jobsScraped = 0;
    
    // Update package.json to include axios
    if (!fs.existsSync('./node_modules/axios')) {
      console.log('Installing axios...');
      require('child_process').execSync('npm install axios');
    }
    
    while (jobsScraped < RESULTS_LIMIT) {
      // Search for jobs
      const searchResults = await searchJobs(SEARCH_KEYWORD, EXPERIENCE_MIN, EXPERIENCE_MAX, currentPage);
      
      if (!searchResults || !searchResults.jobDetails || searchResults.jobDetails.length === 0) {
        console.log('No more job results found.');
        break;
      }
      
      // Process each job in the search results
      for (const job of searchResults.jobDetails) {
        if (jobsScraped >= RESULTS_LIMIT) break;
        
        try {
          // Get detailed job information
          const jobDetails = await getJobDetails(job.jobId);
          
          if (jobDetails) {
            const jobData = extractJobData(jobDetails.jobDetails);
            
            if (jobData) {
              jobResults.push(jobData);
              jobsScraped++;
              console.log(`Processed job ${jobsScraped}/${RESULTS_LIMIT}: ${jobData.title}`);
            }
          }
          
          // Add random delay between requests to avoid being blocked
          await randomDelay(2000, 5000);
          
        } catch (error) {
          console.error(`Error processing job ${job.jobId}:`, error);
        }
      }
      
      // Move to the next page
      currentPage++;
      
      // Add a longer delay between pages
      await randomDelay(5000, 10000);
    }
    
    // Write results to CSV
    console.log(`Writing ${jobResults.length} job results to ${OUTPUT_FILE}...`);
    await csvWriter.writeRecords(jobResults);
    
    console.log('Crawling completed successfully!');
  } catch (error) {
    console.error('Error during API crawling:', error);
  }
};

// Start the crawler
crawlNaukriAPI().catch(error => {
  console.error('API Crawler failed:', error);
});
