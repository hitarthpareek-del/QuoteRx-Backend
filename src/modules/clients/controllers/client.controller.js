const clientService =
    require("../services/client.service");


/*
|--------------------------------------------------------------------------
| Create Client
|--------------------------------------------------------------------------
*/

async function createClient(req, res) {
    try {
        const client =
            await clientService.createClient(
                req.user.id,
                req.body
            );

        return res.status(201).json({
            success: true,
            message: "Client created successfully",
            data: client
        });
    } catch (error) {
        console.error(
            "Create client error:",
            error
        );

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}


/*
|--------------------------------------------------------------------------
| Get Clients
|--------------------------------------------------------------------------
*/

async function getClients(req, res) {
    try {
        const clients =
            await clientService.getClients(
                req.user.id,
                {
                    search:
                        req.query.search,

                    status:
                        req.query.status,

                    companyId:
                        req.query.companyId
                }
            );

        return res.json({
            success: true,
            data: clients
        });
    } catch (error) {
        console.error(
            "Get clients error:",
            error
        );

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}


/*
|--------------------------------------------------------------------------
| Get Client
|--------------------------------------------------------------------------
*/

async function getClientById(req, res) {
    try {
        const client =
            await clientService.getClientById(
                req.user.id,
                req.params.id
            );

        return res.json({
            success: true,
            data: client
        });
    } catch (error) {
        console.error(
            "Get client error:",
            error
        );

        const status =
            error.message.includes(
                "access"
            )
                ? 403
                : 404;

        return res.status(status).json({
            success: false,
            message: error.message
        });
    }
}


/*
|--------------------------------------------------------------------------
| Update Client
|--------------------------------------------------------------------------
*/

async function updateClient(req, res) {
    try {
        const client =
            await clientService.updateClient(
                req.user.id,
                req.params.id,
                req.body
            );

        return res.json({
            success: true,
            message: "Client updated successfully",
            data: client
        });
    } catch (error) {
        console.error(
            "Update client error:",
            error
        );

        const status =
            error.message.includes(
                "access"
            )
                ? 403
                : 400;

        return res.status(status).json({
            success: false,
            message: error.message
        });
    }
}


/*
|--------------------------------------------------------------------------
| Update Client Status
|--------------------------------------------------------------------------
*/

async function updateClientStatus(
    req,
    res
) {
    try {
        const client =
            await clientService.updateClientStatus(
                req.user.id,
                req.params.id,
                req.body.status
            );

        return res.json({
            success: true,
            message:
                "Client status updated successfully",
            data: client
        });
    } catch (error) {
        console.error(
            "Update client status error:",
            error
        );

        const status =
            error.message.includes(
                "access"
            )
                ? 403
                : 400;

        return res.status(status).json({
            success: false,
            message: error.message
        });
    }
}


/*
|--------------------------------------------------------------------------
| Assign Client
|--------------------------------------------------------------------------
*/

async function assignClient(req, res) {
    try {
        const {
            managerId
        } = req.body;

        if (!managerId) {
            return res.status(400).json({
                success: false,
                message:
                    "managerId is required"
            });
        }

        const assignment =
            await clientService.assignClient(
                req.user.id,
                req.params.id,
                managerId
            );

        return res.status(201).json({
            success: true,
            message:
                "Client assigned successfully",
            data: assignment
        });
    } catch (error) {
        console.error(
            "Assign client error:",
            error
        );

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}


/*
|--------------------------------------------------------------------------
| Assign Client To All Managers
|--------------------------------------------------------------------------
*/

async function assignClientToAllManagers(
    req,
    res
) {
    try {
        const result =
            await clientService.assignClientToAllManagers(
                req.user.id,
                req.params.id
            );

        return res.status(201).json({
            success: true,
            message:
                "Client assigned to all managers successfully",
            data: result
        });
    } catch (error) {
        console.error(
            "Assign client to all managers error:",
            error
        );

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}


/*
|--------------------------------------------------------------------------
| Get Assignments
|--------------------------------------------------------------------------
*/

async function getClientAssignments(
    req,
    res
) {
    try {
        const assignments =
            await clientService.getClientAssignments(
                req.user.id,
                req.params.id
            );

        return res.json({
            success: true,
            data: assignments
        });
    } catch (error) {
        console.error(
            "Get assignments error:",
            error
        );

        const status =
            error.message.includes(
                "access"
            )
                ? 403
                : 400;

        return res.status(status).json({
            success: false,
            message: error.message
        });
    }
}


/*
|--------------------------------------------------------------------------
| Remove Assignment
|--------------------------------------------------------------------------
*/

async function removeClientAssignment(
    req,
    res
) {
    try {
        await clientService.removeClientAssignment(
            req.user.id,
            req.params.id,
            req.params.assignmentId
        );

        return res.json({
            success: true,
            message:
                "Client assignment removed successfully"
        });
    } catch (error) {
        console.error(
            "Remove assignment error:",
            error
        );

        const status =
            error.message.includes(
                "access"
            )
                ? 403
                : 400;

        return res.status(status).json({
            success: false,
            message: error.message
        });
    }
}


/*
|--------------------------------------------------------------------------
| Add Contact
|--------------------------------------------------------------------------
*/

async function addContact(req, res) {
    try {
        const contact =
            await clientService.addContact(
                req.user.id,
                req.params.clientId,
                req.body
            );

        return res.status(201).json({
            success: true,
            message:
                "Client contact added successfully",
            data: contact
        });
    } catch (error) {
        console.error(
            "Add contact error:",
            error
        );

        const status =
            error.message.includes(
                "access"
            )
                ? 403
                : 400;

        return res.status(status).json({
            success: false,
            message: error.message
        });
    }
}


/*
|--------------------------------------------------------------------------
| Update Contact
|--------------------------------------------------------------------------
*/

async function updateContact(req, res) {
    try {
        const contact =
            await clientService.updateContact(
                req.user.id,
                req.params.clientId,
                req.params.contactId,
                req.body
            );

        return res.json({
            success: true,
            message:
                "Client contact updated successfully",
            data: contact
        });
    } catch (error) {
        console.error(
            "Update contact error:",
            error
        );

        const status =
            error.message.includes(
                "access"
            )
                ? 403
                : 400;

        return res.status(status).json({
            success: false,
            message: error.message
        });
    }
}


/*
|--------------------------------------------------------------------------
| Delete Contact
|--------------------------------------------------------------------------
*/

async function deleteContact(req, res) {
    try {
        await clientService.deleteContact(
            req.user.id,
            req.params.clientId,
            req.params.contactId
        );

        return res.json({
            success: true,
            message:
                "Client contact deleted successfully"
        });
    } catch (error) {
        console.error(
            "Delete contact error:",
            error
        );

        const status =
            error.message.includes(
                "access"
            )
                ? 403
                : 400;

        return res.status(status).json({
            success: false,
            message: error.message
        });
    }
}


module.exports = {
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
};