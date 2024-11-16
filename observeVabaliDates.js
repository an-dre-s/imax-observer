const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

let intervalId;
let browser;
let page;

async function observeVabaliDates() {
    await stopObservation();
    sendMail(process.env.ADMIN_MAIL, 'service started', 'https://dashboard.render.com/web/srv-co8348uv3ddc73b7ahvg/logs');
    console.log('service started');

    browser = await puppeteer.launch({ slowMo: 100 });

    page = await browser.newPage();
    page.setDefaultTimeout(5000);

    const url = 'https://www.vabali.de/berlin/reservierung/';

    const browserEnv = {
        HOUR_START: parseInt(process.env.HOUR_START),
        HOUR_END: parseInt(process.env.HOUR_END),
    }

    try {
        await prepareStuff();
        intervalId = setInterval(observationCycle, 1 * 60 * 1000);
    } catch (error) {
        console.log(error);
        alertAdmin(error);
        await stopObservation();
    }


    async function prepareStuff() {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForSelector('#anwendungsDatumChooser');

        await page.click('#CybotCookiebotDialogBodyButtonDecline'); // Decline cookies

        await page.waitForSelector('#anwendungsDatumChooser');
        await page.evaluate(() => {
            const element = Array.from(document.querySelectorAll('.ui-datepicker-week-end a'))
                .find(el => el.textContent.trim() === '17');
            if (element) {
                element.parentElement.click();
            }
        });

        await page.waitForSelector('.stepContent .anwendung');
        await page.click('.stepContent .anwendung');

        await page.waitForSelector('#personenanzahl select');
        await page.select('#personenanzahl select', process.env.NUMBER_PERSONS);

        await page.waitForSelector('#personenanzahl button');
    }

    async function observationCycle() {
        try {
            console.log('start cycle');

            await page.click('#personenanzahl button');

            await page.waitForSelector('#uhrzeiten');
            const uhrzeiten = await page.evaluate((env) => {
                return Array.from(document.querySelectorAll('#uhrzeiten .stepContent li:not([disabled])'))
                    .filter(element => {
                        const hour = parseInt(element.id.substring(1, 3));
                        return env.HOUR_START <= hour && hour <= env.HOUR_END;
                    })
                    .map(element => element.id.substring(1));
            }, browserEnv);

            if (uhrzeiten.length) {
                console.log(uhrzeiten);
                notifyUsers(uhrzeiten);
            } else {
                console.log('No desired hours found');
            }
        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.error(error);
                return;
            }
            alertAdmin(error);
            await stopObservation();
        }
    }
}

async function stopObservation() {
    console.log('stop observation');

    if (intervalId) {
        clearInterval(intervalId);
    }

    if (browser && browser.isConnected()) {
        console.log('close browser');
        await browser.close();
    }
}

function alertAdmin(error) {
    console.error(error);
    sendMail(process.env.ADMIN_MAIL, 'Error in vabali observer. Observatio aborted.', error.message)
}

function notifyUsers(uhrzeiten) {
    const USER_MAILS = JSON.parse(process.env.USER_MAILS);
    const messageSubject = 'desired vabali hours available'
    const messageText = `Available slots: ${uhrzeiten.join(', ')}.\nCheck https://www.vabali.de/berlin/reservierung/ for further details.`
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

module.exports = { observeVabaliDates, stopObservation };