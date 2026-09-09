const express = require("express");

const {
    authenticate
} = require("../../../middleware/auth.middleware");

const {
    requireRole
} = require("../../../middleware/role.middleware");

const {
    createCompany,
    getCompanies,
    getCompanyById,
    updateCompany,
    updateCompanyStatus
} = require("../controllers/company.controller");

const router = express.Router();


router.get(
    "/",
    authenticate,
    requireRole("SUPERADMIN"),
    getCompanies
);


router.post(
    "/",
    authenticate,
    requireRole("SUPERADMIN"),
    createCompany
);


router.patch(
    "/:id/status",
    authenticate,
    requireRole("SUPERADMIN"),
    updateCompanyStatus
);


router.get(
    "/:id",
    authenticate,
    requireRole("SUPERADMIN"),
    getCompanyById
);


router.patch(
    "/:id",
    authenticate,
    requireRole("SUPERADMIN"),
    updateCompany
);


module.exports = router;