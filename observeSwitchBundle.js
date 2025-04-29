const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

let intervalId;
let browser;
let pageSearch;
let pageProduct;

async function observeSwitchBundle() {
    stopObservation();
    sendMail(process.env.ADMIN_MAIL, 'service started', 'https://dashboard.render.com/web/srv-co8348uv3ddc73b7ahvg/logs');
    console.log('service started');

    browser = await puppeteer.launch();

    pageSearch = await browser.newPage();
    pageSearch.setDefaultTimeout(15000);

    pageProduct = await browser.newPage();
    pageProduct.setDefaultTimeout(15000);

    const URL_SEARCH = `https://www.otto.de/suche/switch%202/?kategorien~sind=spielekonsolen&preis-in-eur~ab=${process.env.PRICE_START}&preis-in-eur~bis=${process.env.PRICE_END}&verkaeufer=otto`;
    const URL_PRODUCT = 'https://www.otto.de/p/nintendo-switch-switch-2-plus-mario-kart-world-nintendo-switch-2-1970649276/'

    intervalId = setInterval(observationCycle, 1 * 60 * 1000);

    async function observationCycle() {
        try {
            console.log('Starting cycle.');

            let bundleAvailable = await checkSearch();

            if (!bundleAvailable) {
                bundleAvailable = await checkProduct();
            }

            if (bundleAvailable) {
                console.log('Bundle available.');
                stopObservation();
                notifyUsers();
            } else {
                console.log('Bundle not available.')
            }

        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.error('TimeoutError:', error.message);
                return;
            }
            await handleError(error);
        }
    }

    async function checkSearch() {
        console.log('Checking search page.');

        await pageSearch.goto(URL_SEARCH, { waitUntil: 'networkidle2', timeout: 30000 });
        await pageSearch.waitForSelector('#reptile-search-result');
    
        const bundleAvailable = await pageSearch.evaluate(() => {
            return document.getElementsByClassName('reptile_tilelist__itemCount').length;
        });

        if (!bundleAvailable) {
            console.log(`No results found for price between ${process.env.PRICE_START}€ and ${process.env.PRICE_END}€.`);
        }

        return bundleAvailable;
    }

    async function checkProduct() {
        console.log('Checking product page.');

        await pageProduct.goto(URL_PRODUCT, { waitUntil: 'networkidle2', timeout: 30000 });
        await pageProduct.waitForSelector('#pl_logo_otto');
        
        const bundleAvailable = await pageProduct.evaluate(() => {
            const redirectBanner = document.querySelector('.pdp_redirect-message');
            return redirectBanner ? window.getComputedStyle(redirectBanner).display === 'none' : true;
        });

        if(!bundleAvailable) {
            console.log('Product page not available.');
        }

        return bundleAvailable;
    }
}



async function handleError(error) {
    console.error(error);
    alertAdmin(error);
    await stopObservation();
}

async function stopObservation() {
    if (intervalId) {
        console.log('clear interval');
        clearInterval(intervalId);
    }

    if (browser && browser.isConnected()) {
        console.log('close browser');
        await browser.close();
    }
}

function alertAdmin(error) {
    sendMail(process.env.ADMIN_MAIL, 'Error in otto observer. Observatio aborted.', error.message)
}

function notifyUsers() {
    const USER_MAILS = JSON.parse(process.env.USER_MAILS);
    const messageSubject = 'bundle is available'
    const messageText = "https://www.otto.de/p/nintendo-switch-switch-2-plus-mario-kart-world-nintendo-switch-2-1970649276"
    USER_MAILS.forEach((mail) => sendMail(mail, messageSubject, messageText));
}

function sendMail(recipient, subject, text) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.BOT_MAIL,
            pass: process.env.BOT_CREDENTIALS
        }
    });

    let mailOptions = {
        from: process.env.BOT_MAIL,
        to: recipient,
        subject: subject,
        text: text
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

module.exports = { observeSwitchBundle, stopObservation };