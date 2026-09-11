const prisma =
    require("../../../lib/prisma");

const {
    sendQuotationEmail
} = require("../services/quotation.email.service");

const {
    downloadDocumentByUrl
} = require("../../../services/document-storage.service");


let followUpInterval = null;

let followUpJobRunning =
    false;


/* ============================================================
   RUN FOLLOW-UP JOB
============================================================ */

async function runQuotationFollowUps() {
    /*
      Prevent overlapping executions.
    */
    if (followUpJobRunning) {
        console.log(
            "[Quotation Follow-up] Previous job still running, skipping this cycle"
        );

        return;
    }

    followUpJobRunning =
        true;

    const now =
        new Date();

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
        const dueFollowUps =
            await prisma.quotationFollowUp.findMany({
                where: {
                    status:
                        "PENDING",

                    scheduledAt: {
                        lte:
                            now
                    },

                    quotation: {
                        status: {
                            in: [
                                "SENT",
                                "NEGOTIATION"
                            ]
                        }
                    }
                },

                include: {
                    quotation: {
                        select: {
                            id: true,

                            quotationNumber:
                                true,

                            status:
                                true,

                            expiryDate:
                                true,

                            latestVersionNumber:
                                true,

                            createdByUserId:
                                true,

                            company: {
                                select: {
                                    id: true,
                                    name: true,
                                    emailFromName: true,
                                    emailFromAddress: true,
                                    status: true
                                }
                            }
                        }
                    }
                },

                orderBy: {
                    scheduledAt:
                        "asc"
                },

                take:
                    50
            });

        for (
            const followUp of dueFollowUps
        ) {
            const quotation =
                followUp.quotation;

            /*
              Basic validation.
            */
            if (!quotation) {
                skippedCount++;

                console.log(
                    `[Quotation Follow-up] Skipped ${followUp.id}: quotation not found`
                );

                continue;
            }

            /*
              The quotation may have changed status
              after the initial query.
            */
            if (
                quotation.status !==
                "SENT" &&
                quotation.status !==
                "NEGOTIATION"
            ) {
                skippedCount++;

                console.log(
                    `[Quotation Follow-up] Skipped ${quotation.quotationNumber}: current status is ${quotation.status}`
                );

                continue;
            }

            /*
              Never send after expiry.
            */
            if (
                quotation.expiryDate &&
                quotation.expiryDate <=
                now
            ) {
                try {
                    await prisma.quotationFollowUp.update({
                        where: {
                            id:
                                followUp.id
                        },

                        data: {
                            status:
                                "CANCELLED"
                        }
                    });

                    skippedCount++;

                    console.log(
                        `[Quotation Follow-up] Cancelled ${followUp.id}: quotation has reached expiry`
                    );
                } catch (error) {
                    failedCount++;

                    console.error(
                        `[Quotation Follow-up] Failed to cancel ${followUp.id}:`,
                        error
                    );
                }

                continue;
            }

            /*
              Company validation.
            */
            if (
                !quotation.company
            ) {
                failedCount++;

                console.error(
                    `[Quotation Follow-up] Failed ${followUp.id}: company not found`
                );

                continue;
            }

            if (
                quotation.company.status !==
                "ACTIVE"
            ) {
                skippedCount++;

                console.log(
                    `[Quotation Follow-up] Skipped ${followUp.id}: company is inactive`
                );

                continue;
            }

            if (
                !quotation.company
                    .emailFromAddress
            ) {
                failedCount++;

                console.error(
                    `[Quotation Follow-up] Failed ${followUp.id}: company quotation email is not configured`
                );

                continue;
            }

            if (
                !followUp.recipientEmail
            ) {
                failedCount++;

                console.error(
                    `[Quotation Follow-up] Failed ${followUp.id}: recipient email is missing`
                );

                continue;
            }

            if (
                !followUp.subject
            ) {
                failedCount++;

                console.error(
                    `[Quotation Follow-up] Failed ${followUp.id}: email subject is missing`
                );

                continue;
            }

            if (
                !followUp.body
            ) {
                failedCount++;

                console.error(
                    `[Quotation Follow-up] Failed ${followUp.id}: email body is missing`
                );

                continue;
            }

            try {
                /*
                  Get the latest quotation version.
                */
                const latestVersion =
                    await prisma.quotationVersion.findFirst({
                        where: {
                            quotationId:
                                quotation.id
                        },

                        orderBy: {
                            versionNumber:
                                "desc"
                        },

                        select: {
                            versionNumber:
                                true,

                            documentUrl:
                                true
                        }
                    });

                if (
                    !latestVersion
                ) {
                    failedCount++;

                    console.error(
                        `[Quotation Follow-up] Failed ${followUp.id}: latest quotation version not found`
                    );

                    continue;
                }

                if (
                    !latestVersion.documentUrl
                ) {
                    failedCount++;

                    console.error(
                        `[Quotation Follow-up] Failed ${followUp.id}: latest version has no document URL`
                    );

                    continue;
                }

                /*
                  Download the latest PDF from Supabase.
                */
                const pdfBase64 =
                    await downloadDocumentByUrl(
                        latestVersion.documentUrl
                    );

                if (
                    !pdfBase64
                ) {
                    throw new Error(
                        "DOCUMENT_DOWNLOAD_FAILED"
                    );
                }

                /*
                  Send follow-up through the
                  existing Resend quotation service.
                */
                const emailResult =
                    await sendQuotationEmail({
                        company:
                            quotation.company,

                        to:
                            followUp.recipientEmail,

                        cc:
                            null,

                        subject:
                            followUp.subject,

                        body:
                            followUp.body,

                        quotationNumber:
                            quotation.quotationNumber,

                        pdfBase64
                    });

                const sentAt =
                    new Date();

                await prisma.$transaction(
                    async tx => {
                        /*
                          Re-check the follow-up so that
                          it is still pending.
                        */
                        const currentFollowUp =
                            await tx.quotationFollowUp.findUnique({
                                where: {
                                    id:
                                        followUp.id
                                },

                                select: {
                                    status:
                                        true,

                                    cycleNumber:
                                        true,

                                    recipientEmail:
                                        true,

                                    subject:
                                        true,

                                    body:
                                        true
                                }
                            });

                        if (
                            !currentFollowUp ||
                            currentFollowUp.status !==
                            "PENDING"
                        ) {
                            return;
                        }

                        /*
                          Make sure quotation is still
                          in an active state.
                        */
                        const currentQuotation =
                            await tx.quotation.findUnique({
                                where: {
                                    id:
                                        quotation.id
                                },

                                select: {
                                    status:
                                        true,

                                    expiryDate:
                                        true,

                                    followUpDays:
                                        true,

                                    latestVersionNumber:
                                        true
                                }
                            });

                        if (
                            !currentQuotation
                        ) {
                            return;
                        }

                        if (
                            currentQuotation.status !==
                            "SENT" &&
                            currentQuotation.status !==
                            "NEGOTIATION"
                        ) {
                            return;
                        }

                        /*
                          If the quotation expired while
                          the email was being prepared,
                          don't create another follow-up.
                        */
                        const quotationExpired =
                            currentQuotation.expiryDate &&
                            currentQuotation.expiryDate <=
                            sentAt;

                        await tx.quotationFollowUp.update({
                            where: {
                                id:
                                    followUp.id
                            },

                            data: {
                                status:
                                    "SENT",

                                sentAt
                            }
                        });

                        await tx.quotation.update({
                            where: {
                                id:
                                    quotation.id
                            },

                            data: {
                                followUpCount: {
                                    increment:
                                        1
                                }
                            }
                        });

                        /*
                          Store follow-up email history.
                        */
                        await tx.quotationEmail.create({
                            data: {
                                quotation: {
                                    connect: {
                                        id:
                                            quotation.id
                                    }
                                },

                                versionNumber:
                                    currentQuotation.latestVersionNumber,

                                type:
                                    "FOLLOW_UP",

                                toEmail:
                                    emailResult.to,

                                ccEmail:
                                    emailResult.cc,

                                subject:
                                    followUp.subject,

                                body:
                                    followUp.body,

                                sentAt,

                                sentBy: {
                                    connect: {
                                        id:
                                            quotation.createdByUserId
                                    }
                                }
                            }
                        });

                        /*
                          Automatic workflow history.
                        */
                        await tx.quotationWorkflowHistory.create({
                            data: {
                                quotation: {
                                    connect: {
                                        id:
                                            quotation.id
                                    }
                                },

                                action:
                                    "FOLLOW_UP_SENT",

                                fromStatus:
                                    currentQuotation.status,

                                toStatus:
                                    currentQuotation.status,

                                versionNumber:
                                    currentQuotation.latestVersionNumber,

                                remarks:
                                    `Follow-up cycle ${followUp.cycleNumber} sent automatically`,

                                metadata: {
                                    cycleNumber:
                                        followUp.cycleNumber,

                                    resendEmailId:
                                        emailResult.resendEmailId
                                }
                            }
                        });

                        /*
                          Don't schedule another follow-up
                          if quotation is already expired.
                        */
                        if (
                            quotationExpired
                        ) {
                            await tx.quotation.update({
                                where: {
                                    id:
                                        quotation.id
                                },

                                data: {
                                    nextFollowUpAt:
                                        null
                                }
                            });

                            return;
                        }

                        /*
                          Calculate next follow-up.
                        */
                        if (
                            currentQuotation.followUpDays &&
                            currentQuotation.expiryDate
                        ) {
                            const nextFollowUpAt =
                                new Date(
                                    sentAt.getTime() +
                                    currentQuotation.followUpDays *
                                    24 *
                                    60 *
                                    60 *
                                    1000
                                );

                            /*
                              Next follow-up must fall
                              on or before expiry.
                            */
                            if (
                                nextFollowUpAt <=
                                currentQuotation.expiryDate
                            ) {
                                const nextCycleNumber =
                                    currentFollowUp.cycleNumber +
                                    1;

                                await tx.quotationFollowUp.create({
                                    data: {
                                        quotation: {
                                            connect: {
                                                id:
                                                    quotation.id
                                            }
                                        },

                                        cycleNumber:
                                            nextCycleNumber,

                                        scheduledAt:
                                            nextFollowUpAt,

                                        status:
                                            "PENDING",

                                        recipientEmail:
                                            currentFollowUp.recipientEmail,

                                        subject:
                                            currentFollowUp.subject,

                                        body:
                                            currentFollowUp.body
                                    }
                                });

                                await tx.quotation.update({
                                    where: {
                                        id:
                                            quotation.id
                                    },

                                    data: {
                                        nextFollowUpAt:
                                            nextFollowUpAt
                                    }
                                });

                                console.log(
                                    `[Quotation Follow-up] Next cycle ${nextCycleNumber} scheduled for ${quotation.quotationNumber} at ${nextFollowUpAt.toISOString()}`
                                );
                            } else {
                                await tx.quotation.update({
                                    where: {
                                        id:
                                            quotation.id
                                    },

                                    data: {
                                        nextFollowUpAt:
                                            null
                                    }
                                });

                                console.log(
                                    `[Quotation Follow-up] No next follow-up scheduled for ${quotation.quotationNumber}: next date is after expiry`
                                );
                            }
                        } else {
                            await tx.quotation.update({
                                where: {
                                    id:
                                        quotation.id
                                },

                                data: {
                                    nextFollowUpAt:
                                        null
                                }
                            });

                            console.log(
                                `[Quotation Follow-up] No next follow-up scheduled for ${quotation.quotationNumber}: follow-up configuration is incomplete`
                            );
                        }
                    }
                );

                sentCount++;

                console.log(
                    `[Quotation Follow-up] Sent cycle ${followUp.cycleNumber} for ${quotation.quotationNumber}`
                );
            } catch (error) {
                failedCount++;

                console.error(
                    `[Quotation Follow-up] Failed ${followUp.id} for ${quotation.quotationNumber}:`,
                    error
                );
            }
        }

        if (
            dueFollowUps.length > 0
        ) {
            console.log(
                `[Quotation Follow-up] Checked: ${dueFollowUps.length} | Sent: ${sentCount} | Skipped: ${skippedCount} | Failed: ${failedCount}`
            );
        }
    } catch (error) {
        console.error(
            "[Quotation Follow-up] Scheduler error:",
            error
        );
    } finally {
        followUpJobRunning =
            false;
    }
}


/* ============================================================
   START SCHEDULER
============================================================ */

function startQuotationFollowUpScheduler() {
    if (
        followUpInterval
    ) {
        return;
    }

    /*
      Run immediately on server startup.
    */
    runQuotationFollowUps();

    /*
      Check every minute.
    */
    followUpInterval =
        setInterval(
            runQuotationFollowUps,
            60 * 1000
        );

    console.log(
        "[Quotation Follow-up] Scheduler started"
    );
}


/* ============================================================
   STOP SCHEDULER
============================================================ */

function stopQuotationFollowUpScheduler() {
    if (
        !followUpInterval
    ) {
        return;
    }

    clearInterval(
        followUpInterval
    );

    followUpInterval =
        null;

    console.log(
        "[Quotation Follow-up] Scheduler stopped"
    );
}


module.exports = {
    startQuotationFollowUpScheduler,
    stopQuotationFollowUpScheduler,
    runQuotationFollowUps
};