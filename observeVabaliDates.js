const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

let intervalId;

async function observeVabaliDates() {
    stopPreviousObservation();
    sendMail(process.env.ADMIN_MAIL, 'service started', 'service has been started');
    console.log('service started');

    const browser = await puppeteer.launch({ slowMo: 100 });

    const page = await browser.newPage();
    page.setDefaultTimeout(5000);

    const url = 'https://www.vabali.de/berlin/reservierung/';

    const browserEnv = {
        HOUR_START: parseInt(process.env.HOUR_START),
        HOUR_END: parseInt(process.env.HOUR_END),
    }

    intervalId = setInterval(observationCycle, 1 * 60 * 1000);

    async function observationCycle() {
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await page.waitForSelector('#anwendungsDatumChooser');

            try {
                await page.click('#CybotCookiebotDialogBodyButtonDecline'); // Decline cookies
            } catch (error) {
            }

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
                notifyUsers(uhrzeiten);
                clearInterval(intervalId);
            } else {
                console.log('No desired hours found');
            }
        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.error('TimeoutError:', error.message);
                return;
            }
            alertAdmin(exception);
            clearInterval(intervalId);
        }
    }
}

function stopPreviousObservation() {
    if (intervalId) {
        clearInterval(intervalId);
    }
}

function alertAdmin(error) {
    console.error(error);
    sendMail(process.env.ADMIN_MAIL, 'error in vabali screening dates observer', error.message)
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

module.exports = observeVabaliDates;