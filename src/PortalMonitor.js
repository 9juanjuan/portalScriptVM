const { chromium } = require('playwright');
const logger = require('./logger');
require('dotenv').config();

class PortalMonitor {
  constructor() {
    this.loginUrl = 'https://pasadenaisd.erp.frontlineeducation.com/employee/substitute/selfserve.do';
    this.jobSearchUrl = 'https://pasadenaisd.erp.frontlineeducation.com/employee/EmployeeSubstituteSelfservePreArrangedJobsStartAction.do';
    this.last4SSN = process.env.LAST4_SSN || '5947';
    this.pin = process.env.PIN || '316231';
    this.pageLoadTimeout = parseInt(process.env.PAGE_LOAD_TIMEOUT_MS || '45000');
    this.screenshotOnFailure = process.env.SCREENSHOT_ON_FAILURE === 'true';
    this.isRunning = false;
    this.browser = null;
    this.page = null;
    this.refreshIntervalId = null;
    this.jobsAccepted = 0;
    
    // Priority schools in order
    this.prioritySchools = [
      'Pasadena Memorial High School',
      'Dolby High School',
      'South Houston High School',
      'Pasadena High School'
    ];
  }

  async initialize() {
    try {
      logger.info('Initializing portal monitor...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection'
        ]
      });
      
      const context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
      });
      
      this.page = await context.newPage();
      this.page.setDefaultTimeout(this.pageLoadTimeout);
      
      logger.info('Portal monitor initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize portal monitor', { error: error.message });
      await this.cleanup();
      return false;
    }
  }

  async login() {
    logger.info('Attempting to log in to Frontline Education portal...');
    try {
      await this.page.goto(this.loginUrl, { waitUntil: 'networkidle', timeout: this.pageLoadTimeout });
      
      // Fill in login form with SSN and PIN
      await this.page.fill('#last4ofSSN', this.last4SSN);
      logger.info('Entered last 4 of SSN');
      
      await this.page.fill('#pin', this.pin);
      logger.info('Entered PIN');
      
      // Submit the form
      await this.page.click('button[type="submit"], input[type="submit"]');
      
      // Wait for navigation after login
      await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: this.pageLoadTimeout });
      
      // Verify we're on the expected page
      const currentUrl = this.page.url();
      logger.info(`Successfully logged in. Current URL: ${currentUrl}`);
      return true;
    } catch (error) {
      logger.error('Login failed', { error: error.message, stack: error.stack });
      await this.captureScreenshot('login-failure');
      return false;
    }
  }

  async navigateToJobSearch() {
    logger.info('Navigating to job search page...');
    try {
      await this.page.goto(this.jobSearchUrl, { waitUntil: 'networkidle', timeout: this.pageLoadTimeout });
      
      // Click on the job search tab in the sub-navigation
      await this.page.waitForSelector('#subNavigation', { timeout: 10000 });
      await this.page.click('#subNav-jobSearch');
      logger.info('Clicked on job search tab');
      
      // Wait for the table to load
      await this.page.waitForSelector('#tableTable', { timeout: 10000 });
      logger.info('Job search page loaded successfully');
      
      return true;
    } catch (error) {
      logger.error('Failed to navigate to job search', { error: error.message });
      await this.captureScreenshot('navigation-failure');
      return false;
    }
  }

  parseTimeRange(timeString) {
    // Parse time string like "8:00 AM - 2:00 PM"
    const match = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;
    
    const [_, startHour, startMin, startPeriod, endHour, endMin, endPeriod] = match;
    
    // Convert to 24-hour format
    let start = parseInt(startHour);
    if (startPeriod.toUpperCase() === 'PM' && start !== 12) start += 12;
    if (startPeriod.toUpperCase() === 'AM' && start === 12) start = 0;
    
    let end = parseInt(endHour);
    if (endPeriod.toUpperCase() === 'PM' && end !== 12) end += 12;
    if (endPeriod.toUpperCase() === 'AM' && end === 12) end = 0;
    
    return { startHour: start, endHour: end };
  }

  isFullDayAssignment(timeString) {
    const times = this.parseTimeRange(timeString);
    if (!times) return false;
    
    // Full day: starts before 8 AM and ends after 2 PM (14:00)
    return times.startHour < 8 && times.endHour >= 14;
  }

  async checkForJobs() {
    try {
      logger.info('Checking for available jobs...');
      
      // Get all rows from the table
      const rows = await this.page.$$('#tableTable tbody tr');
      
      if (rows.length === 0) {
        logger.info('No jobs available in table');
        return null;
      }
      
      logger.info(`Found ${rows.length} job(s) in table`);
      
      // Parse all jobs
      const jobs = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = await row.$$('td');
        
        if (cells.length === 0) continue;
        
        // Extract job details (adjust indices based on actual table structure)
        const location = await cells[0]?.textContent() || '';
        const timeRange = await cells[2]?.textContent() || '';
        
        jobs.push({
          row,
          index: i,
          location: location.trim(),
          timeRange: timeRange.trim()
        });
        
        logger.info(`Job ${i + 1}: ${location.trim()} - ${timeRange.trim()}`);
      }
      
      // Filter and prioritize jobs
      for (const school of this.prioritySchools) {
        for (const job of jobs) {
          if (job.location.includes(school) && this.isFullDayAssignment(job.timeRange)) {
            logger.info(`✓ MATCH FOUND: ${job.location} - ${job.timeRange}`);
            return job;
          }
        }
      }
      
      logger.info('No matching jobs found (priority schools + full day)');
      return null;
      
    } catch (error) {
      logger.error('Error checking for jobs', { error: error.message });
      await this.captureScreenshot('job-check-error');
      return null;
    }
  }

  async acceptJob(job) {
    try {
      logger.info(`Attempting to accept job: ${job.location} - ${job.timeRange}`);
      
      // Click on the row to select it
      await job.row.click();
      logger.info('Clicked on job row');
      
      // Wait a moment for the row to be selected
      await this.page.waitForTimeout(500);
      
      // Verify the row is selected
      const isSelected = await job.row.evaluate(el => el.classList.contains('tableSelected'));
      if (!isSelected) {
        logger.warn('Row may not be properly selected');
      }
      
      // Click the accept button
      await this.page.click('#accept');
      logger.info('Clicked accept button');
      
      // Wait for confirmation or page change
      await this.page.waitForTimeout(2000);
      
      this.jobsAccepted++;
      logger.info(`✓ JOB ACCEPTED! Total jobs accepted: ${this.jobsAccepted}`);
      await this.captureScreenshot('job-accepted');
      
      return true;
    } catch (error) {
      logger.error('Failed to accept job', { error: error.message });
      await this.captureScreenshot('job-accept-failure');
      return false;
    }
  }

  getRandomRefreshInterval() {
    // Random interval between 7-11 seconds (7000-11000 ms)
    return Math.floor(Math.random() * 4000) + 7000;
  }

  async refreshJobTable() {
    try {
      logger.info('Refreshing job table...');
      await this.page.click('#refresh');
      
      // Wait for table to reload
      await this.page.waitForTimeout(1000);
      
      logger.info('Job table refreshed');
      return true;
    } catch (error) {
      logger.error('Failed to refresh job table', { error: error.message });
      return false;
    }
  }

  async verifyLogin() {
    try {
      // Check if we're on the login page or logged in
      const currentUrl = this.page.url();
      
      // If we're on the login page, we're not logged in
      if (currentUrl.includes('selfserve.do') && !currentUrl.includes('EmployeeSubstitute')) {
        return false;
      }
      
      // Check for navigation elements that only appear when logged in
      const subNav = await this.page.$('#subNavigation');
      return subNav !== null;
    } catch (error) {
      logger.error('Error verifying login status', { error: error.message });
      return false;
    }
  }

  async handleNetworkError() {
    logger.warn('Network error detected. Attempting to restart in 30 seconds...');
    await this.cleanup();
    
    // Wait 30 seconds before restarting
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    logger.info('Restarting monitoring after network error...');
    await this.startMonitoring();
  }

  async captureScreenshot(prefix = 'screenshot') {
    if (!this.screenshotOnFailure || !this.page) return;
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = `./logs/${prefix}-${timestamp}.png`;
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      logger.info(`Screenshot saved to ${screenshotPath}`);
    } catch (error) {
      logger.error('Failed to capture screenshot', { error: error.message });
    }
  }

  async startMonitoring() {
    if (this.isRunning) {
      logger.warn('Monitor is already running');
      return;
    }

    try {
      const initialized = await this.initialize();
      if (!initialized) {
        logger.error('Failed to initialize monitor');
        return;
      }

      const loggedIn = await this.login();
      if (!loggedIn) {
        logger.error('Failed to log in, cannot start monitoring');
        await this.cleanup();
        return;
      }

      // Navigate to job search page
      const navigated = await this.navigateToJobSearch();
      if (!navigated) {
        logger.error('Failed to navigate to job search page');
        await this.cleanup();
        return;
      }

      this.isRunning = true;
      logger.info('✓ Portal monitoring started successfully');
      logger.info(`Priority schools: ${this.prioritySchools.join(', ')}`);
      logger.info('Looking for full-day assignments (before 8 AM - after 2 PM)');
      
      // Start the continuous monitoring loop
      await this.monitoringLoop();
      
    } catch (error) {
      logger.error('Error starting monitoring', { error: error.message, stack: error.stack });
      
      // Check if it's a network error
      if (error.message.includes('net::') || error.message.includes('timeout') || error.message.includes('Navigation')) {
        await this.handleNetworkError();
      } else {
        await this.cleanup();
      }
    }
  }

  async monitoringLoop() {
    while (this.isRunning) {
      try {
        // Verify we're still logged in
        const isLoggedIn = await this.verifyLogin();
        if (!isLoggedIn) {
          logger.warn('Session expired, re-authenticating...');
          const loginSuccess = await this.login();
          if (!loginSuccess) {
            throw new Error('Failed to re-authenticate');
          }
          await this.navigateToJobSearch();
        }

        // Check for matching jobs
        const matchingJob = await this.checkForJobs();
        
        if (matchingJob) {
          // Found a matching job, try to accept it
          const accepted = await this.acceptJob(matchingJob);
          
          if (accepted) {
            logger.info('Job accepted successfully. Continuing to monitor for more jobs...');
            // Navigate back to job search after accepting
            await this.navigateToJobSearch();
          }
        }
        
        // Refresh the table with random interval (7-11 seconds)
        const refreshInterval = this.getRandomRefreshInterval();
        logger.info(`Waiting ${(refreshInterval / 1000).toFixed(1)}s before next refresh...`);
        
        await new Promise(resolve => setTimeout(resolve, refreshInterval));
        
        // Refresh the job table
        await this.refreshJobTable();
        
      } catch (error) {
        logger.error('Error in monitoring loop', { error: error.message, stack: error.stack });
        
        // Check if it's a network/timeout error
        if (error.message.includes('net::') || 
            error.message.includes('timeout') || 
            error.message.includes('Navigation') ||
            error.message.includes('Target closed')) {
          logger.error('Network/timeout error detected');
          await this.handleNetworkError();
          break;
        }
        
        // For other errors, wait a bit and continue
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async stopMonitoring() {
    if (!this.isRunning) return;
    
    logger.info('Stopping portal monitoring...');
    this.isRunning = false;
    
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    
    await this.cleanup();
    logger.info('Portal monitoring stopped');
  }

  async cleanup() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }
    } catch (error) {
      logger.error('Error during cleanup', { error: error.message });
    }
  }
}

module.exports = PortalMonitor;
