const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

let intervalId;

async function observeImaxScreeningDates() {
    stopPreviousObservation();
    sendMail(process.env.ADMIN_MAIL,'service started', 'service has been started');
    
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const url = 'https://www.uci-kinowelt.de/kinoprogramm/berlin-east-side-gallery/82/poster';

    intervalId = setInterval(observationCycle, 1 * 60 * 1000);

    async function observationCycle() {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            
            console.log(String(new Date()));

            const tile = await page.evaluate(() => {
                let tile;

                const tileIdentifier = /fury.*road/;

                retrieveTile();
                return tile;

                function retrieveTile() {
                    $('.posterline--box').each(function () {
                        if($(this).find('h3').text().toLowerCase().match(tileIdentifier)) {
                            tile = $(this);
                            return false;
                        }
                    });
                }
            });

            if(tile) {
                notifyUsers();
                console.log('fury road tile has been found')
                clearInterval(intervalId);
            } else {
                console.log('could not find fury road tile')

            }
        } catch(exception) {
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
    sendMail(process.env.ADMIN_MAIL, 'error in IMAX screening dates observer', error.message)
}

function notifyUsers() {
    const USER_MAILS = JSON.parse(process.env.USER_MAILS);
    USER_MAILS.forEach((mail) => sendMail(mail, 'fury road screenings available', 'Check https://www.uci-kinowelt.de/kinoprogramm/berlin-east-side-gallery/82/poster for further details.'));
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

    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

module.exports = observeImaxScreeningDates;