function normalizePrefix(value) {
    if (!value) {
        return "";
    }

    return String(value)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
}

function buildQuotationNumber({
    companyPrefix,
    userPrefix,
    sequence,
    year
}) {
    const normalizedCompanyPrefix =
        normalizePrefix(companyPrefix);

    const normalizedUserPrefix =
        normalizePrefix(userPrefix);

    if (!normalizedCompanyPrefix) {
        throw new Error(
            "COMPANY_QUOTATION_PREFIX_REQUIRED"
        );
    }

    if (!normalizedUserPrefix) {
        throw new Error(
            "USER_QUOTATION_PREFIX_REQUIRED"
        );
    }

    if (
        !Number.isInteger(sequence) ||
        sequence < 1
    ) {
        throw new Error(
            "INVALID_QUOTATION_SEQUENCE"
        );
    }

    if (
        !Number.isInteger(year) ||
        year < 2000
    ) {
        throw new Error(
            "INVALID_QUOTATION_YEAR"
        );
    }

    const paddedSequence =
        String(sequence).padStart(3, "0");

    return `${normalizedCompanyPrefix}-QTS-${normalizedUserPrefix}-${paddedSequence}-${year}`;
}

module.exports = {
    normalizePrefix,
    buildQuotationNumber
};