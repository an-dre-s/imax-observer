const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

let intervalId;

async function observeImaxScreeningDates() {
    stopPreviousObservation();
    sendMail(process.env.ADMIN_MAIL,'service started', 'service has been started');
    
    const browser = await puppeteer.launch({timeout: 60000});
    const page = await browser.newPage();
    const url = 'https://www.uci-kinowelt.de/kinoprogramm/berlin-east-side-gallery/82/poster';

    intervalId = setInterval(observationCycle, 2 * 60 * 1000);

    async function observationCycle() {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            
            console.log(String(new Date()));

            const desiredImaxScreeningDatesWithAvailabilityStatus = await page.evaluate(() => {
                let tile;
                let filmId;
                const desiredImaxScreeningDates = [];
                const desiredImaxScreeningDatesWithAvailabilityStatus = {};
                
                const tileIdentifier = /dune.*two/;

                prepareLookup();
                lookupAvailabilityStatusOfDesiredImaxScreeningDates();

                return desiredImaxScreeningDatesWithAvailabilityStatus;


                function prepareLookup() {
                    retrieveTile();
                    retrieveFilmId();
                    openModalForScreeningDates();
                }
                
                function retrieveTile() {
                    $('.posterline--box').each(function () {
                        if($(this).find('h3').text().toLowerCase().match(tileIdentifier)) {
                            tile = $(this);
                            return false;
                        }
                    });

                    if(!tile) {
                        throw new Error('could not find tile');
                    }
                }

                function retrieveFilmId() {
                    filmId = $(tile).attr('data-film-id');

                    if(!filmId) {
                        throw new Error('could not find film id');
                    }
                }

                function openModalForScreeningDates() {
                    $(tile).trigger('click');

                    const isModalOpen = !($('#poster-performance-container').css('display') === 'none');
                    if(!isModalOpen) {
                        throw new Error('could not open modal for screening dates');
                    } 
                }

                function lookupAvailabilityStatusOfDesiredImaxScreeningDates() {
                    desiredImaxScreeningDates.forEach((desiredImaxScreeningDate) => desiredImaxScreeningDatesWithAvailabilityStatus[desiredImaxScreeningDate] = isDesiredImaxScreeningDateAvailable(desiredImaxScreeningDate));
                }

                function isDesiredImaxScreeningDateAvailable(desiredImaxScreeningDate) {
                    const imaxScreeningsOnDesiredDate = $(`#poster-performance-container .eventkalender--item[film-id="${filmId}"] tr.schedule-container-date[data-date="${desiredImaxScreeningDate}"] .imax`)
                    return imaxScreeningsOnDesiredDate.length > 0;
                }
            });
            
            const availabilityStatusOfDesiredImaxScreeningDates = buildStringFromDesiredImaxScreeningDatesWithAvailabilityStatus(desiredImaxScreeningDatesWithAvailabilityStatus);
            console.log(availabilityStatusOfDesiredImaxScreeningDates);
            notifyUsersAndExitIfDesiredImaxScreeningDatesAreAvailable();


            function notifyUsersAndExitIfDesiredImaxScreeningDatesAreAvailable() {
                if (Object.values(desiredImaxScreeningDatesWithAvailabilityStatus).includes(true)) {
                    notifyUsers(availabilityStatusOfDesiredImaxScreeningDates);
                    clearInterval(intervalId);
                }
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

function buildStringFromDesiredImaxScreeningDatesWithAvailabilityStatus(desiredImaxScreeningDatesWithAvailabilityStatus) {
    const results = [];
    for (const desiredImaxScreeningDate in desiredImaxScreeningDatesWithAvailabilityStatus) {
        if (desiredImaxScreeningDatesWithAvailabilityStatus[desiredImaxScreeningDate]) {
            results.push(`date ${desiredImaxScreeningDate} is available`);
        } else {
            results.push(`date ${desiredImaxScreeningDate} is not available`);
        }
    }
    return results.join('\n');
}

function alertAdmin(error) {
    console.error(error);
    sendMail(process.env.ADMIN_MAIL, 'error in IMAX screening dates observer', error.message)
}

function notifyUsers(message) {
    const USER_MAILS = JSON.parse(process.env.USER_MAILS);
    USER_MAILS.forEach((mail) => sendMail(mail,'new imax screenings available', message));
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