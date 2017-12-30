const { grinch } = require('./scraper');

grinch().then(() => {
  console.log('** Let\'s dance! **');
}).catch((error) => {
  console.log('** Have you seen this? Something went wrong! **');
  console.error(error);
});
