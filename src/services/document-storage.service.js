const {
    createClient
} = require("@supabase/supabase-js");


function getSupabaseClient() {
    const supabaseUrl =
        process.env.SUPABASE_URL;

    const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
        !supabaseUrl ||
        !serviceRoleKey
    ) {
        throw new Error(
            "SUPABASE_STORAGE_NOT_CONFIGURED"
        );
    }

    return createClient(
        supabaseUrl,
        serviceRoleKey,
        {
            auth: {
                autoRefreshToken:
                    false,

                persistSession:
                    false
            }
        }
    );
}


function normalizePathPart(
    value
) {
    return String(
        value || ""
    )
        .trim()
        .replace(
            /[^a-zA-Z0-9._-]/g,
            "-"
        );
}


function pdfBase64ToBuffer(
    pdfBase64
) {
    let value =
        String(
            pdfBase64 || ""
        ).trim();

    if (
        value.includes(
            "base64,"
        )
    ) {
        value =
            value.split(
                "base64,"
            )[1];
    }

    const buffer =
        Buffer.from(
            value,
            "base64"
        );

    if (
        !buffer.length
    ) {
        throw new Error(
            "PDF_BASE64_INVALID"
        );
    }

    return buffer;
}


/*
  Same storage path is intentionally used
  for every quotation version.

  Example:

  quotations/
    Akar-Limited/
      Hitarth/
        AK-QTS-HP-001-2026/
          AK-QTS-HP-001-2026.pdf

  Version 2 overwrites the same PDF.
*/
function buildQuotationDocumentPath({
    companyName,
    employeeName,
    quotationNumber
}) {
    const company =
        normalizePathPart(
            companyName
        );

    const employee =
        normalizePathPart(
            employeeName
        );

    const quotation =
        normalizePathPart(
            quotationNumber
        );

    return [
        "quotations",
        company,
        employee,
        quotation,
        `${quotation}.pdf`
    ].join("/");
}


function buildDocumentUrl(
    path
) {
    const supabaseUrl =
        process.env.SUPABASE_URL;

    const bucket =
        process.env.SUPABASE_QUOTATION_BUCKET;

    return (
        `${supabaseUrl}/storage/v1/object/` +
        `${bucket}/${path}`
    );
}


async function uploadQuotationPdf({
    companyName,
    employeeName,
    quotationNumber,
    pdfBase64
}) {
    if (!pdfBase64) {
        throw new Error(
            "PDF_REQUIRED"
        );
    }

    const bucket =
        process.env.SUPABASE_QUOTATION_BUCKET;

    if (!bucket) {
        throw new Error(
            "SUPABASE_QUOTATION_BUCKET_NOT_CONFIGURED"
        );
    }

    const supabase =
        getSupabaseClient();

    const path =
        buildQuotationDocumentPath({
            companyName,
            employeeName,
            quotationNumber
        });

    const pdfBuffer =
        pdfBase64ToBuffer(
            pdfBase64
        );

    const {
        error
    } =
        await supabase.storage
            .from(bucket)
            .upload(
                path,
                pdfBuffer,
                {
                    contentType:
                        "application/pdf",

                    /*
                      IMPORTANT:
                      Every new quotation version
                      overwrites the previous PDF.
                    */
                    upsert:
                        true,

                    cacheControl:
                        "3600"
                }
            );

    if (error) {
        console.error(
            "[Supabase Storage] Upload error:",
            error
        );

        throw new Error(
            "DOCUMENT_UPLOAD_FAILED"
        );
    }

    return {
        path,

        url:
            buildDocumentUrl(
                path
            )
    };
}


/*
  Creates a temporary signed URL for
  a private Supabase Storage object.
*/
async function createSignedDocumentUrl(
    documentUrl,
    expiresIn = 3600
) {
    if (!documentUrl) {
        throw new Error(
            "DOCUMENT_URL_REQUIRED"
        );
    }

    const supabaseUrl =
        process.env.SUPABASE_URL;

    const bucket =
        process.env.SUPABASE_QUOTATION_BUCKET;

    const prefix =
        `${supabaseUrl}/storage/v1/object/${bucket}/`;

    if (
        !documentUrl.startsWith(
            prefix
        )
    ) {
        throw new Error(
            "INVALID_DOCUMENT_URL"
        );
    }

    const path =
        documentUrl.substring(
            prefix.length
        );

    const supabase =
        getSupabaseClient();

    const {
        data,
        error
    } =
        await supabase.storage
            .from(bucket)
            .createSignedUrl(
                path,
                expiresIn
            );

    if (error) {
        console.error(
            "[Supabase Storage] Signed URL error:",
            error
        );

        throw new Error(
            "DOCUMENT_SIGNED_URL_FAILED"
        );
    }

    return data.signedUrl;
}


/*
  Used later by the follow-up scheduler
  to retrieve the latest PDF.
*/
async function downloadDocumentByUrl(
    documentUrl
) {
    const signedUrl =
        await createSignedDocumentUrl(
            documentUrl,
            3600
        );

    const response =
        await fetch(
            signedUrl
        );

    if (!response.ok) {
        throw new Error(
            "DOCUMENT_DOWNLOAD_FAILED"
        );
    }

    const arrayBuffer =
        await response.arrayBuffer();

    return Buffer
        .from(
            arrayBuffer
        )
        .toString(
            "base64"
        );
}


module.exports = {
    uploadQuotationPdf,
    createSignedDocumentUrl,
    downloadDocumentByUrl
};