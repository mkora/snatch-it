const fs = require('fs');
const {URL} = require('url');
const path = require('path');
const makeDir = require('make-dir');
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

// put it scraper.js
class Scraper {
  constructor ({
    headlessChrome = false,
    localStoragePath = './data/',
    //startURL = 'http://books.toscrape.com/',
    startURL = 'http://books.toscrape.com/catalogue/page-49.html',
    imageSelector = '.product_pod img',
    defaultImageFolder = 'page-1',
    nextPageSelector = 'ul.pager li.next a',
    pagesLimitNumber = 100,
  } = {}) {

// @TODO change for the object
    this.headlessChrome = headlessChrome;
    this.localStoragePath = localStoragePath;
    this.startURL = startURL;
    this.imageSelector = imageSelector;
    this.defaultImageFolder = defaultImageFolder;
    this.nextPageSelector = nextPageSelector;
    this.pagesLimitNumber = pagesLimitNumber;
  }

  /**
   * 
   * @param {*} fromUrl 
   * @return {string} name of created folder
   */
  async makeDir(fromUrl) {
    const tmp = new URL(fromUrl);
    const parts = tmp.pathname.split('/'); //for retriving last part of an url

    const folder = path.join(
      this.localStoragePath, (
        tmp.pathname === '/'  
          ? this.defaultImageFolder 
          : parts[parts.length - 1].replace(/(.[\w\d]+)$/, '')
      )
    );

    await makeDir(folder);
    return folder;
  }


  /**
   * @param {Page} imgPage pappeteer's current page object
   * @return {array[{url: '..', alt: '..'}]} images' urls
   */
  async getLinks(imgPage) {
    const selector = this.imageSelector;
    return await imgPage.evaluate(async(selector) => {
      const urls = [];

      await document.querySelectorAll(selector).forEach((elem) => {
        urls.push({
          url: elem.getAttribute('src'),
          alt: elem.getAttribute('alt'),
        });
      });

      return urls;
    }, selector);
  }


  /**
   * @param {object} {url, alt} pics attributes
   * @param {string} pageUrl url of the page from which to save
   * @param {string} pathToSave local path where to save pics
   * @return {bool} status
   */ 
  async saveImage ({url, alt}, pageUrl, pathToSave = '') {
  
    const addDomainName = (input, fromUrl) => {
      if (/http/.test(input)) return input;
      const tmp = new URL(fromUrl);   
      tmp.pathname = input;
      return tmp.href;
    }

    const getFileName = ({url, alt}, dir) => {
      // url.pathname is used because img.src may contain 'filename.jpg?45et4578fh...
      const ext = path.extname(new URL(url).pathname); 

      // if alt is empty use the filename
      let name = (!alt) 
        ? path.basename(new URL(url).pathname, ext) 
        : alt;

      // clearify alt from 'illegal' characters 
      name = name.replace(/ /g, '_').replace(/[^\w.\s\-]+/g, '');

      // filename is ./data/ + alt_alt_alt + .ext
      return path.format({dir, name, ext});
    }

    // if the image url is relative, add domain name from page
    url = addDomainName(url, pageUrl);

    try {
      const filename = getFileName({url, alt}, pathToSave);

      const res = await fetch(url);
      const dest = fs.createWriteStream(filename);

      res.body.pipe(dest);
    } catch (err) {
      return Promise.reject(err);
    }

    return true;
  }

  /**
   * 
   */
  async go() {
    const browser = await puppeteer.launch({headless: this.headlessChrome});
    
    // wait for the new page to open
    let page = await browser.newPage();
    // tell the page to navigate to a URL and pause until the page has loaded
    await page.goto(this.startURL); 
    
    let pageUrl = this.startURL;
    let limit = 0; // nobody wants to stuck here forever

    // visit all pages
    while (true || limit < this.pagesLimitNumber) {
      limit += 1;

      await page.waitFor(3000);

      // create a page folder
      const imageFolder = await this.makeDir(pageUrl);

      // find all images and return all theirs URL
      const links = await this.getLinks(page);
      await page.waitFor(600);
      if (!links.length) {
        browser.close();
        return Promise.reject(new Error('No links to save found!'));
      }

      // save images to a local folder
      try {
        const status = await Promise.all(links.map(async({url, alt}) => {
          return await this.saveImage({url, alt}, pageUrl, imageFolder);
        }));
      } catch (err) {
        // catch just the first error
        browser.close();
        return Promise.reject(err);
      }   

      // go to the next page
       try {
        // it will be rejected when  we reach the page after next
        await page.click(this.nextPageSelector);
        pageUrl = await page.url();
      } catch(err) {
        await browser.close();
        if(err.constructor.name == 'AssertionError') {
          return true; // hope, we visited all pages 
        }
        return Promise.reject(err);
      }
    } 

    // after reject we still need to close browser
    await browser.close();

    return true;
  }
};

module.exports = Scraper;
