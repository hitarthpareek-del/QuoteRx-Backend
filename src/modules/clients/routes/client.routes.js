const express = require("express");

const {
    authenticate
} = require("../../../middleware/auth.middleware");

const {
    requireRole
} = require("../../../middleware/role.middleware");

const {
    createClient,
    getClients,
    getClientById,
    updateClient,
    updateClientStatus,

    assignClient,
    assignClientToAllManagers,
    getClientAssignments,
    removeClientAssignment,

    addContact,
    updateContact,
    deleteContact
} = require("../controllers/client.controller");


const router = express.Router();


/*
|--------------------------------------------------------------------------
| All client routes require authentication
|--------------------------------------------------------------------------
*/

router.use(authenticate);


/*
|--------------------------------------------------------------------------
| Clients
|--------------------------------------------------------------------------
*/

/*
GET /api/clients
*/
router.get(
    "/",
    requireRole(
        "SUPERADMIN",
        "ADMIN",
        "MANAGER",
        "EMPLOYEE"
    ),
    getClients
);


/*
POST /api/clients
*/
router.post(
    "/",
    requireRole(
        "SUPERADMIN",
        "ADMIN",
        "MANAGER",
        "EMPLOYEE"
    ),
    createClient
);


/*
GET /api/clients/:id
*/
router.get(
    "/:id",
    requireRole(
        "SUPERADMIN",
        "ADMIN",
        "MANAGER",
        "EMPLOYEE"
    ),
    getClientById
);


/*
PATCH /api/clients/:id
*/
router.patch(
    "/:id",
    requireRole(
        "SUPERADMIN",
        "ADMIN",
        "MANAGER",
        "EMPLOYEE"
    ),
    updateClient
);


/*
PATCH /api/clients/:id/status
*/
router.patch(
    "/:id/status",
    requireRole(
        "SUPERADMIN",
        "ADMIN",
        "MANAGER",
        "EMPLOYEE"
    ),
    updateClientStatus
);


/*
|--------------------------------------------------------------------------
| Client Assignments
|--------------------------------------------------------------------------
*/

/*
POST /api/clients/:id/assign
*/
router.post(
    "/:id/assign",
    requireRole(
        "SUPERADMIN",
        "ADMIN"
    ),
    assignClient
);


/*
POST /api/clients/:id/assign-all
*/
router.post(
    "/:id/assign-all",
    requireRole(
        "SUPERADMIN",
        "ADMIN"
    ),
    assignClientToAllManagers
);


/*
GET /api/clients/:id/assignments
*/
router.get(
    "/:id/assignments",
    requireRole(
        "SUPERADMIN",
        "ADMIN",
        "MANAGER",
        "EMPLOYEE"
    ),
    getClientAssignments
);


/*
DELETE /api/clients/:id/assignments/:assignmentId
*/
router.delete(
    "/:id/assignments/:assignmentId",
    requireRole(
        "SUPERADMIN",
        "ADMIN"
    ),
    removeClientAssignment
);


/*
|--------------------------------------------------------------------------
| Client Contacts
|--------------------------------------------------------------------------
*/

/*
POST /api/clients/:clientId/contacts
*/
router.post(
    "/:clientId/contacts",
    requireRole(
        "SUPERADMIN",
        "ADMIN",
        "MANAGER",
        "EMPLOYEE"
    ),
    addContact
);


/*
PATCH /api/clients/:clientId/contacts/:contactId
*/
router.patch(
    "/:clientId/contacts/:contactId",
    requireRole(
        "SUPERADMIN",
        "ADMIN",
        "MANAGER",
        "EMPLOYEE"
    ),
    updateContact
);


/*
DELETE /api/clients/:clientId/contacts/:contactId
*/
router.delete(
    "/:clientId/contacts/:contactId",
    requireRole(
        "SUPERADMIN",
        "ADMIN",
        "MANAGER",
        "EMPLOYEE"
    ),
    deleteContact
);


module.exports = router;