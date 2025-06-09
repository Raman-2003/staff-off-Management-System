/**
 * Proxy Manager for Web Crawling
 * 
 * This module helps manage and rotate proxies to avoid IP blocking
 * when crawling websites with anti-scraping measures.
 */

class ProxyManager {
  constructor(proxyList = []) {
    this.proxyList = proxyList;
    this.currentIndex = 0;
    this.failedProxies = new Set();
  }

  /**
   * Add a proxy to the list
   * @param {string} proxy - Proxy in format 'ip:port' or 'protocol://ip:port'
   */
  addProxy(proxy) {
    if (!this.proxyList.includes(proxy)) {
      this.proxyList.push(proxy);
    }
  }

  /**
   * Add multiple proxies to the list
   * @param {Array<string>} proxies - List of proxies
   */
  addProxies(proxies) {
    proxies.forEach(proxy => this.addProxy(proxy));
  }

  /**
   * Get the next available proxy
   * @returns {string|null} Next proxy or null if none available
   */
  getNextProxy() {
    if (this.proxyList.length === 0) {
      return null;
    }

    // Skip failed proxies
    let attempts = 0;
    while (attempts < this.proxyList.length) {
      const proxy = this.proxyList[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.proxyList.length;
      
      if (!this.failedProxies.has(proxy)) {
        return proxy;
      }
      
      attempts++;
    }

    // If all proxies have failed, reset and try again
    if (this.failedProxies.size === this.proxyList.length) {
      console.log('All proxies have failed. Resetting failed proxies list.');
      this.failedProxies.clear();
      return this.proxyList[this.currentIndex];
    }

    return null;
  }

  /**
   * Mark a proxy as failed
   * @param {string} proxy - The proxy that failed
   */
  markProxyAsFailed(proxy) {
    this.failedProxies.add(proxy);
    console.log(`Marked proxy as failed: ${proxy}`);
  }

  /**
   * Load proxies from a file
   * @param {string} filePath - Path to file containing proxies (one per line)
   */
  loadProxiesFromFile(filePath) {
    const fs = require('fs');
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const proxies = data.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      
      this.addProxies(proxies);
      console.log(`Loaded ${proxies.length} proxies from ${filePath}`);
    } catch (error) {
      console.error(`Error loading proxies from file: ${error.message}`);
    }
  }

  /**
   * Get proxy in Puppeteer format
   * @param {string} proxy - Proxy string
   * @param {string} username - Optional username for authentication
   * @param {string} password - Optional password for authentication
   * @returns {Object} Proxy configuration for Puppeteer
   */
  getPuppeteerProxyConfig(proxy, username = null, password = null) {
    // Parse the proxy string
    let protocol = 'http';
    let host = proxy;
    let port = '80';

    if (proxy.includes('://')) {
      const parts = proxy.split('://');
      protocol = parts[0];
      host = parts[1];
    }

    if (host.includes(':')) {
      const parts = host.split(':');
      host = parts[0];
      port = parts[1];
    }

    // Create the proxy arg
    const proxyArg = `--proxy-server=${protocol}://${host}:${port}`;
    
    // Return the configuration
    const config = {
      args: [proxyArg]
    };

    // Add authentication if provided
    if (username && password) {
      config.authentication = {
        username,
        password
      };
    }

    return config;
  }

  /**
   * Get the count of available proxies
   * @returns {number} Count of available proxies
   */
  getAvailableProxyCount() {
    return this.proxyList.length - this.failedProxies.size;
  }

  /**
   * Get the total count of proxies
   * @returns {number} Total count of proxies
   */
  getTotalProxyCount() {
    return this.proxyList.length;
  }
}

module.exports = ProxyManager;
