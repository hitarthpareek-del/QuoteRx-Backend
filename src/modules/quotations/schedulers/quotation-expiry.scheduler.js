const quotationService =
    require("../services/quotation.service");

let expiryInterval = null;

async function runQuotationExpiry() {
    try {
        const result =
            await quotationService.expireDueQuotations();

        if (
            result.expiredCount > 0
        ) {
            console.log(
                `[Quotation Expiry] Expired ${result.expiredCount} quotation(s)`
            );
        }
    } catch (error) {
        console.error(
            "[Quotation Expiry] Scheduler error:",
            error
        );
    }
}

function startQuotationExpiryScheduler() {
    if (expiryInterval) {
        return;
    }

    /*
      Run once when the server starts.
    */
    runQuotationExpiry();

    /*
      Then check every minute.
    */
    expiryInterval =
        setInterval(
            runQuotationExpiry,
            60 * 1000
        );

    console.log(
        "[Quotation Expiry] Scheduler started"
    );
}

function stopQuotationExpiryScheduler() {
    if (!expiryInterval) {
        return;
    }

    clearInterval(
        expiryInterval
    );

    expiryInterval = null;

    console.log(
        "[Quotation Expiry] Scheduler stopped"
    );
}

module.exports = {
    startQuotationExpiryScheduler,
    stopQuotationExpiryScheduler
};