const puppeteer = require('puppeteer');
const Scraper = require('./src/Scraper');

const scraper = new Scraper({
  headlessChrome: false,
});

scraper.go().then(res => {
  if (res === true) {
    console.log('** Let\'s dance! **');
  }
}).catch(error => {
  console.log('** Have you seen this? Something went wrong! **');
  console.error(error);
  
});

