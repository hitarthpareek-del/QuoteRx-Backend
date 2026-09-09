const express = require("express");

const {
    authenticate
} = require("../../../middleware/auth.middleware");

const {
    requireRole
} = require("../../../middleware/role.middleware");

const {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    updateUserStatus,
    getAdminsByCompany,
    getManagersByAdmin,
    getEmployees,
    getMyManagers,
    getMyEmployees
} = require("../controllers/user.controller");

const router = express.Router();


// =====================================================
// SUPERADMIN APIs
// =====================================================

router.get(
    "/",
    authenticate,
    requireRole("SUPERADMIN"),
    getUsers
);

router.get(
    "/admins",
    authenticate,
    requireRole("SUPERADMIN"),
    getAdminsByCompany
);

router.get(
    "/managers",
    authenticate,
    requireRole("SUPERADMIN"),
    getManagersByAdmin
);

router.get(
    "/employees",
    authenticate,
    requireRole("SUPERADMIN"),
    getEmployees
);


// =====================================================
// ADMIN APIs
// =====================================================

// Logged-in admin's managers
router.get(
    "/my-managers",
    authenticate,
    requireRole("ADMIN"),
    getMyManagers
);


// =====================================================
// ADMIN + MANAGER APIs
// =====================================================

// Admin → all employees under that admin
// Manager → all employees under that manager
router.get(
    "/my-employees",
    authenticate,
    requireRole("ADMIN", "MANAGER"),
    getMyEmployees
);


// =====================================================
// SUPERADMIN USER MANAGEMENT
// =====================================================

router.patch(
    "/:id/status",
    authenticate,
    requireRole("SUPERADMIN"),
    updateUserStatus
);

router.get(
    "/:id",
    authenticate,
    requireRole("SUPERADMIN"),
    getUserById
);

router.patch(
    "/:id",
    authenticate,
    requireRole("SUPERADMIN"),
    updateUser
);

router.post(
    "/",
    authenticate,
    requireRole("SUPERADMIN"),
    createUser
);


module.exports = router;