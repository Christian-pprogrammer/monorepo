import dotenv from "dotenv";
import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";

dotenv.config();

type SearchGoogleParams = {
  keyword: string;
  location?: string;
  site?: string;
};

type Result = {
  id: number;
  emails: string[];
  description: string;
};

export class GoogleCrawler {
  apiKey: string;
  searchEngineId: string;
  keyword: string;
  results: Result[] = [];
  emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/g;
  headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  };

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || '';
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || '';
    
    if (!this.apiKey || !this.searchEngineId) {
      throw new Error('Missing GOOGLE_API_KEY or GOOGLE_SEARCH_ENGINE_ID in environment variables');
    }
  }

  async isDone() {
    // For backward compatibility - API approach completes synchronously
    return Promise.resolve(true);
  }

  async close() {
    // No browser to close anymore
    console.log('Cleanup complete');
  }

  async initialize() {
    console.log('Initializing Google Crawler with API...');
    console.log('API Key:', this.apiKey.substring(0, 10) + '...');
    console.log('Search Engine ID:', this.searchEngineId);
  }

  /**
   * Search Google using Custom Search API
   */
  async searchGoogle({ keyword, location, site }: SearchGoogleParams) {
    console.log(`\n🔍 Searching Google for "${keyword}"`);
    
    // Build search query
    let searchQuery = keyword;
    
    // Add email domains to search
    searchQuery += ' (@gmail.com OR @yahoo.com OR @hotmail.com OR @outlook.com)';
    
    if (location) {
      searchQuery += ` in ${location}`;
    }
    
    if (site) {
      searchQuery += ` site:${site}`;
    }
    
    this.keyword = keyword.replace(/\s+/g, "-");
    
    console.log(`📝 Search query: "${searchQuery}"\n`);
    
    try {
      // Get URLs from Google Custom Search API
      const urls = await this._fetchSearchResults(searchQuery);
      
      if (urls.length === 0) {
        console.log('❌ No URLs found from Google Search');
        return;
      }
      
      console.log(`\n✅ Found ${urls.length} URLs from Google\n`);
      
      // Crawl each URL for emails
      await this._crawlResults(urls);
      
    } catch (error) {
      console.error('Error during search:', error.message);
      throw error;
    }
  }

  /**
   * Fetch search results from Google Custom Search API
   */
  async _fetchSearchResults(query: string, maxResults: number = 10): Promise<Array<{url: string, title: string, snippet: string}>> {
    const results: Array<{url: string, title: string, snippet: string}> = [];
    
    try {
      // Google API returns max 10 results per request
      const requestsNeeded = Math.ceil(maxResults / 10);
      
      for (let i = 0; i < requestsNeeded; i++) {
        const startIndex = (i * 10) + 1;
        const apiUrl = `https://www.googleapis.com/customsearch/v1`;
        
        const response = await axios.get(apiUrl, {
          params: {
            key: this.apiKey,
            cx: this.searchEngineId,
            q: query,
            start: startIndex
          }
        });
        
        if (response.data.items) {
          response.data.items.forEach(item => {
            results.push({
              url: item.link,
              title: item.title,
              snippet: item.snippet
            });
          });
        }
        
        // If we got fewer results than requested, no point in asking for more
        if (!response.data.items || response.data.items.length < 10) {
          break;
        }
      }
      
      return results.slice(0, maxResults);
      
    } catch (error) {
      if (error.response) {
        console.error('❌ API Error:', error.response.data.error.message);
        if (error.response.status === 429) {
          console.error('Rate limit exceeded. You have 100 free searches per day.');
        }
      } else {
        console.error('Error fetching search results:', error.message);
      }
      return [];
    }
  }

  /**
   * Extract emails from a webpage
   */
  async _extractEmailsFromUrl(url: string, title: string): Promise<string[]> {
    try {
      console.log(`📄 Scraping: ${url}`);
      
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: 10000,
        maxRedirects: 5
      });
      
      const $ = cheerio.load(response.data);
      
      // Get text from body
      const bodyText = $('body').text();
      let emailsFromText = bodyText.match(this.emailRegex) || [];
      
      // Also check for mailto: links
      const mailtoEmails: string[] = [];
      $('a[href^="mailto:"]').each((i, elem) => {
        const href = $(elem).attr('href');
        if (href) {
          const email = href.replace('mailto:', '').split('?')[0];
          mailtoEmails.push(email);
        }
      });
      
      const allEmails = [...emailsFromText, ...mailtoEmails];
      const uniqueEmails = [...new Set(allEmails)];
      
      // Filter out common false positives
      const filteredEmails = uniqueEmails
        .filter(email => 
          !email.endsWith('.png') && 
          !email.endsWith('.jpg') &&
          !email.endsWith('.gif') &&
          !email.endsWith('.svg') &&
          !email.includes('example.com') &&
          !email.includes('sentry.io') &&
          !email.includes('wixpress.com') &&
          email.length < 100
        )
        .map(email => email.endsWith('.') ? email.slice(0, -1) : email); // Remove trailing dots
      
      if (filteredEmails.length > 0) {
        console.log(`  ✅ Found ${filteredEmails.length} email(s)`);
      } else {
        console.log(`  ℹ️  No emails found`);
      }
      
      return filteredEmails;
      
    } catch (error) {
      console.error(`  ❌ Error scraping ${url}: ${error.message}`);
      return [];
    }
  }

  /**
   * Strip emails from HTML content
   */
  _stripEmails(html: string): string[] {
    const emails = html.match(this.emailRegex) || [];
    return Array.from(new Set(emails)).map(email => 
      email.endsWith('.') ? email.slice(0, -1) : email
    );
  }

  /**
   * Crawl all URLs and extract emails
   */
  async _crawlResults(urls: Array<{url: string, title: string, snippet: string}>) {
    console.log('🔄 Starting to crawl websites...\n');
    
    let counter = 0;
    const timeout = Number(process.env.TIMEOUT) || 2000;
    
    for (const urlData of urls) {
      console.log(`[${counter + 1}/${urls.length}]`);
      
      const emails = await this._extractEmailsFromUrl(urlData.url, urlData.title);
      
      // Also check snippet for emails
      const snippetEmails = this._stripEmails(urlData.snippet);
      const allEmails = [...new Set([...emails, ...snippetEmails])];
      
      if (allEmails.length > 0) {
        this.results.push({
          id: counter + 1,
          emails: allEmails,
          description: urlData.snippet
        });
      }
      
      counter++;
      
      // Add delay between requests to be polite
      await new Promise(resolve => setTimeout(resolve, timeout));
      console.log('');
    }
    
    console.log('\n✅ Crawling complete!\n');
  }

  /**
   * Display results in console
   */
  displayResults() {
    console.log('=' .repeat(80));
    console.log('\n📧 RESULTS\n');
    console.log('=' .repeat(80) + '\n');
    
    if (this.results.length === 0) {
      console.log('❌ No emails found.');
      return;
    }
    
    let totalEmails = 0;
    this.results.forEach((result) => {
      console.log(`\n${result.id}.`);
      console.log(`   📧 Emails found: ${result.emails.length}`);
      result.emails.forEach(email => {
        console.log(`      • ${email}`);
      });
      console.log(`   📝 ${result.description.substring(0, 100)}...`);
      totalEmails += result.emails.length;
    });
    
    console.log('\n' + '=' .repeat(80));
    console.log(`\n✅ Total emails found: ${totalEmails}`);
    console.log(`✅ Websites with emails: ${this.results.length}`);
    console.log('\n' + '=' .repeat(80) + '\n');
  }

  /**
   * Save results to JSON file
   */
  saveResults(filename?: string) {
    const outputFile = filename || `${this.keyword}-emails.json`;
    
    const data = {
      timestamp: new Date().toISOString(),
      keyword: this.keyword,
      totalEmails: this.results.reduce((sum, r) => sum + r.emails.length, 0),
      totalWebsites: this.results.length,
      results: this.results
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    console.log(`💾 Results saved to ${outputFile}\n`);
    
    return outputFile;
  }

  /**
   * Export emails to CSV
   */
  exportToCSV(filename?: string) {
    const outputFile = filename || `${this.keyword}-emails.csv`;
    
    let csv = 'ID,Email,Description\n';
    
    this.results.forEach(result => {
      result.emails.forEach(email => {
        const description = result.description.replace(/"/g, '""').replace(/\n/g, ' ');
        csv += `${result.id},"${email}","${description}"\n`;
      });
    });
    
    fs.writeFileSync(outputFile, csv);
    console.log(`📊 CSV exported to ${outputFile}\n`);
    
    return outputFile;
  }

  /**
   * Get all unique emails
   */
  getAllEmails(): string[] {
    const allEmails = this.results.flatMap(r => r.emails);
    return [...new Set(allEmails)];
  }
}

// Example usage
async function main() {
  const crawler = new GoogleCrawler();
  
  await crawler.initialize();
  
  await crawler.searchGoogle({
    keyword: 'tech startups San Francisco',
    // location: 'San Francisco',
    // site: 'linkedin.com'
  });
  
  crawler.displayResults();
  crawler.saveResults();
  crawler.exportToCSV();
  
  await crawler.close();
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default GoogleCrawler;