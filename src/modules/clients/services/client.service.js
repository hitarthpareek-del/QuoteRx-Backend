const prisma = require("../../../lib/prisma");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

async function getActiveUser(userId) {
    const user = await prisma.user.findUnique({
        where: {
            id: userId
        }
    });

    if (!user) {
        throw new Error("User not found");
    }

    if (
        user.status === "DEACTIVATED" ||
        user.status === "SUSPENDED"
    ) {
        throw new Error("User account is not active");
    }

    return user;
}


async function validateCompany(companyId) {
    if (!companyId) {
        throw new Error("Company is required");
    }

    const company = await prisma.company.findUnique({
        where: {
            id: companyId
        }
    });

    if (!company) {
        throw new Error("Company not found");
    }

    if (company.status !== "ACTIVE") {
        throw new Error("Company is inactive");
    }

    return company;
}


async function validateManager(managerId) {
    const manager = await prisma.user.findUnique({
        where: {
            id: managerId
        }
    });

    if (!manager) {
        throw new Error("Manager not found");
    }

    if (manager.role !== "MANAGER") {
        throw new Error("Selected user is not a manager");
    }

    if (
        manager.status === "DEACTIVATED" ||
        manager.status === "SUSPENDED"
    ) {
        throw new Error("Manager is not active");
    }

    if (!manager.companyId) {
        throw new Error("Manager is not assigned to a company");
    }

    return manager;
}


async function validateManagerForAdmin(
    managerId,
    adminId,
    companyId
) {
    const manager = await validateManager(managerId);

    if (manager.companyId !== companyId) {
        throw new Error(
            "Manager does not belong to this company"
        );
    }

    if (manager.adminId !== adminId) {
        throw new Error(
            "Manager does not belong to this admin"
        );
    }

    return manager;
}


async function validateManagerForSuperadmin(
    managerId,
    companyId
) {
    const manager = await validateManager(managerId);

    if (manager.companyId !== companyId) {
        throw new Error(
            "Manager does not belong to this company"
        );
    }

    return manager;
}


/*
|--------------------------------------------------------------------------
| Contacts
|--------------------------------------------------------------------------
*/

function normalizeContact(contact) {
    if (!contact) {
        return null;
    }

    const name =
        typeof contact.name === "string"
            ? contact.name.trim()
            : "";

    const phone =
        typeof contact.phone === "string"
            ? contact.phone.trim()
            : null;

    const email =
        typeof contact.email === "string"
            ? contact.email.trim().toLowerCase()
            : null;

    if (!name) {
        throw new Error(
            "Contact name is required"
        );
    }

    return {
        name,
        phone: phone || null,
        email: email || null
    };
}


function normalizeContacts(contacts) {
    if (contacts === undefined) {
        return [];
    }

    if (!Array.isArray(contacts)) {
        throw new Error(
            "Contacts must be an array"
        );
    }

    return contacts.map(normalizeContact);
}


/*
|--------------------------------------------------------------------------
| Audit Log
|--------------------------------------------------------------------------
*/

async function createAuditLog(
    tx,
    userId,
    action,
    entity,
    entityId,
    metadata = {}
) {
    if (!tx.auditLog) {
        return;
    }

    await tx.auditLog.create({
        data: {
            userId,
            action,
            entity,
            entityId,
            metadata
        }
    });
}


/*
|--------------------------------------------------------------------------
| Visibility
|--------------------------------------------------------------------------
|
| SUPERADMIN
|   -> Everything
|
| ADMIN
|   -> Own clients
|   -> Clients assigned to managers under this admin
|
| MANAGER
|   -> Clients assigned to this manager
|
| EMPLOYEE
|   -> Clients assigned to their manager
|
|--------------------------------------------------------------------------
*/

function getVisibilityWhere(user) {
    if (user.role === "SUPERADMIN") {
        return {};
    }

    if (user.role === "ADMIN") {
        return {
            OR: [
                {
                    createdByUserId: user.id
                },
                {
                    assignments: {
                        some: {
                            manager: {
                                adminId: user.id
                            }
                        }
                    }
                }
            ]
        };
    }

    if (user.role === "MANAGER") {
        return {
            assignments: {
                some: {
                    managerId: user.id
                }
            }
        };
    }

    if (user.role === "EMPLOYEE") {
        if (!user.managerId) {
            return {
                id: "__NO_CLIENT_ACCESS__"
            };
        }

        return {
            assignments: {
                some: {
                    managerId: user.managerId
                }
            }
        };
    }

    return {
        id: "__NO_CLIENT_ACCESS__"
    };
}


async function canAccessClient(
    user,
    clientId
) {
    const where = {
        id: clientId,
        ...getVisibilityWhere(user)
    };

    const client = await prisma.client.findFirst({
        where
    });

    return !!client;
}


/*
|--------------------------------------------------------------------------
| Create Client
|--------------------------------------------------------------------------
*/

async function createClient(
    userId,
    data
) {
    const user = await getActiveUser(userId);

    const {
        companyId,
        companyName,
        companyAddress,
        contacts = [],
        managerId,
        assignToAllManagers = false
    } = data;

    /*
    |--------------------------------------------------------------------------
    | Determine company
    |--------------------------------------------------------------------------
    */

    let finalCompanyId = companyId;

    if (user.role !== "SUPERADMIN") {
        if (!user.companyId) {
            throw new Error(
                "User is not assigned to a company"
            );
        }

        finalCompanyId = user.companyId;
    }

    const company =
        await validateCompany(finalCompanyId);

    /*
    |--------------------------------------------------------------------------
    | Validate client name
    |--------------------------------------------------------------------------
    */

    if (
        !companyName ||
        typeof companyName !== "string" ||
        !companyName.trim()
    ) {
        throw new Error(
            "Client company name is required"
        );
    }

    const normalizedContacts =
        normalizeContacts(contacts);

    /*
    |--------------------------------------------------------------------------
    | Determine assignments
    |--------------------------------------------------------------------------
    */

    const managerIds = [];

    /*
    |--------------------------------------------------------------------------
    | EMPLOYEE
    |--------------------------------------------------------------------------
    */

    if (user.role === "EMPLOYEE") {
        if (!user.managerId) {
            throw new Error(
                "Employee is not assigned to a manager"
            );
        }

        const manager =
            await validateManager(
                user.managerId
            );

        if (
            manager.companyId !==
            finalCompanyId
        ) {
            throw new Error(
                "Employee manager does not belong to this company"
            );
        }

        managerIds.push(manager.id);
    }

    /*
    |--------------------------------------------------------------------------
    | MANAGER
    |--------------------------------------------------------------------------
    */

    if (user.role === "MANAGER") {
        managerIds.push(user.id);
    }

    /*
    |--------------------------------------------------------------------------
    | ADMIN
    |--------------------------------------------------------------------------
    */

    if (user.role === "ADMIN") {
        if (managerId) {
            await validateManagerForAdmin(
                managerId,
                user.id,
                finalCompanyId
            );

            managerIds.push(managerId);
        }

        if (assignToAllManagers) {
            const managers =
                await prisma.user.findMany({
                    where: {
                        role: "MANAGER",
                        status: "ACTIVE",
                        companyId: finalCompanyId,
                        adminId: user.id
                    },
                    select: {
                        id: true
                    }
                });

            managers.forEach((manager) => {
                if (
                    !managerIds.includes(
                        manager.id
                    )
                ) {
                    managerIds.push(manager.id);
                }
            });
        }
    }

    /*
    |--------------------------------------------------------------------------
    | SUPERADMIN
    |--------------------------------------------------------------------------
    */

    if (user.role === "SUPERADMIN") {
        if (managerId) {
            await validateManagerForSuperadmin(
                managerId,
                finalCompanyId
            );

            managerIds.push(managerId);
        }

        if (assignToAllManagers) {
            const managers =
                await prisma.user.findMany({
                    where: {
                        role: "MANAGER",
                        status: "ACTIVE",
                        companyId: finalCompanyId
                    },
                    select: {
                        id: true
                    }
                });

            managers.forEach((manager) => {
                if (
                    !managerIds.includes(
                        manager.id
                    )
                ) {
                    managerIds.push(manager.id);
                }
            });
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Create Client
    |--------------------------------------------------------------------------
    */

    const client =
        await prisma.$transaction(
            async (tx) => {
                const createdClient =
                    await tx.client.create({
                        data: {
                            companyId:
                                company.id,

                            companyName:
                                companyName.trim(),

                            companyAddress:
                                companyAddress
                                    ? companyAddress.trim()
                                    : null,

                            createdByUserId:
                                user.id,

                            contacts:
                                normalizedContacts.length
                                    ? {
                                          create:
                                              normalizedContacts
                                      }
                                    : undefined,

                            assignments:
                                managerIds.length
                                    ? {
                                          create: managerIds.map(
                                              (
                                                  currentManagerId
                                              ) => ({
                                                  managerId:
                                                      currentManagerId,

                                                  assignedById:
                                                      user.id
                                              })
                                          )
                                      }
                                    : undefined
                        },

                        include: {
                            company: true,

                            contacts: true,

                            assignments: {
                                include: {
                                    manager: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                            role: true
                                        }
                                    },

                                    assignedBy: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true
                                        }
                                    }
                                }
                            },

                            createdBy: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    role: true
                                }
                            }
                        }
                    });

                await createAuditLog(
                    tx,
                    user.id,
                    "CLIENT_CREATED",
                    "Client",
                    createdClient.id,
                    {
                        companyId:
                            createdClient.companyId,

                        companyName:
                            createdClient.companyName,

                        managerIds
                    }
                );

                return createdClient;
            }
        );

    return client;
}


/*
|--------------------------------------------------------------------------
| Get Clients
|--------------------------------------------------------------------------
*/

async function getClients(
    userId,
    filters = {}
) {
    const user =
        await getActiveUser(userId);

    const {
        search,
        status,
        companyId
    } = filters;

    const visibilityWhere =
        getVisibilityWhere(user);

    const where = {
        AND: [
            visibilityWhere
        ]
    };

    if (status) {
        where.AND.push({
            status
        });
    }

    if (search) {
        where.AND.push({
            OR: [
                {
                    companyName: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    companyAddress: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    contacts: {
                        some: {
                            OR: [
                                {
                                    name: {
                                        contains:
                                            search,
                                        mode: "insensitive"
                                    }
                                },
                                {
                                    email: {
                                        contains:
                                            search,
                                        mode: "insensitive"
                                    }
                                },
                                {
                                    phone: {
                                        contains:
                                            search,
                                        mode: "insensitive"
                                    }
                                }
                            ]
                        }
                    }
                }
            ]
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Company filtering
    |--------------------------------------------------------------------------
    */

    if (companyId) {
        if (user.role !== "SUPERADMIN") {
            if (
                user.companyId !==
                companyId
            ) {
                throw new Error(
                    "You do not have access to this company"
                );
            }
        }

        where.AND.push({
            companyId
        });
    }

    const clients =
        await prisma.client.findMany({
            where,

            orderBy: {
                createdAt: "desc"
            },

            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                        logoUrl: true
                    }
                },

                contacts: true,

                assignments: {
                    include: {
                        manager: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                },

                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                }
            }
        });

    return clients;
}


/*
|--------------------------------------------------------------------------
| Get Client By ID
|--------------------------------------------------------------------------
*/

async function getClientById(
    userId,
    clientId
) {
    const user =
        await getActiveUser(userId);

    const hasAccess =
        await canAccessClient(
            user,
            clientId
        );

    if (!hasAccess) {
        throw new Error(
            "You do not have access to this client"
        );
    }

    const client =
        await prisma.client.findUnique({
            where: {
                id: clientId
            },

            include: {
                company: true,

                contacts: {
                    orderBy: {
                        createdAt: "asc"
                    }
                },

                assignments: {
                    orderBy: {
                        createdAt: "asc"
                    },

                    include: {
                        manager: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true
                            }
                        },

                        assignedBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true
                            }
                        }
                    }
                },

                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                }
            }
        });

    if (!client) {
        throw new Error(
            "Client not found"
        );
    }

    return client;
}


/*
|--------------------------------------------------------------------------
| Update Client
|--------------------------------------------------------------------------
*/

async function updateClient(
    userId,
    clientId,
    data
) {
    const user =
        await getActiveUser(userId);

    const hasAccess =
        await canAccessClient(
            user,
            clientId
        );

    if (!hasAccess) {
        throw new Error(
            "You do not have access to this client"
        );
    }

    const {
        companyName,
        companyAddress
    } = data;

    const updateData = {};

    if (companyName !== undefined) {
        if (
            typeof companyName !== "string" ||
            !companyName.trim()
        ) {
            throw new Error(
                "Client company name is required"
            );
        }

        updateData.companyName =
            companyName.trim();
    }

    if (companyAddress !== undefined) {
        updateData.companyAddress =
            companyAddress
                ? companyAddress.trim()
                : null;
    }

    if (
        Object.keys(updateData).length === 0
    ) {
        throw new Error(
            "No client details to update"
        );
    }

    const client =
        await prisma.$transaction(
            async (tx) => {
                const updatedClient =
                    await tx.client.update({
                        where: {
                            id: clientId
                        },

                        data: updateData,

                        include: {
                            company: true,
                            contacts: true,

                            assignments: {
                                include: {
                                    manager: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true
                                        }
                                    }
                                }
                            },

                            createdBy: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    role: true
                                }
                            }
                        }
                    });

                await createAuditLog(
                    tx,
                    user.id,
                    "CLIENT_UPDATED",
                    "Client",
                    clientId,
                    updateData
                );

                return updatedClient;
            }
        );

    return client;
}


/*
|--------------------------------------------------------------------------
| Update Client Status
|--------------------------------------------------------------------------
*/

async function updateClientStatus(
    userId,
    clientId,
    status
) {
    const user =
        await getActiveUser(userId);

    const hasAccess =
        await canAccessClient(
            user,
            clientId
        );

    if (!hasAccess) {
        throw new Error(
            "You do not have access to this client"
        );
    }

    if (
        status !== "ACTIVE" &&
        status !== "INACTIVE"
    ) {
        throw new Error(
            "Invalid client status"
        );
    }

    const client =
        await prisma.$transaction(
            async (tx) => {
                const updatedClient =
                    await tx.client.update({
                        where: {
                            id: clientId
                        },

                        data: {
                            status
                        },

                        include: {
                            company: true,
                            contacts: true,
                            assignments: {
                                include: {
                                    manager: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true
                                        }
                                    }
                                }
                            }
                        }
                    });

                await createAuditLog(
                    tx,
                    user.id,
                    "CLIENT_STATUS_UPDATED",
                    "Client",
                    clientId,
                    {
                        status
                    }
                );

                return updatedClient;
            }
        );

    return client;
}


/*
|--------------------------------------------------------------------------
| Assign Client To One Manager
|--------------------------------------------------------------------------
*/

async function assignClient(
    userId,
    clientId,
    managerId
) {
    const user =
        await getActiveUser(userId);

    if (
        user.role !== "ADMIN" &&
        user.role !== "SUPERADMIN"
    ) {
        throw new Error(
            "Only admin or superadmin can assign clients"
        );
    }

    const client =
        await prisma.client.findUnique({
            where: {
                id: clientId
            }
        });

    if (!client) {
        throw new Error(
            "Client not found"
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Assignment access
    |--------------------------------------------------------------------------
    */

    if (user.role === "ADMIN") {
        if (
            client.companyId !==
            user.companyId
        ) {
            throw new Error(
                "Client does not belong to your company"
            );
        }

        /*
        Admin must be able to manage this client.
        Own clients or clients already visible to admin.
        */

        const hasAccess =
            await canAccessClient(
                user,
                clientId
            );

        if (!hasAccess) {
            throw new Error(
                "You do not have access to this client"
            );
        }

        await validateManagerForAdmin(
            managerId,
            user.id,
            client.companyId
        );
    }

    if (user.role === "SUPERADMIN") {
        await validateManagerForSuperadmin(
            managerId,
            client.companyId
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Create assignment
    |--------------------------------------------------------------------------
    */

    const assignment =
        await prisma.$transaction(
            async (tx) => {
                const existing =
                    await tx.clientAssignment.findUnique(
                        {
                            where: {
                                clientId_managerId: {
                                    clientId,
                                    managerId
                                }
                            }
                        }
                    );

                if (existing) {
                    throw new Error(
                        "Client is already assigned to this manager"
                    );
                }

                const created =
                    await tx.clientAssignment.create(
                        {
                            data: {
                                clientId,
                                managerId,
                                assignedById:
                                    user.id
                            },

                            include: {
                                manager: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        role: true
                                    }
                                },

                                assignedBy: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        role: true
                                    }
                                }
                            }
                        }
                    );

                await createAuditLog(
                    tx,
                    user.id,
                    "CLIENT_ASSIGNED",
                    "Client",
                    clientId,
                    {
                        managerId
                    }
                );

                return created;
            }
        );

    return assignment;
}


/*
|--------------------------------------------------------------------------
| Assign Client To All Managers
|--------------------------------------------------------------------------
*/

async function assignClientToAllManagers(
    userId,
    clientId
) {
    const user =
        await getActiveUser(userId);

    if (
        user.role !== "ADMIN" &&
        user.role !== "SUPERADMIN"
    ) {
        throw new Error(
            "Only admin or superadmin can assign clients"
        );
    }

    const client =
        await prisma.client.findUnique({
            where: {
                id: clientId
            }
        });

    if (!client) {
        throw new Error(
            "Client not found"
        );
    }

    if (user.role === "ADMIN") {
        if (
            client.companyId !==
            user.companyId
        ) {
            throw new Error(
                "Client does not belong to your company"
            );
        }

        const hasAccess =
            await canAccessClient(
                user,
                clientId
            );

        if (!hasAccess) {
            throw new Error(
                "You do not have access to this client"
            );
        }
    }

    const managerWhere = {
        role: "MANAGER",
        status: "ACTIVE",
        companyId: client.companyId
    };

    if (user.role === "ADMIN") {
        managerWhere.adminId = user.id;
    }

    const managers =
        await prisma.user.findMany({
            where: managerWhere,

            select: {
                id: true
            }
        });

    if (!managers.length) {
        throw new Error(
            "No active managers found"
        );
    }

    const result =
        await prisma.$transaction(
            async (tx) => {
                let createdCount = 0;

                for (const manager of managers) {
                    const existing =
                        await tx.clientAssignment.findUnique(
                            {
                                where: {
                                    clientId_managerId: {
                                        clientId,
                                        managerId:
                                            manager.id
                                    }
                                }
                            }
                        );

                    if (!existing) {
                        await tx.clientAssignment.create(
                            {
                                data: {
                                    clientId,
                                    managerId:
                                        manager.id,
                                    assignedById:
                                        user.id
                                }
                            }
                        );

                        createdCount++;
                    }
                }

                await createAuditLog(
                    tx,
                    user.id,
                    "CLIENT_ASSIGNED_TO_ALL_MANAGERS",
                    "Client",
                    clientId,
                    {
                        managerCount:
                            managers.length,

                        newAssignments:
                            createdCount
                    }
                );

                return {
                    clientId,
                    managerCount:
                        managers.length,
                    newAssignments:
                        createdCount
                };
            }
        );

    return result;
}


/*
|--------------------------------------------------------------------------
| Get Client Assignments
|--------------------------------------------------------------------------
*/

async function getClientAssignments(
    userId,
    clientId
) {
    const user =
        await getActiveUser(userId);

    const hasAccess =
        await canAccessClient(
            user,
            clientId
        );

    if (!hasAccess) {
        throw new Error(
            "You do not have access to this client"
        );
    }

    return prisma.clientAssignment.findMany(
        {
            where: {
                clientId
            },

            orderBy: {
                createdAt: "asc"
            },

            include: {
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        companyId: true,
                        adminId: true
                    }
                },

                assignedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                }
            }
        }
    );
}


/*
|--------------------------------------------------------------------------
| Remove Client Assignment
|--------------------------------------------------------------------------
*/

async function removeClientAssignment(
    userId,
    clientId,
    assignmentId
) {
    const user =
        await getActiveUser(userId);

    if (
        user.role !== "ADMIN" &&
        user.role !== "SUPERADMIN"
    ) {
        throw new Error(
            "Only admin or superadmin can remove assignments"
        );
    }

    const assignment =
        await prisma.clientAssignment.findUnique(
            {
                where: {
                    id: assignmentId
                },

                include: {
                    client: true,
                    manager: true
                }
            }
        );

    if (!assignment) {
        throw new Error(
            "Assignment not found"
        );
    }

    if (
        assignment.clientId !==
        clientId
    ) {
        throw new Error(
            "Assignment does not belong to this client"
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Admin validation
    |--------------------------------------------------------------------------
    */

    if (user.role === "ADMIN") {
        if (
            assignment.client.companyId !==
            user.companyId
        ) {
            throw new Error(
                "You do not have access to this client"
            );
        }

        if (
            assignment.manager.adminId !==
            user.id
        ) {
            throw new Error(
                "Manager does not belong to this admin"
            );
        }
    }

    const deleted =
        await prisma.$transaction(
            async (tx) => {
                const result =
                    await tx.clientAssignment.delete(
                        {
                            where: {
                                id: assignmentId
                            }
                        }
                    );

                await createAuditLog(
                    tx,
                    user.id,
                    "CLIENT_ASSIGNMENT_REMOVED",
                    "Client",
                    clientId,
                    {
                        assignmentId,
                        managerId:
                            assignment.managerId
                    }
                );

                return result;
            }
        );

    return deleted;
}


/*
|--------------------------------------------------------------------------
| Add Contact
|--------------------------------------------------------------------------
*/

async function addContact(
    userId,
    clientId,
    data
) {
    const user =
        await getActiveUser(userId);

    const hasAccess =
        await canAccessClient(
            user,
            clientId
        );

    if (!hasAccess) {
        throw new Error(
            "You do not have access to this client"
        );
    }

    const contact =
        normalizeContact(data);

    const created =
        await prisma.$transaction(
            async (tx) => {
                const result =
                    await tx.clientContact.create(
                        {
                            data: {
                                clientId,
                                ...contact
                            }
                        }
                    );

                await createAuditLog(
                    tx,
                    user.id,
                    "CLIENT_CONTACT_CREATED",
                    "ClientContact",
                    result.id,
                    {
                        clientId
                    }
                );

                return result;
            }
        );

    return created;
}


/*
|--------------------------------------------------------------------------
| Update Contact
|--------------------------------------------------------------------------
*/

async function updateContact(
    userId,
    clientId,
    contactId,
    data
) {
    const user =
        await getActiveUser(userId);

    const hasAccess =
        await canAccessClient(
            user,
            clientId
        );

    if (!hasAccess) {
        throw new Error(
            "You do not have access to this client"
        );
    }

    const existing =
        await prisma.clientContact.findFirst({
            where: {
                id: contactId,
                clientId
            }
        });

    if (!existing) {
        throw new Error(
            "Contact not found"
        );
    }

    const updateData = {};

    if (data.name !== undefined) {
        if (
            typeof data.name !== "string" ||
            !data.name.trim()
        ) {
            throw new Error(
                "Contact name is required"
            );
        }

        updateData.name =
            data.name.trim();
    }

    if (data.phone !== undefined) {
        updateData.phone =
            data.phone
                ? String(data.phone).trim()
                : null;
    }

    if (data.email !== undefined) {
        updateData.email =
            data.email
                ? String(data.email)
                    .trim()
                    .toLowerCase()
                : null;
    }

    if (
        Object.keys(updateData).length === 0
    ) {
        throw new Error(
            "No contact details to update"
        );
    }

    const updated =
        await prisma.$transaction(
            async (tx) => {
                const result =
                    await tx.clientContact.update(
                        {
                            where: {
                                id: contactId
                            },

                            data: updateData
                        }
                    );

                await createAuditLog(
                    tx,
                    user.id,
                    "CLIENT_CONTACT_UPDATED",
                    "ClientContact",
                    contactId,
                    {
                        clientId,
                        ...updateData
                    }
                );

                return result;
            }
        );

    return updated;
}


/*
|--------------------------------------------------------------------------
| Delete Contact
|--------------------------------------------------------------------------
*/

async function deleteContact(
    userId,
    clientId,
    contactId
) {
    const user =
        await getActiveUser(userId);

    const hasAccess =
        await canAccessClient(
            user,
            clientId
        );

    if (!hasAccess) {
        throw new Error(
            "You do not have access to this client"
        );
    }

    const existing =
        await prisma.clientContact.findFirst({
            where: {
                id: contactId,
                clientId
            }
        });

    if (!existing) {
        throw new Error(
            "Contact not found"
        );
    }

    await prisma.$transaction(
        async (tx) => {
            await tx.clientContact.delete({
                where: {
                    id: contactId
                }
            });

            await createAuditLog(
                tx,
                user.id,
                "CLIENT_CONTACT_DELETED",
                "ClientContact",
                contactId,
                {
                    clientId
                }
            );
        }
    );

    return {
        success: true
    };
}


/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

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