const fs = require('fs');
const { URL } = require('url');
const path = require('path');
const config = require('config');
const mkDir = require('make-dir');
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');


/**
 * Creates a local directory based on an url
 * (when there is a pagination it's better to
 * store pics in individual folders)
 *
 * @param {string} i
 * @return {string} created folder name
 */
const makeDir = async (i = 0) => {
  const prefix = config.get('paths.prefixChapterFolder');
  const folder = path.join(
    config.get('paths.storage'),
    `${config.get('paths.mainFolder')}${prefix}${i}`
  );

  await mkDir(folder);
  return folder;
};


/**
 * Retrives pic's srcs and alts from the current page
 * by 'congig.selectors.image' selector
 *
 * @param {Page} imgPage pappeteer's current page object
 * @return {array[{url: '..', alt: '..'}]} images' urls
 */
const getLinks = async (imgPage) => {
  // eslint-disable-next-line no-undef
  await imgPage.evaluate(() => Promise.resolve(window.scrollTo(0, document.body.scrollHeight)));

  const imgSelector = config.get('selectors.image');

  const result = await imgPage.evaluate(async (selector) => {
    const urls = [];

    // eslint-disable-next-line no-undef
    await document.querySelectorAll(selector).forEach((elem) => {
      urls.push({
        url: elem.getAttribute('src'),
        alt: elem.getAttribute('alt'),
      });
    });

    return urls;
  }, imgSelector);

  return result;
};


/**
 * Saves a pic from url with clarified alt as the file name
 * (pageUrl needed if a pic uri isn't full, so to add the domain name)
 *
 * @param {object} { url, alt } pics attributes
 * @param {string} pageUrl url of the page from which to save
 * @param {string} pathToSave local path where to save pics
 * @return {bool} status
 */
const saveImage = async ({ url, alt }, pageUrl, pathToSave = '') => {
  /**
   * Adds domain name if needed
   * @param {string} input
   * @param {string} fromUrl
   */
  const addDomainName = (input, fromUrl) => {
    if (/http/.test(input)) return input;
    const tmp = new URL(fromUrl);
    tmp.pathname = input;
    return tmp.href;
  };

  /**
   * Creates a local file name to save
   * @param {object} { url, alt }
   * @param {string} dir
   */
  const getFileName = ({ url, alt }, dir) => { // eslint-disable-line no-shadow
    // url.pathname is used because img.src may contain 'filename.jpg?45et4578fh...
    const ext = path.extname(new URL(url).pathname);

    // if alt is empty use the filename
    let name = (!alt)
      ? path.basename(new URL(url).pathname, ext)
      : alt;

    // clearify alt from 'illegal' characters
    name = name.replace(/ /g, '_').replace(/[^\w.\s-]+/g, '');

    // filename is ./data/ + alt_alt_alt + .ext
    return path.format({ dir, name, ext });
  };

  // if the image url is relative, add domain name from page
  url = addDomainName(url, pageUrl); // eslint-disable-line no-param-reassign

  // fetchs data and saves data
  try {
    const filename = getFileName({ url, alt }, pathToSave);

    const res = await fetch(url);
    const dest = fs.createWriteStream(filename);

    res.body.pipe(dest);
  } catch (err) {
    return Promise.reject(err);
  }

  return true;
};

/**
 * Entry point
 * Initializes puppeteer and snatches pics to local storage
 *
 * @return {bool} status
 */
const grinch = async () => {
  const browser = await puppeteer.launch({
    headless: config.has('browser.headless')
      ? config.get('browser.headless')
      : false
  });

  // wait for the new page to open
  const page = await browser.newPage();
  // tell the page to navigate to a URL and pause until the page has loaded
  let pageUrl = config.get('urls.start');
  await page.goto(pageUrl, {
    timeout: 5000000,
    waitUntil: 'networkidle0',
  });

  let counter = 0; // nobody wants to stuck here forever

  // visit all pages
  /* eslint no-constant-condition: ["error", { "checkLoops": false }] */
  /* eslint-disable no-await-in-loop */
  /* eslint-disable no-loop-func */
  while (true || counter < config.get('extra.pagesLimit')) {
    await page.waitFor(3000);
    counter += 1;

    // create a page folder
    const imageFolder = await makeDir(counter);

    // find all images and return all theirs URL
    const links = await getLinks(page);
    await page.waitFor(600);
    if (!links.length) {
      browser.close();
      return Promise.reject(new Error('No links to save found!'));
    }

    // save images to a local folder
    try {
      await Promise.all(links.map(async ({ url, alt }) => {
        const res = await saveImage({ url, alt }, pageUrl, imageFolder);
        return res;
      }));
    } catch (err) {
      // catch just one error
      browser.close();
      return Promise.reject(err);
    }

    // go to the next page
    try {
      // it will be rejected when  we reach the page after last
      await page.click(config.get('selectors.nextPage'), {
        timeout: 5000000,
        waitUntil: 'networkidle0',
      });
      pageUrl = await page.url();
      await page.waitFor(3000);
    } catch (err) {
      await browser.close();
      if (err.constructor.name === 'AssertionError') {
        return true; // hope, we visited all pages
      }
      return Promise.reject(err);
    }
  }

  // after reject we still need to close browser
  await browser.close();

  return true;
};


module.exports = { grinch };
