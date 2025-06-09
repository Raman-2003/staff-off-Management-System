# Naukri.com Web Crawler

This is a web crawler designed to extract job listings from Naukri.com based on tech stack (Node.js) and experience level.

## Features

- Searches for Node.js jobs on Naukri.com
- Filters by experience level
- Extracts detailed job information including:
  - Job title
  - Company name
  - Experience requirements
  - Location
  - Salary (if available)
  - Required skills
  - Job description
  - Posted date
  - Job URL
- Exports results to CSV
- Implements anti-detection measures to bypass scraping blockers

## Requirements

- Node.js (v14 or higher)
- npm

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

## Configuration

You can modify the following variables in `index.js` to customize your search:

- `SEARCH_KEYWORD`: The technology to search for (default: 'Node.js')
- `EXPERIENCE_RANGE`: Experience level to filter by (options: '0-1', '1-2', '2-5', '5-7', '7-10', '10-15')
- `RESULTS_LIMIT`: Maximum number of results to scrape
- `OUTPUT_FILE`: Name of the CSV file to save results

## Usage

Run the crawler with:

```bash
npm start
```

The crawler will:
1. Open a browser window
2. Navigate to Naukri.com
3. Search for Node.js jobs
4. Apply the specified experience filter
5. Extract job details
6. Save the results to a CSV file

## Anti-Detection Measures

This crawler implements several techniques to avoid detection:
- Uses Puppeteer Stealth plugin
- Randomized delays between actions
- Mimics human-like browsing behavior
- Sets realistic user agent and HTTP headers
- Varies timing between requests

## Legal Disclaimer

Web scraping may be against the terms of service of some websites. This tool is provided for educational purposes only. Use responsibly and at your own risk.
