const express = require("express");

const {
    authenticate
} = require("../../../middleware/auth.middleware");

const {
    sendQuotation,
    getQuotations,
    getQuotationById,
    createQuotationVersion,
    markQuotationSuccessful,
    markQuotationLost,
    expireQuotation,
    resendQuotation,
    updateQuotationPO
} = require("../controllers/quotation.controller");

const router = express.Router();

router.get(
    "/",
    authenticate,
    getQuotations
);

router.post(
    "/send",
    authenticate,
    sendQuotation
);

router.patch(
    "/:id/po",
    authenticate,
    updateQuotationPO
);

router.post(
    "/:id/resend",
    authenticate,
    resendQuotation
);

router.post(
    "/:id/version",
    authenticate,
    (req, res, next) => {
        req.body.quotationId =
            req.params.id;

        next();
    },
    createQuotationVersion
);

router.patch(
    "/:id/successful",
    authenticate,
    markQuotationSuccessful
);

router.patch(
    "/:id/lost",
    authenticate,
    markQuotationLost
);

router.patch(
    "/:id/expired",
    authenticate,
    expireQuotation
);

router.get(
    "/:id",
    authenticate,
    getQuotationById
);

module.exports = router;