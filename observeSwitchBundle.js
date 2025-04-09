const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const player = require('play-sound')();

let intervalId;
let browser;
let page;

async function observeSwitchBundle() {
    stopObservation();
    // sendMail(process.env.ADMIN_MAIL, 'service started', 'https://dashboard.render.com/web/srv-co8348uv3ddc73b7ahvg/logs');
    console.log('service started');

    browser = await puppeteer.launch({ slowMo: 100 });

    page = await browser.newPage();
    page.setDefaultTimeout(5000);

    const url = 'https://www.otto.de/p/nintendo-switch-switch-2-plus-mario-kart-world-nintendo-switch-2-1970649276';

    const browserEnv = {
        HOUR_START: parseInt(process.env.HOUR_START),
        HOUR_END: parseInt(process.env.HOUR_END),
    }

    intervalId = setInterval(observationCycle, 1 * 10 * 1000);

    async function observationCycle() {
        try {
            console.log('start cycle');
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
            await page.waitForSelector('.pdp_delivery--with-article-options');

            const bundleAvailable = await page.evaluate(() => {
                return (document.getElementsByClassName('pdp_delivery__soldout-message').length === 0)
            });

            if (bundleAvailable) {
                // notifyUsers();
                playAlarm();
            } else {
                console.log('bundle not yet available');
            }

        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.error('TimeoutError:', error.message);
                return;
            }
            await handleError(error);
        }
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

function playAlarm() {
    player.play('./data/alarm.wav', function (err) {
        if (err) {
            console.log('Error playing sound: ', err);
        } else {
            console.log('Sound played successfully!');
        }
    });
}

module.exports = { observeSwitchBundle, stopObservation };