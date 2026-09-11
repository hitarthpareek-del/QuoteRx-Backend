const { Resend } = require("resend");

const resendApiKey =
    process.env.RESEND_API_KEY;

const resend = resendApiKey
    ? new Resend(resendApiKey)
    : null;

function normalizeEmail(value) {
    if (!value) {
        return null;
    }

    const email =
        String(value)
            .trim()
            .toLowerCase();

    return email || null;
}

function normalizePdfBase64(value) {
    if (!value) {
        throw new Error(
            "PDF_REQUIRED"
        );
    }

    let base64 =
        String(value).trim();

    /*
      Supports both:

      AAAABBBB....

      and

      data:application/pdf;base64,AAAABBBB....
    */

    if (base64.includes(",")) {
        base64 =
            base64.substring(
                base64.indexOf(",") + 1
            );
    }

    if (!base64) {
        throw new Error(
            "PDF_BASE64_INVALID"
        );
    }

    return base64;
}

async function sendQuotationEmail({
    company,
    to,
    cc,
    subject,
    body,
    quotationNumber,
    pdfBase64
}) {
    if (!resend) {
        throw new Error(
            "RESEND_API_KEY_NOT_CONFIGURED"
        );
    }

    if (!company) {
        throw new Error(
            "COMPANY_NOT_FOUND"
        );
    }

    if (!company.emailFromAddress) {
        throw new Error(
            "COMPANY_QUOTATION_EMAIL_NOT_CONFIGURED"
        );
    }

    const recipient =
        normalizeEmail(to);

    if (!recipient) {
        throw new Error(
            "EMAIL_TO_REQUIRED"
        );
    }

    if (!subject) {
        throw new Error(
            "EMAIL_SUBJECT_REQUIRED"
        );
    }

    if (!body) {
        throw new Error(
            "EMAIL_BODY_REQUIRED"
        );
    }

    const cleanPdfBase64 =
        normalizePdfBase64(pdfBase64);

    const fromName =
        company.emailFromName
            ? String(
                  company.emailFromName
              ).trim()
            : company.name;

    const fromAddress =
        String(
            company.emailFromAddress
        ).trim();

    const from =
        `${fromName} <${fromAddress}>`;

    const ccEmail =
        normalizeEmail(cc);

    const emailPayload = {
        from,

        to: [recipient],

        subject,

        /*
          Your existing frontend currently produces
          plain text, so we use it as HTML safely by
          converting line breaks.
        */
        html: String(body)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>"),

        attachments: [
            {
                filename:
                    `${quotationNumber}.pdf`,

                content: cleanPdfBase64
            }
        ]
    };

    if (ccEmail) {
        emailPayload.cc = [ccEmail];
    }

    const {
        data,
        error
    } = await resend.emails.send(
        emailPayload
    );

    if (error) {
        console.error(
            "Resend email error:",
            error
        );

        const resendError =
            new Error(
                "RESEND_SEND_FAILED"
            );

        resendError.details = error;

        throw resendError;
    }

    if (!data?.id) {
        throw new Error(
            "RESEND_SEND_FAILED"
        );
    }

    return {
        resendEmailId: data.id,

        from,

        to: recipient,

        cc: ccEmail
    };
}

module.exports = {
    sendQuotationEmail
};