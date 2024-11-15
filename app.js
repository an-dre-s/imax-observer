require('dotenv').config();
const express = require('express');
const app = express();
const observeVabaliDates = require('./observeVabaliDates');

app.get("/", (req, res) => res.type('html').send(html));
app.get('/start', () => observeVabaliDates());

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>vabali observer</title>
  </head>
  <body>
    <section>
      Hello to vabali observer
    </section>
  </body>
</html>
`