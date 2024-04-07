const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

let hour;
let intervalId;

async function observeImaxScreeningDates() {
    stopPreviousObservation();
    sendMail(process.env.ADMIN_MAIL,'service started', 'service has been started');
    
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const url = 'https://www.uci-kinowelt.de/kinoprogramm/berlin-east-side-gallery/82/poster';

    observationCycle();
    intervalId = setInterval(observationCycle, 1 * 60 * 1000);

    async function observationCycle() {
        try {
            sendHeartbeat();

            await page.goto(url, { waitUntil: 'domcontentloaded' });
            
            console.log(String(new Date()));

            const desiredImaxScreeningDatesWithAvailabilityStatus = await page.evaluate(() => {
                let tile;
                let filmId;
                const desiredImaxScreeningDates = [];
                const desiredImaxScreeningDatesWithAvailabilityStatus = {};
                
                const tileIdentifier = /dune.*two/;
                desiredImaxScreeningDates.push('20240411');
                desiredImaxScreeningDates.push('20240412');
                desiredImaxScreeningDates.push('20240413');
                desiredImaxScreeningDates.push('20240414');
                desiredImaxScreeningDates.push('20240415');
                desiredImaxScreeningDates.push('20240416');
                desiredImaxScreeningDates.push('20240417');

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

function sendHeartbeat() {
    const lastHour = hour;
    hour = new Date().getUTCHours();
    if (lastHour !== hour) {
        sendMail(process.env.ADMIN_MAIL, 'heartbeat', `Service is still running.\n${String(new Date())}`);
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
    process.env.USER_MAILS.forEach((mail) => sendMail(mail, 'new imax screenings available', 'IMAX screenings are now available between 11.04.2024 and 17.04.2024.\nCheck https://www.uci-kinowelt.de/kinoprogramm/berlin-east-side-gallery/82/poster for further details.'));
}

function sendMail(recipient, subject, text) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.BOT_MAIL,
            pass: process.env.BOT_CREDENTIALS;
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