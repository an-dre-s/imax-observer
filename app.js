require('dotenv').config();
const express = require('express');
const app = express();
const observeImaxScreeningDates = require('./observeImaxScreeningDates');

app.get("/", (req, res) => res.type('html').send(html));
app.get('/start', () => observeImaxScreeningDates());
app.get('/test', () => {
  console.log(process.env.ADMIN_MAIL);
  console.log(process.env.USER_MAILS);
  console.log(process.env.BOT_MAIL);
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>IMAX observer</title>
  </head>
  <body>
    <section>
      Hello to IMAX observer
    </section>
  </body>
</html>
`