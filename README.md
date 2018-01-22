# Snatch It

## Overview

Snatch-It grabs images from the Internet and saves them on a local drive 

## Notes

- Used Puppeteer ([Google Headless Crome Node API](https://github.com/GoogleChrome/puppeteer)) to scrape a site

- Used `config` module to define snatch-it settings (from 'where to save images' to 'get image from this selector' settings)

- Goes through all pages till the 'next-page-selector' can be found on a page

- Creates folders for a site and for each visited page to keep it easy to navigate

- Used [Books to Scrape. We love being scraped!](http://books.toscrape.com/) as a default config (see it below)

## Quick Start

1. Install dependencies
```
npm install
```

2. Run the app (with default settings)
```
npm start
```

3. Create a custom config on `config` folder (given an default.json)
```
{
  "browser": { 
    "headless": false
  },
  "paths": {
    "storage": "./data/",
    "mainFolder": "books/",
    "defaultFolder": "page-1"
  },
  "urls": {
    "start": "http://books.toscrape.com/"
  },
  "selectors": {
    "image": ".product_pod img",
    "nextPage": "ul.pager li.next a"
  },
  "extra": {
    "pagesLimit": 100
  }
}
```

then run the app 
```
NODE_ENV=<your-config-name> npm start
```
