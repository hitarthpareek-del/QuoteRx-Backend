const prisma =
    require("../../../lib/prisma");

const {
    sendQuotationEmail
} = require("./quotation.email.service");

const {
    buildQuotationNumber
} = require("../utils/quotation-number");

const {
    uploadQuotationPdf, downloadDocumentByUrl
} = require("../../../services/document-storage.service");

/* ============================================================
   USER
============================================================ */

async function getActiveUser(userId) {
    const user =
        await prisma.user.findUnique({
            where: {
                id: userId
            },

            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                userPrefix: true,
                role: true,
                status: true,
                companyId: true,
                adminId: true,
                managerId: true
            }
        });

    if (!user) {
        throw new Error(
            "USER_NOT_FOUND"
        );
    }

    if (
        user.status === "SUSPENDED" ||
        user.status === "DEACTIVATED"
    ) {
        throw new Error(
            "USER_INACTIVE"
        );
    }

    return user;
}

/* ============================================================
   CLIENT ACCESS
============================================================ */

async function getAccessibleClient(
    user,
    clientId
) {
    const client =
        await prisma.client.findUnique({
            where: {
                id: clientId
            },

            include: {
                contacts: {
                    orderBy: {
                        createdAt: "asc"
                    }
                },

                assignments: true,

                company: {
                    select: {
                        id: true,
                        name: true,
                        quotationPrefix: true,
                        logoUrl: true,
                        gstNumber: true,
                        cinNumber: true,
                        address: true,
                        emailFromName: true,
                        emailFromAddress: true,
                        status: true
                    }
                }
            }
        });

    if (!client) {
        throw new Error(
            "CLIENT_NOT_FOUND"
        );
    }

    if (client.status !== "ACTIVE") {
        throw new Error(
            "CLIENT_INACTIVE"
        );
    }

    /*
      SUPERADMIN
      ----------
      Can access every active client.
    */

    if (user.role === "SUPERADMIN") {
        return client;
    }

    if (!user.companyId) {
        throw new Error(
            "CLIENT_ACCESS_DENIED"
        );
    }

    if (
        client.companyId !==
        user.companyId
    ) {
        throw new Error(
            "CLIENT_ACCESS_DENIED"
        );
    }

    /*
      ADMIN
      -----
      Own clients OR clients assigned to
      managers below this admin.
    */

    if (user.role === "ADMIN") {
        if (
            client.createdByUserId ===
            user.id
        ) {
            return client;
        }

        const managerIds =
            client.assignments.map(
                assignment =>
                    assignment.managerId
            );

        if (
            managerIds.length === 0
        ) {
            throw new Error(
                "CLIENT_ACCESS_DENIED"
            );
        }

        const manager =
            await prisma.user.findFirst({
                where: {
                    id: {
                        in: managerIds
                    },

                    role: "MANAGER",

                    adminId: user.id,

                    status: {
                        not: "DEACTIVATED"
                    }
                },

                select: {
                    id: true
                }
            });

        if (!manager) {
            throw new Error(
                "CLIENT_ACCESS_DENIED"
            );
        }

        return client;
    }

    /*
      MANAGER
    */

    if (user.role === "MANAGER") {
        const assignment =
            client.assignments.find(
                item =>
                    item.managerId ===
                    user.id
            );

        if (!assignment) {
            throw new Error(
                "CLIENT_ACCESS_DENIED"
            );
        }

        return client;
    }

    /*
      EMPLOYEE
    */

    if (user.role === "EMPLOYEE") {
        if (!user.managerId) {
            throw new Error(
                "CLIENT_ACCESS_DENIED"
            );
        }

        const assignment =
            client.assignments.find(
                item =>
                    item.managerId ===
                    user.managerId
            );

        if (!assignment) {
            throw new Error(
                "CLIENT_ACCESS_DENIED"
            );
        }

        return client;
    }

    throw new Error(
        "CLIENT_ACCESS_DENIED"
    );
}

/* ============================================================
   QUOTATION NUMBER SUPPORT
============================================================ */

async function reserveQuotationSequence({
    companyId,
    userId,
    year
}) {
    const sequence =
        await prisma.$transaction(
            async tx => {
                await tx.quotationSequence.upsert(
                    {
                        where: {
                            companyId_userId_year: {
                                companyId,
                                userId,
                                year
                            }
                        },

                        create: {
                            companyId,
                            userId,
                            year,
                            lastNumber: 0
                        },

                        update: {}
                    }
                );

                return tx
                    .quotationSequence
                    .update({
                        where: {
                            companyId_userId_year: {
                                companyId,
                                userId,
                                year
                            }
                        },

                        data: {
                            lastNumber: {
                                increment: 1
                            }
                        },

                        select: {
                            lastNumber: true
                        }
                    });
            }
        );

    return sequence.lastNumber;
}

/* ============================================================
   DOCUMENT DATA
============================================================ */

function buildDocumentData({
    documentData,
    user,
    company,
    client,
    quotationNumber,
    quotationDate
}) {
    const originalData =
        documentData &&
            typeof documentData === "object"
            ? documentData
            : {};

    return {
        ...originalData,

        system: {
            quotationNumber,

            quotationDate,

            createdByUserId:
                user.id,

            createdByUserName:
                user.name,

            createdByUserEmail:
                user.email
        },

        senderSnapshot: {
            companyId:
                company.id,

            companyName:
                company.name,

            quotationPrefix:
                company.quotationPrefix,

            emailFromName:
                company.emailFromName,

            emailFromAddress:
                company.emailFromAddress,

            logoUrl:
                company.logoUrl,

            gstNumber:
                company.gstNumber,

            cinNumber:
                company.cinNumber,

            address:
                company.address,

            employeeId:
                user.id,

            employeeName:
                user.name,

            employeeEmail:
                user.email
        },

        clientSnapshot: {
            id:
                client.id,

            companyId:
                client.companyId,

            companyName:
                client.companyName,

            companyAddress:
                client.companyAddress,

            createdByUserId:
                client.createdByUserId,

            contacts:
                client.contacts.map(
                    contact => ({
                        id:
                            contact.id,

                        name:
                            contact.name,

                        phone:
                            contact.phone,

                        email:
                            contact.email
                    })
                )
        }
    };
}

/* ============================================================
   CREATE + SEND FIRST QUOTATION
============================================================ */

async function createAndSendQuotation({
    userId,

    clientId,

    documentData,

    quotationDate,

    expectedPODate,

    expiryDate,

    followUpDays,

    emailTo,

    emailCc,

    emailSubject,

    emailBody,

    pdfBase64
}) {
    const user =
        await getActiveUser(
            userId
        );

    if (!clientId) {
        throw new Error(
            "CLIENT_REQUIRED"
        );
    }

    if (
        !documentData ||
        typeof documentData !== "object"
    ) {
        throw new Error(
            "DOCUMENT_DATA_REQUIRED"
        );
    }

    if (!pdfBase64) {
        throw new Error(
            "PDF_REQUIRED"
        );
    }

    if (!emailTo) {
        throw new Error(
            "EMAIL_TO_REQUIRED"
        );
    }

    if (!emailSubject) {
        throw new Error(
            "EMAIL_SUBJECT_REQUIRED"
        );
    }

    if (!emailBody) {
        throw new Error(
            "EMAIL_BODY_REQUIRED"
        );
    }

    const client =
        await getAccessibleClient(
            user,
            clientId
        );

    const company =
        client.company;

    if (!company) {
        throw new Error(
            "COMPANY_NOT_FOUND"
        );
    }

    if (
        company.status !==
        "ACTIVE"
    ) {
        throw new Error(
            "COMPANY_INACTIVE"
        );
    }

    if (
        user.role !== "SUPERADMIN" &&
        user.companyId !==
        company.id
    ) {
        throw new Error(
            "COMPANY_ACCESS_DENIED"
        );
    }

    if (
        !company.quotationPrefix
    ) {
        throw new Error(
            "COMPANY_QUOTATION_PREFIX_REQUIRED"
        );
    }

    if (!user.userPrefix) {
        throw new Error(
            "USER_QUOTATION_PREFIX_REQUIRED"
        );
    }

    if (
        !company.emailFromAddress
    ) {
        throw new Error(
            "COMPANY_QUOTATION_EMAIL_NOT_CONFIGURED"
        );
    }

    const year =
        new Date().getFullYear();

    const finalQuotationDate =
        quotationDate
            ? new Date(
                quotationDate
            )
            : new Date();

    if (
        Number.isNaN(
            finalQuotationDate.getTime()
        )
    ) {
        throw new Error(
            "QUOTATION_DATE_INVALID"
        );
    }

    const finalExpectedPODate =
        expectedPODate
            ? new Date(
                expectedPODate
            )
            : null;

    if (
        finalExpectedPODate &&
        Number.isNaN(
            finalExpectedPODate.getTime()
        )
    ) {
        throw new Error(
            "EXPECTED_PO_DATE_INVALID"
        );
    }

    const finalExpiryDate =
        expiryDate
            ? new Date(
                expiryDate
            )
            : null;

    if (
        finalExpiryDate &&
        Number.isNaN(
            finalExpiryDate.getTime()
        )
    ) {
        throw new Error(
            "EXPIRY_DATE_INVALID"
        );
    }

    if (
        finalExpectedPODate &&
        finalExpiryDate &&
        finalExpectedPODate >
        finalExpiryDate
    ) {
        throw new Error(
            "EXPECTED_PO_DATE_AFTER_EXPIRY"
        );
    }

    const finalFollowUpDays =
        followUpDays === null ||
            followUpDays === undefined ||
            followUpDays === ""
            ? null
            : Number(
                followUpDays
            );

    if (
        finalFollowUpDays !== null &&
        (
            !Number.isInteger(
                finalFollowUpDays
            ) ||
            finalFollowUpDays < 1
        )
    ) {
        throw new Error(
            "FOLLOW_UP_DAYS_INVALID"
        );
    }

    const sequence =
        await reserveQuotationSequence({
            companyId:
                company.id,

            userId:
                user.id,

            year
        });

    const quotationNumber =
        buildQuotationNumber({
            companyPrefix:
                company.quotationPrefix,

            userPrefix:
                user.userPrefix,

            sequence,

            year
        });

    const finalDocumentData =
        buildDocumentData({
            documentData,

            user,

            company,

            client,

            quotationNumber,

            quotationDate:
                finalQuotationDate.toISOString()
        });

    /*
      Send quotation through Resend first.
    */
    const emailResult =
        await sendQuotationEmail({
            company,

            to:
                emailTo,

            cc:
                emailCc,

            subject:
                emailSubject,

            body:
                emailBody,

            quotationNumber,

            pdfBase64
        });

    const sentAt =
        new Date();

    /*
      Upload latest PDF to Supabase.

      The storage path does NOT contain
      the version number, so future versions
      overwrite the same PDF.
    */
    const document =
        await uploadQuotationPdf({
            companyName:
                company.name,

            employeeName:
                user.name ||
                user.email,

            quotationNumber,

            pdfBase64
        });

    /*
      Create quotation records only after:
      1. Email succeeded
      2. PDF upload succeeded
    */
    const result =
        await prisma.$transaction(
            async tx => {
                const quotation =
                    await tx.quotation.create({
                        data: {
                            quotationNumber,

                            companyId:
                                company.id,

                            createdByUserId:
                                user.id,

                            clientId:
                                client.id,

                            status:
                                "SENT",

                            quotationYear:
                                year,

                            yearlySequence:
                                sequence,

                            expectedPODate:
                                finalExpectedPODate,

                            expiryDate:
                                finalExpiryDate,

                            followUpDays:
                                finalFollowUpDays,

                            followUpCount:
                                0,

                            nextFollowUpAt:
                                finalFollowUpDays &&
                                    finalExpiryDate
                                    ? new Date(
                                        sentAt.getTime() +
                                        finalFollowUpDays *
                                        24 *
                                        60 *
                                        60 *
                                        1000
                                    )
                                    : null,

                            latestVersionNumber:
                                1
                        }
                    });

                const version =
                    await tx.quotationVersion.create({
                        data: {
                            quotationId:
                                quotation.id,

                            versionNumber:
                                1,

                            documentData:
                                finalDocumentData,

                            generatedAt:
                                sentAt,

                            generatedByUserId:
                                user.id,

                            sentAt,

                            sentByUserId:
                                user.id,

                            documentUrl:
                                document.url
                        }
                    });

                await tx.quotationWorkflowHistory.create({
                    data: {
                        quotationId:
                            quotation.id,

                        action:
                            "CREATED",

                        fromStatus:
                            null,

                        toStatus:
                            "SENT",

                        versionNumber:
                            1,

                        performedByUserId:
                            user.id,

                        metadata: {
                            quotationNumber,

                            sequence,

                            resendEmailId:
                                emailResult.resendEmailId
                        }
                    }
                });

                await tx.quotationWorkflowHistory.create({
                    data: {
                        quotationId:
                            quotation.id,

                        action:
                            "SENT",

                        fromStatus:
                            null,

                        toStatus:
                            "SENT",

                        versionNumber:
                            1,

                        performedByUserId:
                            user.id,

                        metadata: {
                            resendEmailId:
                                emailResult.resendEmailId
                        }
                    }
                });

                await tx.quotationEmail.create({
                    data: {
                        quotationId:
                            quotation.id,

                        versionNumber:
                            1,

                        type:
                            "INITIAL",

                        toEmail:
                            emailResult.to,

                        ccEmail:
                            emailResult.cc,

                        subject:
                            emailSubject,

                        body:
                            emailBody,

                        sentAt,

                        sentByUserId:
                            user.id
                    }
                });

                /*
                  Schedule first follow-up.
                */
                if (
                    finalFollowUpDays &&
                    finalExpiryDate
                ) {
                    const firstFollowUpAt =
                        new Date(
                            sentAt.getTime() +
                            finalFollowUpDays *
                            24 *
                            60 *
                            60 *
                            1000
                        );

                    if (
                        firstFollowUpAt <=
                        finalExpiryDate
                    ) {
                        await tx.quotationFollowUp.create({
                            data: {
                                quotation: {
                                    connect: {
                                        id:
                                            quotation.id
                                    }
                                },

                                cycleNumber:
                                    1,

                                scheduledAt:
                                    firstFollowUpAt,

                                status:
                                    "PENDING",

                                recipientEmail:
                                    emailResult.to,

                                subject:
                                    emailSubject,

                                body:
                                    emailBody
                            }
                        });
                    }
                }

                return {
                    quotation,
                    version
                };
            }
        );

    return {
        ...result,

        email:
            emailResult
    };
}

/* ============================================================
   CREATE + SEND NEW QUOTATION VERSION
============================================================ */

async function createAndSendQuotationVersion({
    userId,

    quotationId,

    documentData,

    quotationDate,

    expectedPODate,

    expiryDate,

    followUpDays,

    emailTo,

    emailCc,

    emailSubject,

    emailBody,

    pdfBase64
}) {
    const user =
        await getActiveUser(
            userId
        );

    if (!quotationId) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    if (
        !documentData ||
        typeof documentData !== "object"
    ) {
        throw new Error(
            "DOCUMENT_DATA_REQUIRED"
        );
    }

    if (!pdfBase64) {
        throw new Error(
            "PDF_REQUIRED"
        );
    }

    if (!emailTo) {
        throw new Error(
            "EMAIL_TO_REQUIRED"
        );
    }

    if (!emailSubject) {
        throw new Error(
            "EMAIL_SUBJECT_REQUIRED"
        );
    }

    if (!emailBody) {
        throw new Error(
            "EMAIL_BODY_REQUIRED"
        );
    }

    /*
      Make sure the quotation belongs to the
      current user's visible quotation scope.
    */
    const visibilityWhere =
        await getQuotationVisibilityWhere(
            user
        );

    const quotation =
        await prisma.quotation.findFirst({
            where: {
                AND: [
                    visibilityWhere,

                    {
                        id:
                            quotationId
                    }
                ]
            },

            include: {
                company: true,

                client: {
                    include: {
                        contacts: true
                    }
                }
            }
        });

    if (!quotation) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    /*
      Only SENT and NEGOTIATION quotations
      can create a new version.
    */
    if (
        quotation.status !== "SENT" &&
        quotation.status !==
        "NEGOTIATION"
    ) {
        throw new Error(
            "QUOTATION_VERSION_NOT_ALLOWED"
        );
    }

    if (!quotation.company) {
        throw new Error(
            "COMPANY_NOT_FOUND"
        );
    }

    if (
        quotation.company.status !==
        "ACTIVE"
    ) {
        throw new Error(
            "COMPANY_INACTIVE"
        );
    }

    if (
        user.role !== "SUPERADMIN" &&
        user.companyId !==
        quotation.company.id
    ) {
        throw new Error(
            "COMPANY_ACCESS_DENIED"
        );
    }

    if (
        !quotation.company
            .emailFromAddress
    ) {
        throw new Error(
            "COMPANY_QUOTATION_EMAIL_NOT_CONFIGURED"
        );
    }

    /*
      Dates.
    */
    const finalQuotationDate =
        quotationDate
            ? new Date(
                quotationDate
            )
            : new Date();

    if (
        Number.isNaN(
            finalQuotationDate.getTime()
        )
    ) {
        throw new Error(
            "QUOTATION_DATE_INVALID"
        );
    }

    const finalExpectedPODate =
        expectedPODate
            ? new Date(
                expectedPODate
            )
            : null;

    if (
        finalExpectedPODate &&
        Number.isNaN(
            finalExpectedPODate.getTime()
        )
    ) {
        throw new Error(
            "EXPECTED_PO_DATE_INVALID"
        );
    }

    const finalExpiryDate =
        expiryDate
            ? new Date(
                expiryDate
            )
            : quotation.expiryDate;

    if (
        finalExpiryDate &&
        Number.isNaN(
            finalExpiryDate.getTime()
        )
    ) {
        throw new Error(
            "EXPIRY_DATE_INVALID"
        );
    }

    if (
        finalExpectedPODate &&
        finalExpiryDate &&
        finalExpectedPODate >
        finalExpiryDate
    ) {
        throw new Error(
            "EXPECTED_PO_DATE_AFTER_EXPIRY"
        );
    }

    const finalFollowUpDays =
        followUpDays === null ||
            followUpDays === undefined ||
            followUpDays === ""
            ? quotation.followUpDays
            : Number(
                followUpDays
            );

    if (
        finalFollowUpDays !== null &&
        (
            !Number.isInteger(
                finalFollowUpDays
            ) ||
            finalFollowUpDays < 1
        )
    ) {
        throw new Error(
            "FOLLOW_UP_DAYS_INVALID"
        );
    }

    const nextVersionNumber =
        quotation.latestVersionNumber +
        1;

    /*
      Keep the same quotation number.
    */
    const finalDocumentData =
        buildDocumentData({
            documentData,

            user,

            company:
                quotation.company,

            client:
                quotation.client,

            quotationNumber:
                quotation.quotationNumber,

            quotationDate:
                finalQuotationDate.toISOString()
        });

    /*
      Send the updated quotation first.
    */
    const emailResult =
        await sendQuotationEmail({
            company:
                quotation.company,

            to:
                emailTo,

            cc:
                emailCc,

            subject:
                emailSubject,

            body:
                emailBody,

            quotationNumber:
                quotation.quotationNumber,

            pdfBase64
        });

    const sentAt =
        new Date();

    /*
      Upload the new PDF.

      IMPORTANT:
      This uses the exact same storage path.
      Supabase replaces the previous PDF.
    */
    const document =
        await uploadQuotationPdf({
            companyName:
                quotation.company.name,

            employeeName:
                user.name ||
                user.email,

            quotationNumber:
                quotation.quotationNumber,

            pdfBase64
        });

    const result =
        await prisma.$transaction(
            async tx => {
                /*
                  Create the new version.
                */
                const version =
                    await tx.quotationVersion.create({
                        data: {
                            quotationId:
                                quotation.id,

                            versionNumber:
                                nextVersionNumber,

                            documentData:
                                finalDocumentData,

                            generatedAt:
                                sentAt,

                            generatedByUserId:
                                user.id,

                            sentAt,

                            sentByUserId:
                                user.id,

                            documentUrl:
                                document.url
                        }
                    });

                /*
                  Update the parent quotation.
                */
                const updatedQuotation =
                    await tx.quotation.update({
                        where: {
                            id:
                                quotation.id
                        },

                        data: {
                            status:
                                "NEGOTIATION",

                            expectedPODate:
                                finalExpectedPODate,

                            expiryDate:
                                finalExpiryDate,

                            followUpDays:
                                finalFollowUpDays,

                            followUpCount:
                                0,

                            nextFollowUpAt:
                                finalFollowUpDays &&
                                    finalExpiryDate
                                    ? new Date(
                                        sentAt.getTime() +
                                        finalFollowUpDays *
                                        24 *
                                        60 *
                                        60 *
                                        1000
                                    )
                                    : null,

                            latestVersionNumber:
                                nextVersionNumber
                        }
                    });

                /*
                  Previous pending follow-ups
                  are no longer valid.
                */
                await tx.quotationFollowUp.updateMany({
                    where: {
                        quotationId:
                            quotation.id,

                        status:
                            "PENDING"
                    },

                    data: {
                        status:
                            "CANCELLED"
                    }
                });

                await tx.quotationWorkflowHistory.create({
                    data: {
                        quotationId:
                            quotation.id,

                        action:
                            "NEW_VERSION",

                        fromStatus:
                            quotation.status,

                        toStatus:
                            "NEGOTIATION",

                        versionNumber:
                            nextVersionNumber,

                        performedByUserId:
                            user.id,

                        metadata: {
                            resendEmailId:
                                emailResult.resendEmailId
                        }
                    }
                });

                await tx.quotationEmail.create({
                    data: {
                        quotationId:
                            quotation.id,

                        versionNumber:
                            nextVersionNumber,

                        type:
                            "VERSION",

                        toEmail:
                            emailResult.to,

                        ccEmail:
                            emailResult.cc,

                        subject:
                            emailSubject,

                        body:
                            emailBody,

                        sentAt,

                        sentByUserId:
                            user.id
                    }
                });

                /*
                  Schedule the next follow-up.
                  
                  IMPORTANT:
                  cycleNumber continues from the
                  previous quotation history.
                */
                if (
                    finalFollowUpDays &&
                    finalExpiryDate
                ) {
                    const firstFollowUpAt =
                        new Date(
                            sentAt.getTime() +
                            finalFollowUpDays *
                            24 *
                            60 *
                            60 *
                            1000
                        );

                    if (
                        firstFollowUpAt <=
                        finalExpiryDate
                    ) {
                        const latestFollowUp =
                            await tx.quotationFollowUp.findFirst({
                                where: {
                                    quotationId:
                                        quotation.id
                                },

                                orderBy: {
                                    cycleNumber:
                                        "desc"
                                },

                                select: {
                                    cycleNumber:
                                        true
                                }
                            });

                        const nextCycleNumber =
                            (
                                latestFollowUp
                                    ?.cycleNumber ||
                                0
                            ) + 1;

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
                                    firstFollowUpAt,

                                status:
                                    "PENDING",

                                recipientEmail:
                                    emailResult.to,

                                subject:
                                    emailSubject,

                                body:
                                    emailBody
                            }
                        });
                    }
                }

                return {
                    quotation:
                        updatedQuotation,

                    version
                };
            }
        );

    return {
        ...result,

        email:
            emailResult
    };
}

async function getQuotationVisibilityWhere(
    user
) {
    /*
      SUPERADMIN

      Only quotations created by a SUPERADMIN.
    */

    if (user.role === "SUPERADMIN") {
        return {};
    }

    /*
      Every normal user needs a company.
    */

    if (!user.companyId) {
        return {
            id: "__NO_QUOTATION_ACCESS__"
        };
    }

    /*
      ADMIN

      Own quotations
      OR
      quotations from managers/employees
      under this admin.

      We resolve the creator IDs first.
    */

    if (user.role === "ADMIN") {
        const visibleUsers =
            await prisma.user.findMany({
                where: {
                    companyId:
                        user.companyId,

                    OR: [
                        {
                            id:
                                user.id
                        },

                        {
                            adminId:
                                user.id
                        }
                    ],

                    status: {
                        not:
                            "DEACTIVATED"
                    }
                },

                select: {
                    id: true
                }
            });

        return {
            companyId:
                user.companyId,

            createdByUserId: {
                in:
                    visibleUsers.map(
                        item => item.id
                    )
            }
        };
    }

    /*
      MANAGER

      Own quotations
      OR
      quotations created by employees
      under this manager.
    */

    if (user.role === "MANAGER") {
        const visibleUsers =
            await prisma.user.findMany({
                where: {
                    companyId:
                        user.companyId,

                    OR: [
                        {
                            id:
                                user.id
                        },

                        {
                            managerId:
                                user.id
                        }
                    ],

                    status: {
                        not:
                            "DEACTIVATED"
                    }
                },

                select: {
                    id: true
                }
            });

        return {
            companyId:
                user.companyId,

            createdByUserId: {
                in:
                    visibleUsers.map(
                        item => item.id
                    )
            }
        };
    }

    /*
      EMPLOYEE

      Own quotations
      +
      quotations created by employees
      under the same manager.
    */

    if (user.role === "EMPLOYEE") {
        if (!user.managerId) {
            return {
                id:
                    "__NO_QUOTATION_ACCESS__"
            };
        }

        const visibleUsers =
            await prisma.user.findMany({
                where: {
                    companyId:
                        user.companyId,

                    managerId:
                        user.managerId,

                    role:
                        "EMPLOYEE",

                    status: {
                        not:
                            "DEACTIVATED"
                    }
                },

                select: {
                    id: true
                }
            });

        /*
          The query above already includes
          the current employee because the
          current employee has this managerId.
        */

        return {
            companyId:
                user.companyId,

            createdByUserId: {
                in:
                    visibleUsers.map(
                        item => item.id
                    )
            }
        };
    }

    return {
        id:
            "__NO_QUOTATION_ACCESS__"
    };
}

/* ============================================================
   LIST QUOTATIONS
============================================================ */

async function getQuotations({
    userId,
    search,
    status,
    dateFrom,
    dateTo,
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    pageSize = 10
}) {
    const user =
        await getActiveUser(
            userId
        );

    let finalPage =
        Number(page);

    let finalPageSize =
        Number(pageSize);

    if (
        !Number.isInteger(
            finalPage
        ) ||
        finalPage < 1
    ) {
        finalPage = 1;
    }

    if (
        !Number.isInteger(
            finalPageSize
        ) ||
        finalPageSize < 1
    ) {
        finalPageSize = 10;
    }

    /*
      Prevent accidental huge requests.
    */

    finalPageSize =
        Math.min(
            finalPageSize,
            100
        );

    const visibilityWhere =
        await getQuotationVisibilityWhere(
            user
        );

    const where = {
        AND: [
            visibilityWhere
        ]
    };

    /* -------------------- Search -------------------- */

    if (
        search &&
        String(search).trim()
    ) {
        const searchText =
            String(search).trim();

        where.AND.push({
            OR: [
                {
                    quotationNumber: {
                        contains:
                            searchText,
                        mode:
                            "insensitive"
                    }
                },

                {
                    client: {
                        companyName: {
                            contains:
                                searchText,
                            mode:
                                "insensitive"
                        }
                    }
                },

                {
                    client: {
                        companyAddress: {
                            contains:
                                searchText,
                            mode:
                                "insensitive"
                        }
                    }
                },

                {
                    createdBy: {
                        name: {
                            contains:
                                searchText,
                            mode:
                                "insensitive"
                        }
                    }
                },

                {
                    createdBy: {
                        email: {
                            contains:
                                searchText,
                            mode:
                                "insensitive"
                        }
                    }
                }
            ]
        });
    }

    /* -------------------- Status -------------------- */

    if (status) {
        const allowedStatuses = [
            "SENT",
            "NEGOTIATION",
            "SUCCESSFUL",
            "LOST",
            "EXPIRED"
        ];

        const requestedStatuses =
            Array.isArray(status)
                ? status
                : String(status)
                    .split(",")
                    .map(
                        item =>
                            item.trim()
                    )
                    .filter(Boolean);

        const validStatuses =
            requestedStatuses.filter(
                item =>
                    allowedStatuses.includes(
                        String(
                            item
                        ).toUpperCase()
                    )
            );

        if (
            validStatuses.length ===
            1
        ) {
            where.AND.push({
                status:
                    String(
                        validStatuses[0]
                    ).toUpperCase()
            });
        }

        if (
            validStatuses.length > 1
        ) {
            where.AND.push({
                status: {
                    in:
                        validStatuses.map(
                            item =>
                                String(
                                    item
                                ).toUpperCase()
                        )
                }
            });
        }
    }

    /* -------------------- Date From -------------------- */

    if (dateFrom) {
        const from =
            new Date(
                dateFrom
            );

        if (
            Number.isNaN(
                from.getTime()
            )
        ) {
            throw new Error(
                "DATE_FROM_INVALID"
            );
        }

        from.setHours(
            0,
            0,
            0,
            0
        );

        where.AND.push({
            createdAt: {
                gte: from
            }
        });
    }

    /* -------------------- Date To -------------------- */

    if (dateTo) {
        const to =
            new Date(
                dateTo
            );

        if (
            Number.isNaN(
                to.getTime()
            )
        ) {
            throw new Error(
                "DATE_TO_INVALID"
            );
        }

        to.setHours(
            23,
            59,
            59,
            999
        );

        where.AND.push({
            createdAt: {
                lte: to
            }
        });
    }

    /* -------------------- Sorting -------------------- */

    const allowedSortFields = [
        "createdAt",
        "updatedAt",
        "quotationNumber",
        "expiryDate",
        "expectedPODate",
        "status"
    ];

    const finalSortBy =
        allowedSortFields.includes(
            sortBy
        )
            ? sortBy
            : "createdAt";

    const finalSortOrder =
        String(
            sortOrder
        ).toLowerCase() ===
            "asc"
            ? "asc"
            : "desc";

    const skip =
        (finalPage - 1) *
        finalPageSize;

    /*
      Count and data query are executed
      independently.
    */

    const [
        total,
        quotations
    ] =
        await prisma.$transaction([
            prisma.quotation.count({
                where
            }),

            prisma.quotation.findMany({
                where,

                orderBy: {
                    [finalSortBy]:
                        finalSortOrder
                },

                skip,

                take:
                    finalPageSize,

                select: {
                    id: true,

                    quotationNumber: true,

                    status: true,

                    quotationYear: true,

                    yearlySequence: true,

                    expectedPODate: true,

                    expiryDate: true,

                    followUpDays: true,

                    followUpCount: true,

                    nextFollowUpAt: true,

                    successfulType: true,

                    successfulReference: true,

                    lostRemarks: true,

                    latestVersionNumber: true,

                    createdAt: true,

                    updatedAt: true,

                    company: {
                        select: {
                            id: true,
                            name: true,
                            quotationPrefix: true
                        }
                    },

                    client: {
                        select: {
                            id: true,
                            companyName: true,
                            companyAddress: true
                        }
                    },

                    createdBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            userPrefix: true,
                            role: true
                        }
                    },

                    _count: {
                        select: {
                            versions: true,
                            workflowHistory: true,
                            followUps: true,
                            emails: true
                        }
                    }
                }
            })
        ]);

    return {
        quotations,

        pagination: {
            page:
                finalPage,

            pageSize:
                finalPageSize,

            total,

            totalPages:
                Math.ceil(
                    total /
                    finalPageSize
                )
        }
    };
}

/* ============================================================
   GET QUOTATION BY ID
============================================================ */

async function getQuotationById({
    userId,
    quotationId
}) {
    const user =
        await getActiveUser(
            userId
        );

    if (
        !quotationId ||
        !String(quotationId).trim()
    ) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    const visibilityWhere =
        await getQuotationVisibilityWhere(
            user
        );

    const quotation =
        await prisma.quotation.findFirst({
            where: {
                AND: [
                    visibilityWhere,
                    {
                        id: String(
                            quotationId
                        ).trim()
                    }
                ]
            },

            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                        quotationPrefix: true,
                        emailFromName: true,
                        emailFromAddress: true,
                        logoUrl: true,
                        gstNumber: true,
                        cinNumber: true,
                        address: true,
                        status: true
                    }
                },

                client: {
                    select: {
                        id: true,
                        companyName: true,
                        companyAddress: true,
                        status: true,

                        contacts: {
                            orderBy: {
                                createdAt: "asc"
                            },

                            select: {
                                id: true,
                                name: true,
                                phone: true,
                                email: true,
                                createdAt: true,
                                updatedAt: true
                            }
                        }
                    }
                },

                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumber: true,
                        userPrefix: true,
                        role: true,
                        status: true
                    }
                },

                versions: {
                    orderBy: [
                        {
                            versionNumber: "desc"
                        },
                        {
                            createdAt: "desc"
                        }
                    ]
                },

                workflowHistory: {
                    orderBy: {
                        createdAt: "desc"
                    }
                },

                followUps: {
                    orderBy: {
                        cycleNumber: "asc"
                    }
                },

                emails: {
                    orderBy: {
                        createdAt: "desc"
                    }
                }
            }
        });

    if (!quotation) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    return quotation;
}

async function markQuotationSuccessful({
    userId,
    quotationId,
    successfulType,
    successfulReference
}) {
    const user =
        await getActiveUser(
            userId
        );

    if (!quotationId) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    /*
      Validate success type.
    */
    const validTypes = [
        "PO",
        "JOB_TICKET"
    ];

    const finalSuccessfulType =
        String(
            successfulType || ""
        ).trim().toUpperCase();

    if (
        !validTypes.includes(
            finalSuccessfulType
        )
    ) {
        throw new Error(
            "SUCCESSFUL_TYPE_REQUIRED"
        );
    }

    /*
      Reference is mandatory.
    */
    const finalSuccessfulReference =
        String(
            successfulReference || ""
        ).trim();

    if (!finalSuccessfulReference) {
        throw new Error(
            "SUCCESSFUL_REFERENCE_REQUIRED"
        );
    }

    /*
      Check quotation visibility.
    */
    const visibilityWhere =
        await getQuotationVisibilityWhere(
            user
        );

    const quotation =
        await prisma.quotation.findFirst({
            where: {
                AND: [
                    visibilityWhere,
                    {
                        id: quotationId
                    }
                ]
            }
        });

    if (!quotation) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    /*
      A quotation can only be marked
      successful from SENT or NEGOTIATION.
    */
    if (
        quotation.status !== "SENT" &&
        quotation.status !== "NEGOTIATION"
    ) {
        throw new Error(
            "QUOTATION_SUCCESSFUL_NOT_ALLOWED"
        );
    }

    const updatedQuotation =
        await prisma.$transaction(
            async tx => {
                const updated =
                    await tx.quotation.update({
                        where: {
                            id:
                                quotation.id
                        },

                        data: {
                            status:
                                "SUCCESSFUL",

                            successfulType:
                                finalSuccessfulType,

                            successfulReference:
                                finalSuccessfulReference,

                            successfulJobTicketId:
                                finalSuccessfulType ===
                                    "JOB_TICKET"
                                    ? finalSuccessfulReference
                                    : null,

                            successfulPONumber:
                                finalSuccessfulType ===
                                    "PO"
                                    ? finalSuccessfulReference
                                    : null,

                            nextFollowUpAt:
                                null
                        }
                    });

                await tx.quotationWorkflowHistory.create(
                    {
                        data: {
                            quotationId:
                                quotation.id,

                            action:
                                "SUCCESSFUL",

                            fromStatus:
                                quotation.status,

                            toStatus:
                                "SUCCESSFUL",

                            versionNumber:
                                quotation.latestVersionNumber,

                            performedByUserId:
                                user.id,

                            metadata: {
                                successfulType:
                                    finalSuccessfulType,

                                successfulReference:
                                    finalSuccessfulReference
                            }
                        }
                    }
                );

                return updated;
            }
        );

    return updatedQuotation;
}

async function updateQuotationPO({
    userId,
    quotationId,
    poNumber
}) {
    const user =
        await getActiveUser(
            userId
        );

    if (!quotationId) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    const finalPONumber =
        String(
            poNumber || ""
        ).trim();

    if (!finalPONumber) {
        throw new Error(
            "PO_NUMBER_REQUIRED"
        );
    }

    /*
      Check quotation visibility.
    */
    const visibilityWhere =
        await getQuotationVisibilityWhere(
            user
        );

    const quotation =
        await prisma.quotation.findFirst({
            where: {
                AND: [
                    visibilityWhere,

                    {
                        id:
                            quotationId
                    }
                ]
            }
        });

    if (!quotation) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    /*
      PO can only be added after the quotation
      has already been marked successful.
    */
    if (
        quotation.status !==
        "SUCCESSFUL"
    ) {
        throw new Error(
            "QUOTATION_PO_UPDATE_NOT_ALLOWED"
        );
    }

    /*
      This API is specifically for quotations
      that were initially successful with a
      Job Ticket.
    */
    if (
        quotation.successfulType !==
            "JOB_TICKET" &&
        !quotation.successfulJobTicketId
    ) {
        throw new Error(
            "QUOTATION_PO_UPDATE_NOT_ALLOWED"
        );
    }

    if (
        quotation.successfulPONumber
    ) {
        throw new Error(
            "PO_ALREADY_EXISTS"
        );
    }

    const updatedQuotation =
        await prisma.$transaction(
            async tx => {
                const updated =
                    await tx.quotation.update({
                        where: {
                            id:
                                quotation.id
                        },

                        data: {
                            /*
                              Preserve the original
                              Job Ticket.
                            */
                            successfulJobTicketId:
                                quotation.successfulJobTicketId ||
                                quotation.successfulReference,

                            successfulPONumber:
                                finalPONumber,

                            /*
                              From this point the
                              primary success reference
                              becomes the PO.
                            */
                            successfulType:
                                "PO",

                            successfulReference:
                                finalPONumber
                        }
                    });

                await tx.quotationWorkflowHistory.create({
                    data: {
                        quotation: {
                            connect: {
                                id:
                                    quotation.id
                            }
                        },

                        action:
                            "SUCCESSFUL",

                        fromStatus:
                            "SUCCESSFUL",

                        toStatus:
                            "SUCCESSFUL",

                        versionNumber:
                            quotation.latestVersionNumber,

                        performedBy: {
                            connect: {
                                id:
                                    user.id
                            }
                        },

                        remarks:
                            `PO added after Job Ticket success: ${finalPONumber}`,

                        metadata: {
                            previousSuccessfulType:
                                quotation.successfulType,

                            previousSuccessfulReference:
                                quotation.successfulReference,

                            jobTicketId:
                                quotation.successfulJobTicketId ||
                                quotation.successfulReference,

                            poNumber:
                                finalPONumber
                        }
                    }
                });

                return updated;
            }
        );

    return updatedQuotation;
}

async function markQuotationLost({
    userId,
    quotationId,
    lostRemarks
}) {
    const user =
        await getActiveUser(
            userId
        );

    if (!quotationId) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    /*
      Remarks are mandatory.
    */
    const finalLostRemarks =
        String(
            lostRemarks || ""
        ).trim();

    if (!finalLostRemarks) {
        throw new Error(
            "LOST_REMARKS_REQUIRED"
        );
    }

    /*
      Check quotation visibility.
    */
    const visibilityWhere =
        await getQuotationVisibilityWhere(
            user
        );

    const quotation =
        await prisma.quotation.findFirst({
            where: {
                AND: [
                    visibilityWhere,
                    {
                        id: quotationId
                    }
                ]
            }
        });

    if (!quotation) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    /*
      A quotation can only be marked
      lost from SENT or NEGOTIATION.
    */
    if (
        quotation.status !== "SENT" &&
        quotation.status !== "NEGOTIATION"
    ) {
        throw new Error(
            "QUOTATION_LOST_NOT_ALLOWED"
        );
    }

    const updatedQuotation =
        await prisma.$transaction(
            async tx => {
                const updated =
                    await tx.quotation.update({
                        where: {
                            id:
                                quotation.id
                        },

                        data: {
                            status:
                                "LOST",

                            lostRemarks:
                                finalLostRemarks,

                            nextFollowUpAt:
                                null
                        }
                    });

                await tx.quotationWorkflowHistory.create(
                    {
                        data: {
                            quotationId:
                                quotation.id,

                            action:
                                "LOST",

                            fromStatus:
                                quotation.status,

                            toStatus:
                                "LOST",

                            versionNumber:
                                quotation.latestVersionNumber,

                            performedByUserId:
                                user.id,

                            remarks:
                                finalLostRemarks,

                            metadata: {
                                lostRemarks:
                                    finalLostRemarks
                            }
                        }
                    }
                );

                return updated;
            }
        );

    return updatedQuotation;
}

async function expireQuotation({
    userId,
    quotationId
}) {
    const user =
        await getActiveUser(
            userId
        );

    if (!quotationId) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    const visibilityWhere =
        await getQuotationVisibilityWhere(
            user
        );

    const quotation =
        await prisma.quotation.findFirst({
            where: {
                AND: [
                    visibilityWhere,
                    {
                        id: quotationId
                    }
                ]
            }
        });

    if (!quotation) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    /*
      Only unresolved quotations can expire.
    */
    if (
        quotation.status !== "SENT" &&
        quotation.status !== "NEGOTIATION"
    ) {
        throw new Error(
            "QUOTATION_EXPIRY_NOT_ALLOWED"
        );
    }

    /*
      Expiry date must exist.
    */
    if (!quotation.expiryDate) {
        throw new Error(
            "QUOTATION_EXPIRY_DATE_NOT_SET"
        );
    }

    /*
      Do not expire before expiry date.
    */
    const now =
        new Date();

    if (
        quotation.expiryDate > now
    ) {
        throw new Error(
            "QUOTATION_NOT_DUE_FOR_EXPIRY"
        );
    }

    const result =
        await prisma.$transaction(
            async tx => {
                const updatedQuotation =
                    await tx.quotation.update({
                        where: {
                            id:
                                quotation.id
                        },

                        data: {
                            status:
                                "EXPIRED",

                            nextFollowUpAt:
                                null
                        }
                    });

                /*
                  Any pending follow-ups are
                  no longer required.
                */
                await tx.quotationFollowUp.updateMany({
                    where: {
                        quotationId:
                            quotation.id,

                        status:
                            "PENDING"
                    },

                    data: {
                        status:
                            "CANCELLED"
                    }
                });

                await tx.quotationWorkflowHistory.create({
                    data: {
                        quotation: {
                            connect: {
                                id: quotation.id
                            }
                        },

                        action:
                            "EXPIRED",

                        fromStatus:
                            quotation.status,

                        toStatus:
                            "EXPIRED",

                        versionNumber:
                            quotation.latestVersionNumber,

                        performedBy: {
                            connect: {
                                id: user.id
                            }
                        },

                        remarks:
                            "Quotation expired automatically",

                        metadata: {
                            expiredAt:
                                now.toISOString()
                        }
                    }
                });

                return updatedQuotation;
            }
        );

    return result;
}

async function expireDueQuotations() {
    const now =
        new Date();

    const quotations =
        await prisma.quotation.findMany({
            where: {
                status: {
                    in: [
                        "SENT",
                        "NEGOTIATION"
                    ]
                },

                expiryDate: {
                    not: null,
                    lte: now
                }
            },

            select: {
                id: true
            }
        });

    let expiredCount = 0;

    for (const quotation of quotations) {
        try {
            await prisma.$transaction(
                async tx => {
                    const current =
                        await tx.quotation.findUnique({
                            where: {
                                id:
                                    quotation.id
                            },

                            select: {
                                status: true,
                                latestVersionNumber: true
                            }
                        });

                    /*
                      Another process may have already
                      changed this quotation.
                    */
                    if (
                        !current ||
                        (
                            current.status !==
                            "SENT" &&
                            current.status !==
                            "NEGOTIATION"
                        )
                    ) {
                        return;
                    }

                    await tx.quotation.update({
                        where: {
                            id:
                                quotation.id
                        },

                        data: {
                            status:
                                "EXPIRED",

                            nextFollowUpAt:
                                null
                        }
                    });

                    await tx.quotationFollowUp.updateMany({
                        where: {
                            quotationId:
                                quotation.id,

                            status:
                                "PENDING"
                        },

                        data: {
                            status:
                                "CANCELLED"
                        }
                    });

                    await tx.quotationWorkflowHistory.create({
                        data: {
                            quotation: {
                                connect: {
                                    id: quotation.id
                                }
                            },

                            action:
                                "EXPIRED",

                            fromStatus:
                                current.status,

                            toStatus:
                                "EXPIRED",

                            versionNumber:
                                current.latestVersionNumber,

                            remarks:
                                "Quotation expired automatically",

                            metadata: {
                                expiredAt:
                                    now.toISOString()
                            }
                        }
                    });

                    expiredCount++;
                }
            );
        } catch (error) {
            console.error(
                `Failed to expire quotation ${quotation.id}:`,
                error
            );
        }
    }

    return {
        expiredCount
    };
}

async function resendQuotation({
    userId,
    quotationId,
    emailTo,
    emailCc,
    emailSubject,
    emailBody
}) {
    const user =
        await getActiveUser(
            userId
        );

    if (!quotationId) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    if (!emailTo) {
        throw new Error(
            "EMAIL_TO_REQUIRED"
        );
    }

    if (!emailSubject) {
        throw new Error(
            "EMAIL_SUBJECT_REQUIRED"
        );
    }

    if (!emailBody) {
        throw new Error(
            "EMAIL_BODY_REQUIRED"
        );
    }

    /*
      Check quotation visibility.
    */
    const visibilityWhere =
        await getQuotationVisibilityWhere(
            user
        );

    const quotation =
        await prisma.quotation.findFirst({
            where: {
                AND: [
                    visibilityWhere,
                    {
                        id:
                            quotationId
                    }
                ]
            },

            include: {
                company: true
            }
        });

    if (!quotation) {
        throw new Error(
            "QUOTATION_NOT_FOUND"
        );
    }

    /*
      A final quotation should not be resent
      through this normal resend action.
    */
    if (
        quotation.status ===
        "SUCCESSFUL" ||
        quotation.status ===
        "LOST" ||
        quotation.status ===
        "EXPIRED"
    ) {
        throw new Error(
            "QUOTATION_RESEND_NOT_ALLOWED"
        );
    }

    if (!quotation.company) {
        throw new Error(
            "COMPANY_NOT_FOUND"
        );
    }

    if (
        quotation.company.status !==
        "ACTIVE"
    ) {
        throw new Error(
            "COMPANY_INACTIVE"
        );
    }

    if (
        user.role !== "SUPERADMIN" &&
        user.companyId !==
        quotation.company.id
    ) {
        throw new Error(
            "COMPANY_ACCESS_DENIED"
        );
    }

    if (
        !quotation.company
            .emailFromAddress
    ) {
        throw new Error(
            "COMPANY_QUOTATION_EMAIL_NOT_CONFIGURED"
        );
    }

    /*
      Get latest version.
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

    if (!latestVersion) {
        throw new Error(
            "QUOTATION_VERSION_NOT_FOUND"
        );
    }

    if (!latestVersion.documentUrl) {
        throw new Error(
            "DOCUMENT_URL_NOT_FOUND"
        );
    }

    /*
      Download latest PDF from Supabase.
    */
    const pdfBase64 =
        await downloadDocumentByUrl(
            latestVersion.documentUrl
        );

    if (!pdfBase64) {
        throw new Error(
            "DOCUMENT_DOWNLOAD_FAILED"
        );
    }

    /*
      Send through Resend.
    */
    const emailResult =
        await sendQuotationEmail({
            company:
                quotation.company,

            to:
                emailTo,

            cc:
                emailCc,

            subject:
                emailSubject,

            body:
                emailBody,

            quotationNumber:
                quotation.quotationNumber,

            pdfBase64
        });

    const sentAt =
        new Date();

    /*
      Store resend history.
    */
    await prisma.$transaction(
        async tx => {
            await tx.quotationEmail.create({
                data: {
                    quotation: {
                        connect: {
                            id:
                                quotation.id
                        }
                    },

                    versionNumber:
                        latestVersion.versionNumber,

                    type:
                        "RESEND",

                    toEmail:
                        emailResult.to,

                    ccEmail:
                        emailResult.cc,

                    subject:
                        emailSubject,

                    body:
                        emailBody,

                    sentAt,

                    sentBy: {
                        connect: {
                            id:
                                user.id
                        }
                    }
                }
            });

            await tx.quotationWorkflowHistory.create({
                data: {
                    quotation: {
                        connect: {
                            id:
                                quotation.id
                        }
                    },

                    action:
                        "RESENT",

                    fromStatus:
                        quotation.status,

                    toStatus:
                        quotation.status,

                    versionNumber:
                        latestVersion.versionNumber,

                    performedBy: {
                        connect: {
                            id:
                                user.id
                        }
                    },

                    remarks:
                        `Quotation resent - version ${latestVersion.versionNumber}`,

                    metadata: {
                        resendEmailId:
                            emailResult.resendEmailId
                    }
                }
            });
        }
    );

    return {
        quotationId:
            quotation.id,

        quotationNumber:
            quotation.quotationNumber,

        versionNumber:
            latestVersion.versionNumber,

        status:
            quotation.status,

        email:
            emailResult
    };
}

module.exports = {
    createAndSendQuotation,
    getQuotations,
    getQuotationById,
    getAccessibleClient,
    getActiveUser,
    createAndSendQuotationVersion,
    markQuotationSuccessful,
    markQuotationLost,
    expireQuotation,
    expireDueQuotations,
    resendQuotation,
    updateQuotationPO
};