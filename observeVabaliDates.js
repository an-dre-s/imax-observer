const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

let intervalId;

async function observeVabaliDates() {
    stopPreviousObservation();
    sendMail(process.env.ADMIN_MAIL,'service started', 'service has been started');
    
    const browser = await puppeteer.launch({timeout: 60000});
    const page = await browser.newPage();
    const url = 'https://www.vabali.de/berlin/reservierung/';

    intervalId = setInterval(observationCycle, 2 * 60 * 1000);

    async function observationCycle() {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            
            console.log(String(new Date()));

            const uhrzeiten = await page.evaluate(async () => {
                initJquery();
                await delay(1000);
                
                declineCookies();
                await delay(500);
                
                clickDay();
                await delay(500);
                
                clickReservierung();
                await delay(500);
                
                setPersonenzahl();
                await delay(500);
                
                sendPersonenzahl();
                await delay(500);
                
                return filterUhrzeiten();
                
                function initJquery() {
                    var script = document.createElement('script');
                    script.src = 'https://code.jquery.com/jquery-3.6.0.min.js'; // Specify the version you need
                    script.type = 'text/javascript';
                    script.onload = function() {
                        console.log('jQuery loaded:', $.fn.jquery);
                    };
                    document.getElementsByTagName('head')[0].appendChild(script);
                }
                
                function declineCookies() {
                    $('#CybotCookiebotDialogBodyButtonDecline').trigger('click');
                }
                
                function clickDay() {
                    $('.ui-datepicker-week-end a').filter(function() {return $(this).text() === '17';}).closest('.ui-datepicker-week-end').trigger('click');
                }
                
                function clickReservierung() {
                    $('.stepContent .anwendung').trigger('click')
                }
                
                function setPersonenzahl() {
                    $('#personenanzahl select').val(2);
                }
                
                function sendPersonenzahl() {
                    $('#personenanzahl button').trigger('click');
                }
                
                function filterUhrzeiten() {
                    return $('#uhrzeiten .stepContent li:not([disabled])')
                    .filter(function() {
                        const hour = parseInt($(this).attr('id').substring(1,3));
                        return 19 <= hour && hour <= 21;
                    })
                    .map(function() {
                        return $(this).attr('id').substring(1);
                    })
                    .toArray();
                }
                
                function delay(ms) {
                    return new Promise(resolve => setTimeout(resolve, ms));
                }
            });

            if(uhrzeiten.length) {
                notifyUsers(uhrzeiten);
                console.log('desired hours available')
                clearInterval(intervalId);
            } else {
                console.log('could not find desired hours')

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

    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

module.exports = observeVabaliDates;