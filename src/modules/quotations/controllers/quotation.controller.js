const quotationService =
    require("../services/quotation.service");

/* ============================================================
   SEND FIRST QUOTATION
============================================================ */

async function sendQuotation(
    req,
    res
) {
    try {
        const {
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
        } = req.body;

        const result =
            await quotationService
                .createAndSendQuotation({
                    userId:
                        req.user.id,

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
                });

        return res
            .status(201)
            .json({
                success: true,

                message:
                    "Quotation created and sent successfully",

                quotation:
                    result.quotation,

                version:
                    result.version,

                email:
                    result.email
            });
    } catch (error) {
        console.error(
            "Quotation send error:",
            error
        );

        const errorMap = {
            USER_NOT_FOUND: [
                404,
                "User not found"
            ],

            USER_INACTIVE: [
                403,
                "Your account is inactive"
            ],

            CLIENT_REQUIRED: [
                400,
                "Client is required"
            ],

            CLIENT_NOT_FOUND: [
                404,
                "Client not found"
            ],

            CLIENT_INACTIVE: [
                400,
                "Selected client is inactive"
            ],

            CLIENT_ACCESS_DENIED: [
                403,
                "You do not have access to this client"
            ],

            COMPANY_NOT_FOUND: [
                404,
                "Operating company not found"
            ],

            COMPANY_INACTIVE: [
                400,
                "Operating company is inactive"
            ],

            COMPANY_ACCESS_DENIED: [
                403,
                "You cannot create a quotation for this company"
            ],

            COMPANY_QUOTATION_PREFIX_REQUIRED: [
                400,
                "Quotation prefix is not configured for this company"
            ],

            USER_QUOTATION_PREFIX_REQUIRED: [
                400,
                "Quotation prefix is not configured for this user"
            ],

            COMPANY_QUOTATION_EMAIL_NOT_CONFIGURED: [
                400,
                "Quotation sender email is not configured for this company"
            ],

            RESEND_API_KEY_NOT_CONFIGURED: [
                500,
                "Resend API key is not configured"
            ],

            RESEND_SEND_FAILED: [
                502,
                "Quotation email could not be sent"
            ],

            DOCUMENT_DATA_REQUIRED: [
                400,
                "Quotation document data is required"
            ],

            PDF_REQUIRED: [
                400,
                "Generated PDF is required"
            ],

            PDF_BASE64_INVALID: [
                400,
                "Invalid PDF data"
            ],

            EMAIL_TO_REQUIRED: [
                400,
                "Client email address is required"
            ],

            EMAIL_SUBJECT_REQUIRED: [
                400,
                "Email subject is required"
            ],

            EMAIL_BODY_REQUIRED: [
                400,
                "Email body is required"
            ],

            QUOTATION_DATE_INVALID: [
                400,
                "Invalid quotation date"
            ],

            EXPECTED_PO_DATE_INVALID: [
                400,
                "Invalid expected PO date"
            ],

            EXPIRY_DATE_INVALID: [
                400,
                "Invalid expiry date"
            ],

            FOLLOW_UP_DAYS_INVALID: [
                400,
                "Follow-up days must be a positive integer"
            ],

            EXPECTED_PO_DATE_AFTER_EXPIRY: [
                400,
                "Expected PO date cannot be after expiry date"
            ]
        };

        const mapped =
            errorMap[
                error.message
            ];

        if (mapped) {
            return res
                .status(mapped[0])
                .json({
                    success: false,
                    message: mapped[1]
                });
        }

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Could not create and send quotation"
            });
    }
}

/* ============================================================
   GET QUOTATIONS
============================================================ */

async function getQuotations(
    req,
    res
) {
    try {
        const {
            search,
            status,
            dateFrom,
            dateTo,
            sortBy,
            sortOrder,
            page,
            pageSize
        } = req.query;

        const result =
            await quotationService
                .getQuotations({
                    userId:
                        req.user.id,

                    search,

                    status,

                    dateFrom,

                    dateTo,

                    sortBy,

                    sortOrder,

                    page,

                    pageSize
                });

        return res.json({
            success: true,

            ...result
        });
    } catch (error) {
        console.error(
            "Get quotations error:",
            error
        );

        const errorMap = {
            USER_NOT_FOUND: [
                404,
                "User not found"
            ],

            USER_INACTIVE: [
                403,
                "Your account is inactive"
            ],

            DATE_FROM_INVALID: [
                400,
                "Invalid dateFrom"
            ],

            DATE_TO_INVALID: [
                400,
                "Invalid dateTo"
            ]
        };

        const mapped =
            errorMap[
                error.message
            ];

        if (mapped) {
            return res
                .status(mapped[0])
                .json({
                    success: false,
                    message: mapped[1]
                });
        }

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Could not fetch quotations"
            });
    }
}

async function getQuotationById(
    req,
    res
) {
    try {
        const quotation =
            await quotationService.getQuotationById({
                userId: req.user.id,
                quotationId: req.params.id
            });

        return res.status(200).json({
            success: true,
            data: quotation
        });
    } catch (error) {
        console.error(
            "Get quotation by ID error:",
            error
        );

        switch (error.message) {
            case "USER_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });

            case "USER_INACTIVE":
                return res.status(403).json({
                    success: false,
                    message: "User account is not active"
                });

            case "QUOTATION_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message: "Quotation not found"
                });

            default:
                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to fetch quotation"
                });
        }
    }
}


async function createQuotationVersion(
    req,
    res
) {
    try {
        const {
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
        } = req.body;

        const result =
            await quotationService.createAndSendQuotationVersion({
                userId:
                    req.user.id,

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
            });

        return res.status(201).json({
            success: true,
            message:
                "Quotation version created and sent successfully",
            data: result
        });
    } catch (error) {
        console.error(
            "Create quotation version error:",
            error
        );

        switch (error.message) {
            case "USER_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });

            case "USER_INACTIVE":
                return res.status(403).json({
                    success: false,
                    message:
                        "User account is not active"
                });

            case "QUOTATION_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "Quotation not found"
                });

            case "QUOTATION_VERSION_NOT_ALLOWED":
                return res.status(409).json({
                    success: false,
                    message:
                        "A new version cannot be created for the current quotation status"
                });

            case "DOCUMENT_DATA_REQUIRED":
                return res.status(400).json({
                    success: false,
                    message:
                        "Document data is required"
                });

            case "PDF_REQUIRED":
                return res.status(400).json({
                    success: false,
                    message:
                        "Quotation PDF is required"
                });

            case "EMAIL_TO_REQUIRED":
                return res.status(400).json({
                    success: false,
                    message:
                        "Recipient email is required"
                });

            case "EMAIL_SUBJECT_REQUIRED":
                return res.status(400).json({
                    success: false,
                    message:
                        "Email subject is required"
                });

            case "EMAIL_BODY_REQUIRED":
                return res.status(400).json({
                    success: false,
                    message:
                        "Email body is required"
                });

            case "COMPANY_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "Company not found"
                });

            case "COMPANY_INACTIVE":
                return res.status(403).json({
                    success: false,
                    message:
                        "Company is inactive"
                });

            case "COMPANY_ACCESS_DENIED":
                return res.status(403).json({
                    success: false,
                    message:
                        "You do not have access to this company"
                });

            case "COMPANY_QUOTATION_EMAIL_NOT_CONFIGURED":
                return res.status(400).json({
                    success: false,
                    message:
                        "Quotation sender email is not configured for this company"
                });

            case "QUOTATION_DATE_INVALID":
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid quotation date"
                });

            case "EXPECTED_PO_DATE_INVALID":
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid expected PO date"
                });

            case "EXPIRY_DATE_INVALID":
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid expiry date"
                });

            case "FOLLOW_UP_DAYS_INVALID":
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid follow-up days"
                });

            case "EXPECTED_PO_DATE_AFTER_EXPIRY":
                return res.status(400).json({
                    success: false,
                    message:
                        "Expected PO date cannot be after expiry date"
                });

            case "RESEND_API_KEY_NOT_CONFIGURED":
                return res.status(500).json({
                    success: false,
                    message:
                        "Quotation email service is not configured"
                });

            case "RESEND_SEND_FAILED":
                return res.status(502).json({
                    success: false,
                    message:
                        "Quotation email could not be sent"
                });

            default:
                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to create quotation version"
                });
        }
    }
}


async function markQuotationSuccessful(
    req,
    res
) {
    try {
        const {
            successfulType,
            successfulReference
        } = req.body;

        const quotation =
            await quotationService.markQuotationSuccessful({
                userId:
                    req.user.id,

                quotationId:
                    req.params.id,

                successfulType,

                successfulReference
            });

        return res.status(200).json({
            success: true,
            message:
                "Quotation marked as successful",
            data: quotation
        });
    } catch (error) {
        console.error(
            "Mark quotation successful error:",
            error
        );

        switch (error.message) {
            case "USER_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "User not found"
                });

            case "USER_INACTIVE":
                return res.status(403).json({
                    success: false,
                    message:
                        "User account is not active"
                });

            case "QUOTATION_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "Quotation not found"
                });

            case "SUCCESSFUL_TYPE_REQUIRED":
                return res.status(400).json({
                    success: false,
                    message:
                        "Successful type must be PO or JOB_TICKET"
                });

            case "SUCCESSFUL_REFERENCE_REQUIRED":
                return res.status(400).json({
                    success: false,
                    message:
                        "PO number or Job Ticket ID is required"
                });

            case "QUOTATION_SUCCESSFUL_NOT_ALLOWED":
                return res.status(409).json({
                    success: false,
                    message:
                        "Quotation cannot be marked successful from its current status"
                });

            default:
                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to mark quotation successful"
                });
        }
    }
}

async function markQuotationLost(
    req,
    res
) {
    try {
        const {
            lostRemarks
        } = req.body;

        const quotation =
            await quotationService.markQuotationLost({
                userId:
                    req.user.id,

                quotationId:
                    req.params.id,

                lostRemarks
            });

        return res.status(200).json({
            success: true,
            message:
                "Quotation marked as lost",
            data: quotation
        });
    } catch (error) {
        console.error(
            "Mark quotation lost error:",
            error
        );

        switch (error.message) {
            case "USER_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "User not found"
                });

            case "USER_INACTIVE":
                return res.status(403).json({
                    success: false,
                    message:
                        "User account is not active"
                });

            case "QUOTATION_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "Quotation not found"
                });

            case "LOST_REMARKS_REQUIRED":
                return res.status(400).json({
                    success: false,
                    message:
                        "Remarks are required when marking a quotation as lost"
                });

            case "QUOTATION_LOST_NOT_ALLOWED":
                return res.status(409).json({
                    success: false,
                    message:
                        "Quotation cannot be marked lost from its current status"
                });

            default:
                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to mark quotation as lost"
                });
        }
    }
}

async function expireQuotation(
    req,
    res
) {
    try {
        const quotation =
            await quotationService.expireQuotation({
                userId:
                    req.user.id,

                quotationId:
                    req.params.id
            });

        return res.status(200).json({
            success: true,
            message:
                "Quotation marked as expired",
            data: quotation
        });
    } catch (error) {
        console.error(
            "Expire quotation error:",
            error
        );

        switch (error.message) {
            case "USER_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "User not found"
                });

            case "USER_INACTIVE":
                return res.status(403).json({
                    success: false,
                    message:
                        "User account is not active"
                });

            case "QUOTATION_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "Quotation not found"
                });

            case "QUOTATION_EXPIRY_NOT_ALLOWED":
                return res.status(409).json({
                    success: false,
                    message:
                        "Quotation cannot be expired from its current status"
                });

            case "QUOTATION_EXPIRY_DATE_NOT_SET":
                return res.status(400).json({
                    success: false,
                    message:
                        "Quotation expiry date is not set"
                });

            case "QUOTATION_NOT_DUE_FOR_EXPIRY":
                return res.status(409).json({
                    success: false,
                    message:
                        "Quotation expiry date has not been reached"
                });

            default:
                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to expire quotation"
                });
        }
    }
}

async function resendQuotation(
    req,
    res
) {
    try {
        const {
            emailTo,
            emailCc,
            emailSubject,
            emailBody
        } = req.body;

        const result =
            await quotationService.resendQuotation({
                userId:
                    req.user.id,

                quotationId:
                    req.params.id,

                emailTo,

                emailCc,

                emailSubject,

                emailBody
            });

        return res.status(200).json({
            success: true,
            message:
                "Quotation resent successfully",
            data:
                result
        });
    } catch (error) {
        console.error(
            "Resend quotation error:",
            error
        );

        switch (error.message) {
            case "USER_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "User not found"
                });

            case "USER_INACTIVE":
                return res.status(403).json({
                    success: false,
                    message:
                        "User account is not active"
                });

            case "QUOTATION_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "Quotation not found"
                });

            case "QUOTATION_RESEND_NOT_ALLOWED":
                return res.status(409).json({
                    success: false,
                    message:
                        "Quotation cannot be resent from its current status"
                });

            case "QUOTATION_VERSION_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "Quotation version not found"
                });

            case "DOCUMENT_URL_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "Quotation document is not available"
                });

            case "DOCUMENT_DOWNLOAD_FAILED":
                return res.status(502).json({
                    success: false,
                    message:
                        "Quotation PDF could not be retrieved"
                });

            case "EMAIL_TO_REQUIRED":
                return res.status(400).json({
                    success: false,
                    message:
                        "Recipient email is required"
                });

            case "EMAIL_SUBJECT_REQUIRED":
                return res.status(400).json({
                    success: false,
                    message:
                        "Email subject is required"
                });

            case "EMAIL_BODY_REQUIRED":
                return res.status(400).json({
                    success: false,
                    message:
                        "Email body is required"
                });

            case "COMPANY_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "Company not found"
                });

            case "COMPANY_INACTIVE":
                return res.status(403).json({
                    success: false,
                    message:
                        "Company is inactive"
                });

            case "COMPANY_ACCESS_DENIED":
                return res.status(403).json({
                    success: false,
                    message:
                        "You do not have access to this company"
                });

            case "COMPANY_QUOTATION_EMAIL_NOT_CONFIGURED":
                return res.status(400).json({
                    success: false,
                    message:
                        "Quotation sender email is not configured"
                });

            case "RESEND_API_KEY_NOT_CONFIGURED":
                return res.status(500).json({
                    success: false,
                    message:
                        "Quotation email service is not configured"
                });

            case "RESEND_SEND_FAILED":
                return res.status(502).json({
                    success: false,
                    message:
                        "Quotation email could not be sent"
                });

            default:
                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to resend quotation"
                });
        }
    }
}

async function updateQuotationPO(
    req,
    res
) {
    try {
        const {
            poNumber
        } = req.body;

        const quotation =
            await quotationService.updateQuotationPO({
                userId:
                    req.user.id,

                quotationId:
                    req.params.id,

                poNumber
            });

        return res.status(200).json({
            success: true,
            message:
                "PO number updated successfully",
            data:
                quotation
        });
    } catch (error) {
        console.error(
            "Update quotation PO error:",
            error
        );

        switch (error.message) {
            case "USER_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "User not found"
                });

            case "USER_INACTIVE":
                return res.status(403).json({
                    success: false,
                    message:
                        "User account is not active"
                });

            case "QUOTATION_NOT_FOUND":
                return res.status(404).json({
                    success: false,
                    message:
                        "Quotation not found"
                });

            case "PO_NUMBER_REQUIRED":
                return res.status(400).json({
                    success: false,
                    message:
                        "PO number is required"
                });

            case "QUOTATION_PO_UPDATE_NOT_ALLOWED":
                return res.status(409).json({
                    success: false,
                    message:
                        "PO can only be added to a successful quotation that was completed using a Job Ticket"
                });

            case "PO_ALREADY_EXISTS":
                return res.status(409).json({
                    success: false,
                    message:
                        "A PO number has already been recorded for this quotation"
                });

            default:
                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to update PO number"
                });
        }
    }
}

module.exports = {
    sendQuotation,
    getQuotations,
    getQuotationById,
    createQuotationVersion,
    markQuotationSuccessful,
    markQuotationLost,
    expireQuotation,
    resendQuotation,
    updateQuotationPO
};