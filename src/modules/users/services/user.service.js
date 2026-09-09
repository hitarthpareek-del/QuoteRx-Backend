const prisma =
    require("../../../lib/prisma");

const {
    createPasswordSetupToken,
    hashToken
} = require("../../../utils/tokens");

const {
    sendPasswordSetupEmail
} = require("../../auth/services/email.service");


// =====================================================
// VALIDATE USER HIERARCHY
// =====================================================

async function validateUserHierarchy(
    data,
    existingUserId = null
) {
    const {
        role,
        companyId,
        adminId,
        managerId
    } = data;


    // =================================================
    // SUPERADMIN
    // =================================================

    if (role === "SUPERADMIN") {
        return;
    }


    // =================================================
    // EVERY NORMAL USER MUST BELONG TO A COMPANY
    // =================================================

    if (!companyId) {
        throw new Error(
            "COMPANY_REQUIRED"
        );
    }


    const company =
        await prisma.company.findUnique({
            where: {
                id: companyId
            }
        });


    if (!company) {
        throw new Error(
            "COMPANY_NOT_FOUND"
        );
    }


    if (company.status !== "ACTIVE") {
        throw new Error(
            "COMPANY_INACTIVE"
        );
    }


    // =================================================
    // ADMIN
    // =================================================

    if (role === "ADMIN") {

        if (adminId || managerId) {
            throw new Error(
                "INVALID_ADMIN_HIERARCHY"
            );
        }

        return;
    }


    // =================================================
    // MANAGER
    // =================================================

    if (role === "MANAGER") {

        if (!adminId) {
            throw new Error(
                "ADMIN_REQUIRED"
            );
        }

        if (managerId) {
            throw new Error(
                "INVALID_MANAGER_HIERARCHY"
            );
        }


        const admin =
            await prisma.user.findUnique({
                where: {
                    id: adminId
                },

                select: {
                    id: true,
                    role: true,
                    status: true,
                    companyId: true
                }
            });


        if (!admin) {
            throw new Error(
                "ADMIN_NOT_FOUND"
            );
        }


        if (admin.role !== "ADMIN") {
            throw new Error(
                "INVALID_ADMIN"
            );
        }


        if (admin.companyId !== companyId) {
            throw new Error(
                "ADMIN_COMPANY_MISMATCH"
            );
        }


        if (
            admin.status === "DEACTIVATED" ||
            admin.status === "SUSPENDED"
        ) {
            throw new Error(
                "ADMIN_INACTIVE"
            );
        }

        return;
    }


    // =================================================
    // EMPLOYEE
    // =================================================

    if (role === "EMPLOYEE") {

        if (!adminId) {
            throw new Error(
                "ADMIN_REQUIRED"
            );
        }

        if (!managerId) {
            throw new Error(
                "MANAGER_REQUIRED"
            );
        }


        const admin =
            await prisma.user.findUnique({
                where: {
                    id: adminId
                },

                select: {
                    id: true,
                    role: true,
                    status: true,
                    companyId: true
                }
            });


        if (!admin) {
            throw new Error(
                "ADMIN_NOT_FOUND"
            );
        }


        if (admin.role !== "ADMIN") {
            throw new Error(
                "INVALID_ADMIN"
            );
        }


        if (admin.companyId !== companyId) {
            throw new Error(
                "ADMIN_COMPANY_MISMATCH"
            );
        }


        if (
            admin.status === "DEACTIVATED" ||
            admin.status === "SUSPENDED"
        ) {
            throw new Error(
                "ADMIN_INACTIVE"
            );
        }


        const manager =
            await prisma.user.findUnique({
                where: {
                    id: managerId
                },

                select: {
                    id: true,
                    role: true,
                    status: true,
                    companyId: true,
                    adminId: true
                }
            });


        if (!manager) {
            throw new Error(
                "MANAGER_NOT_FOUND"
            );
        }


        if (manager.role !== "MANAGER") {
            throw new Error(
                "INVALID_MANAGER"
            );
        }


        if (manager.companyId !== companyId) {
            throw new Error(
                "MANAGER_COMPANY_MISMATCH"
            );
        }


        if (manager.adminId !== adminId) {
            throw new Error(
                "MANAGER_ADMIN_MISMATCH"
            );
        }


        if (
            manager.status === "DEACTIVATED" ||
            manager.status === "SUSPENDED"
        ) {
            throw new Error(
                "MANAGER_INACTIVE"
            );
        }

        return;
    }


    throw new Error(
        "INVALID_ROLE"
    );
}


// =====================================================
// VALID ROLES
// =====================================================

const VALID_ROLES = [
    "ADMIN",
    "MANAGER",
    "EMPLOYEE"
];


// =====================================================
// CREATE USER
// =====================================================

async function createUser(
    data,
    createdByUserId
) {
    const {
        name,
        email,
        phoneNumber,
        userPrefix,
        role,
        companyId,
        adminId,
        managerId
    } = data;


    // =================================================
    // BASIC VALIDATION
    // =================================================

    if (!email || !email.trim()) {
        throw new Error(
            "EMAIL_REQUIRED"
        );
    }


    if (!role) {
        throw new Error(
            "ROLE_REQUIRED"
        );
    }


    if (!VALID_ROLES.includes(role)) {
        throw new Error(
            "INVALID_ROLE"
        );
    }


    const normalizedEmail =
        email.trim().toLowerCase();


    const normalizedPhoneNumber =
        phoneNumber?.trim() || null;


    const normalizedUserPrefix =
        userPrefix?.trim()
            ? userPrefix.trim().toUpperCase()
            : null;


    // =================================================
    // CHECK EMAIL
    // =================================================

    const existingUser =
        await prisma.user.findUnique({
            where: {
                email: normalizedEmail
            }
        });


    if (existingUser) {
        throw new Error(
            "EMAIL_ALREADY_EXISTS"
        );
    }


    // =================================================
    // CHECK USER PREFIX
    //
    // NULL is allowed for multiple users.
    // Only a real prefix must be unique.
    // =================================================

    if (normalizedUserPrefix) {

        const existingPrefix =
            await prisma.user.findUnique({
                where: {
                    userPrefix:
                        normalizedUserPrefix
                }
            });


        if (existingPrefix) {
            throw new Error(
                "USER_PREFIX_ALREADY_EXISTS"
            );
        }
    }


    // =================================================
    // VALIDATE HIERARCHY
    // =================================================

    await validateUserHierarchy({
        role,
        companyId,
        adminId,
        managerId
    });


    // =================================================
    // GENERATE PASSWORD SETUP TOKEN
    // =================================================

    const setupToken =
        createPasswordSetupToken();

    const setupTokenHash =
        hashToken(setupToken);

    const setupTokenExpiresAt =
        new Date();

    setupTokenExpiresAt.setHours(
        setupTokenExpiresAt.getHours() +
        Number(
            process.env
                .PASSWORD_SETUP_TOKEN_EXPIRES_HOURS ||
            24
        )
    );


    // =================================================
    // CREATE USER + TOKEN + AUDIT LOG
    // =================================================

    const result =
        await prisma.$transaction(
            async (tx) => {

                const user =
                    await tx.user.create({
                        data: {

                            name:
                                name?.trim() ||
                                null,

                            email:
                                normalizedEmail,

                            phoneNumber:
                                normalizedPhoneNumber,

                            userPrefix:
                                normalizedUserPrefix,

                            passwordHash:
                                null,

                            role,

                            status:
                                "PENDING",

                            emailVerified:
                                false,

                            emailVerifiedAt:
                                null,

                            companyId:
                                role === "SUPERADMIN"
                                    ? null
                                    : companyId,

                            adminId:
                                role === "MANAGER" ||
                                role === "EMPLOYEE"
                                    ? adminId
                                    : null,

                            managerId:
                                role === "EMPLOYEE"
                                    ? managerId
                                    : null
                        }
                    });


                // =====================================
                // PASSWORD SETUP TOKEN
                // =====================================

                await tx.passwordSetupToken.create({
                    data: {
                        userId:
                            user.id,

                        tokenHash:
                            setupTokenHash,

                        expiresAt:
                            setupTokenExpiresAt
                    }
                });


                // =====================================
                // AUDIT LOG
                // =====================================

                await tx.auditLog.create({
                    data: {

                        userId:
                            createdByUserId,

                        action:
                            "USER_CREATED",

                        entity:
                            "User",

                        entityId:
                            user.id,

                        metadata: {

                            createdUserId:
                                user.id,

                            role:
                                user.role,

                            email:
                                user.email,

                            phoneNumber:
                                user.phoneNumber,

                            userPrefix:
                                user.userPrefix,

                            companyId:
                                user.companyId,

                            adminId:
                                user.adminId,

                            managerId:
                                user.managerId
                        }
                    }
                });


                return user;
            }
        );


    // =================================================
    // SEND PASSWORD SETUP EMAIL
    // =================================================

    await sendPasswordSetupEmail({
        email:
            result.email,

        name:
            result.name,

        setupToken
    });


    // =================================================
    // RETURN SAFE USER DATA
    // =================================================

    return {
        id:
            result.id,

        name:
            result.name,

        email:
            result.email,

        phoneNumber:
            result.phoneNumber,

        userPrefix:
            result.userPrefix,

        role:
            result.role,

        status:
            result.status,

        emailVerified:
            result.emailVerified,

        companyId:
            result.companyId,

        adminId:
            result.adminId,

        managerId:
            result.managerId,

        createdAt:
            result.createdAt
    };
}


// =====================================================
// GET USERS
// =====================================================

async function getUsers(filters = {}) {

    const {
        role,
        status,
        companyId
    } = filters;


    const where = {};


    if (role) {
        where.role = role;
    }


    if (status) {
        where.status = status;
    }


    if (companyId) {
        where.companyId = companyId;
    }


    const users =
        await prisma.user.findMany({
            where,

            select: {

                id:
                    true,

                name:
                    true,

                email:
                    true,

                phoneNumber:
                    true,

                userPrefix:
                    true,

                role:
                    true,

                status:
                    true,

                emailVerified:
                    true,

                emailVerifiedAt:
                    true,

                companyId:
                    true,

                adminId:
                    true,

                managerId:
                    true,

                createdAt:
                    true,

                updatedAt:
                    true,

                lastLoginAt:
                    true,

                company: {
                    select: {
                        id:
                            true,

                        name:
                            true
                    }
                },

                admin: {
                    select: {
                        id:
                            true,

                        name:
                            true,

                        email:
                            true
                    }
                },

                manager: {
                    select: {
                        id:
                            true,

                        name:
                            true,

                        email:
                            true
                    }
                }
            },

            orderBy: {
                createdAt:
                    "desc"
            }
        });


    return users;
}


// =====================================================
// GET USER BY ID
// =====================================================

async function getUserById(
    userId
) {

    const user =
        await prisma.user.findUnique({
            where: {
                id: userId
            },

            select: {

                id:
                    true,

                name:
                    true,

                email:
                    true,

                phoneNumber:
                    true,

                userPrefix:
                    true,

                role:
                    true,

                status:
                    true,

                emailVerified:
                    true,

                emailVerifiedAt:
                    true,

                companyId:
                    true,

                adminId:
                    true,

                managerId:
                    true,

                createdAt:
                    true,

                updatedAt:
                    true,

                lastLoginAt:
                    true,

                company: {
                    select: {
                        id:
                            true,

                        name:
                            true
                    }
                },

                admin: {
                    select: {
                        id:
                            true,

                        name:
                            true,

                        email:
                            true,

                        role:
                            true,

                        status:
                            true
                    }
                },

                manager: {
                    select: {
                        id:
                            true,

                        name:
                            true,

                        email:
                            true,

                        role:
                            true,

                        status:
                            true
                    }
                }
            }
        });


    if (!user) {
        throw new Error(
            "USER_NOT_FOUND"
        );
    }


    return user;
}


// =====================================================
// UPDATE USER
// =====================================================

async function updateUser(
    userId,
    data,
    updatedByUserId
) {

    const existingUser =
        await prisma.user.findUnique({
            where: {
                id: userId
            }
        });


    if (!existingUser) {
        throw new Error(
            "USER_NOT_FOUND"
        );
    }


    // =================================================
    // SUPERADMIN CANNOT BE MODIFIED
    // =================================================

    if (
        existingUser.role ===
        "SUPERADMIN"
    ) {
        throw new Error(
            "CANNOT_MODIFY_SUPERADMIN"
        );
    }


    const {
        name,
        email,
        phoneNumber,
        userPrefix,
        role,
        companyId,
        adminId,
        managerId
    } = data;


    const newRole =
        role ??
        existingUser.role;


    const newCompanyId =
        companyId !== undefined
            ? companyId
            : existingUser.companyId;


    const newAdminId =
        adminId !== undefined
            ? adminId
            : existingUser.adminId;


    const newManagerId =
        managerId !== undefined
            ? managerId
            : existingUser.managerId;


    // =================================================
    // EMAIL
    // =================================================

    if (
        email !== undefined &&
        !email.trim()
    ) {
        throw new Error(
            "EMAIL_REQUIRED"
        );
    }


    const normalizedEmail =
        email !== undefined
            ? email.trim().toLowerCase()
            : existingUser.email;


    if (
        normalizedEmail !==
        existingUser.email
    ) {

        const duplicate =
            await prisma.user.findUnique({
                where: {
                    email:
                        normalizedEmail
                }
            });


        if (
            duplicate &&
            duplicate.id !== userId
        ) {
            throw new Error(
                "EMAIL_ALREADY_EXISTS"
            );
        }
    }


    // =================================================
    // PHONE NUMBER
    // =================================================

    const normalizedPhoneNumber =
        phoneNumber !== undefined
            ? phoneNumber?.trim() || null
            : existingUser.phoneNumber;


    // =================================================
    // USER PREFIX
    //
    // Empty / null = remove prefix.
    // Non-empty = uppercase + unique.
    // =================================================

    const normalizedUserPrefix =
        userPrefix !== undefined
            ? (
                userPrefix?.trim()
                    ? userPrefix
                        .trim()
                        .toUpperCase()
                    : null
            )
            : existingUser.userPrefix;


    if (
        normalizedUserPrefix &&
        normalizedUserPrefix !==
            existingUser.userPrefix
    ) {

        const duplicatePrefix =
            await prisma.user.findFirst({
                where: {

                    userPrefix:
                        normalizedUserPrefix,

                    NOT: {
                        id:
                            userId
                    }
                }
            });


        if (duplicatePrefix) {
            throw new Error(
                "USER_PREFIX_ALREADY_EXISTS"
            );
        }
    }


    // =================================================
    // VALIDATE ROLE
    // =================================================

    if (
        !VALID_ROLES.includes(newRole)
    ) {
        throw new Error(
            "INVALID_ROLE"
        );
    }


    // =================================================
    // VALIDATE HIERARCHY
    // =================================================

    await validateUserHierarchy(
        {
            role:
                newRole,

            companyId:
                newCompanyId,

            adminId:
                newAdminId,

            managerId:
                newManagerId
        },
        userId
    );


    // =================================================
    // CHECK HIERARCHY CHANGE
    // =================================================

    const hierarchyChanged =
        newRole !==
            existingUser.role ||

        newCompanyId !==
            existingUser.companyId ||

        newAdminId !==
            existingUser.adminId ||

        newManagerId !==
            existingUser.managerId;


    // =================================================
    // UPDATE USER
    // =================================================

    const updatedUser =
        await prisma.$transaction(
            async (tx) => {

                const updated =
                    await tx.user.update({
                        where: {
                            id:
                                userId
                        },

                        data: {

                            name:
                                name !== undefined
                                    ? name?.trim() ||
                                      null
                                    : existingUser.name,

                            email:
                                normalizedEmail,

                            phoneNumber:
                                normalizedPhoneNumber,

                            userPrefix:
                                normalizedUserPrefix,

                            role:
                                newRole,

                            companyId:
                                newRole === "SUPERADMIN"
                                    ? null
                                    : newCompanyId,

                            adminId:
                                newRole === "MANAGER" ||
                                newRole === "EMPLOYEE"
                                    ? newAdminId
                                    : null,

                            managerId:
                                newRole === "EMPLOYEE"
                                    ? newManagerId
                                    : null
                        }
                    });


                // =====================================
                // AUDIT HIERARCHY CHANGE
                // =====================================

                if (hierarchyChanged) {

                    await tx.auditLog.create({
                        data: {

                            userId:
                                updatedByUserId,

                            action:
                                "USER_HIERARCHY_UPDATED",

                            entity:
                                "User",

                            entityId:
                                updated.id,

                            metadata: {

                                oldRole:
                                    existingUser.role,

                                newRole:
                                    updated.role,

                                oldCompanyId:
                                    existingUser.companyId,

                                newCompanyId:
                                    updated.companyId,

                                oldAdminId:
                                    existingUser.adminId,

                                newAdminId:
                                    updated.adminId,

                                oldManagerId:
                                    existingUser.managerId,

                                newManagerId:
                                    updated.managerId
                            }
                        }
                    });
                }


                // =====================================
                // AUDIT PROFILE CHANGE
                // =====================================

                const profileChanged =
                    name !== undefined ||
                    email !== undefined ||
                    phoneNumber !== undefined ||
                    userPrefix !== undefined;


                if (profileChanged) {

                    await tx.auditLog.create({
                        data: {

                            userId:
                                updatedByUserId,

                            action:
                                "USER_PROFILE_UPDATED",

                            entity:
                                "User",

                            entityId:
                                updated.id,

                            metadata: {

                                updatedUserId:
                                    updated.id,

                                oldName:
                                    existingUser.name,

                                newName:
                                    updated.name,

                                oldEmail:
                                    existingUser.email,

                                newEmail:
                                    updated.email,

                                oldPhoneNumber:
                                    existingUser.phoneNumber,

                                newPhoneNumber:
                                    updated.phoneNumber,

                                oldUserPrefix:
                                    existingUser.userPrefix,

                                newUserPrefix:
                                    updated.userPrefix
                            }
                        }
                    });
                }


                return updated;
            }
        );


    return updatedUser;
}


// =====================================================
// UPDATE USER STATUS
// =====================================================

async function updateUserStatus(
    userId,
    status,
    updatedByUserId
) {

    const VALID_STATUSES = [
        "ACTIVE",
        "SUSPENDED",
        "DEACTIVATED"
    ];


    if (
        !VALID_STATUSES.includes(
            status
        )
    ) {
        throw new Error(
            "INVALID_STATUS"
        );
    }


    const existingUser =
        await prisma.user.findUnique({
            where: {
                id: userId
            }
        });


    if (!existingUser) {
        throw new Error(
            "USER_NOT_FOUND"
        );
    }


    // =================================================
    // SUPERADMIN CANNOT BE MODIFIED
    // =================================================

    if (
        existingUser.role ===
        "SUPERADMIN"
    ) {
        throw new Error(
            "CANNOT_MODIFY_SUPERADMIN"
        );
    }


    // =================================================
    // PREVENT UNNECESSARY UPDATE
    // =================================================

    if (
        existingUser.status ===
        status
    ) {
        throw new Error(
            "STATUS_ALREADY_SET"
        );
    }


    const updatedUser =
        await prisma.$transaction(
            async (tx) => {

                const user =
                    await tx.user.update({
                        where: {
                            id:
                                userId
                        },

                        data: {
                            status
                        },

                        select: {

                            id:
                                true,

                            name:
                                true,

                            email:
                                true,

                            phoneNumber:
                                true,

                            userPrefix:
                                true,

                            role:
                                true,

                            status:
                                true,

                            emailVerified:
                                true,

                            emailVerifiedAt:
                                true,

                            companyId:
                                true,

                            adminId:
                                true,

                            managerId:
                                true,

                            createdAt:
                                true,

                            updatedAt:
                                true,

                            lastLoginAt:
                                true
                        }
                    });


                // =====================================
                // REVOKE REFRESH TOKENS
                // =====================================

                if (
                    status === "SUSPENDED" ||
                    status === "DEACTIVATED"
                ) {

                    await tx.refreshToken.updateMany({
                        where: {

                            userId,

                            revokedAt:
                                null
                        },

                        data: {
                            revokedAt:
                                new Date()
                        }
                    });
                }


                // =====================================
                // AUDIT ACTION
                // =====================================

                let auditAction =
                    "USER_STATUS_UPDATED";


                if (
                    status === "ACTIVE"
                ) {
                    auditAction =
                        "USER_ACTIVATED";
                }


                if (
                    status === "SUSPENDED"
                ) {
                    auditAction =
                        "USER_SUSPENDED";
                }


                if (
                    status === "DEACTIVATED"
                ) {
                    auditAction =
                        "USER_DEACTIVATED";
                }


                await tx.auditLog.create({
                    data: {

                        userId:
                            updatedByUserId,

                        action:
                            auditAction,

                        entity:
                            "User",

                        entityId:
                            user.id,

                        metadata: {

                            updatedUserId:
                                user.id,

                            previousStatus:
                                existingUser.status,

                            newStatus:
                                status
                        }
                    }
                });


                return user;
            }
        );


    return updatedUser;
}


// =====================================================
// GET ADMINS BY COMPANY
// SUPERADMIN
// =====================================================

async function getAdminsByCompany(
    companyId
) {

    if (!companyId) {
        throw new Error(
            "COMPANY_REQUIRED"
        );
    }


    const company =
        await prisma.company.findUnique({
            where: {
                id:
                    companyId
            },

            select: {
                id:
                    true
            }
        });


    if (!company) {
        throw new Error(
            "COMPANY_NOT_FOUND"
        );
    }


    return prisma.user.findMany({

        where: {

            role:
                "ADMIN",

            status:
                "ACTIVE",

            companyId
        },

        select: {

            id:
                true,

            name:
                true,

            email:
                true,

            phoneNumber:
                true,

            userPrefix:
                true,

            role:
                true,

            status:
                true,

            companyId:
                true
        },

        orderBy: {
            name:
                "asc"
        }
    });
}


// =====================================================
// GET MANAGERS BY ADMIN
// SUPERADMIN
// =====================================================

async function getManagersByAdmin(
    companyId,
    adminId
) {

    if (!companyId) {
        throw new Error(
            "COMPANY_REQUIRED"
        );
    }


    if (!adminId) {
        throw new Error(
            "ADMIN_REQUIRED"
        );
    }


    const company =
        await prisma.company.findUnique({
            where: {
                id:
                    companyId
            },

            select: {
                id:
                    true
            }
        });


    if (!company) {
        throw new Error(
            "COMPANY_NOT_FOUND"
        );
    }


    const admin =
        await prisma.user.findUnique({
            where: {
                id:
                    adminId
            },

            select: {

                id:
                    true,

                role:
                    true,

                status:
                    true,

                companyId:
                    true
            }
        });


    if (!admin) {
        throw new Error(
            "ADMIN_NOT_FOUND"
        );
    }


    if (
        admin.role !==
        "ADMIN"
    ) {
        throw new Error(
            "INVALID_ADMIN"
        );
    }


    if (
        admin.companyId !==
        companyId
    ) {
        throw new Error(
            "ADMIN_COMPANY_MISMATCH"
        );
    }


    if (
        admin.status !==
        "ACTIVE"
    ) {
        throw new Error(
            "ADMIN_INACTIVE"
        );
    }


    return prisma.user.findMany({

        where: {

            role:
                "MANAGER",

            status:
                "ACTIVE",

            companyId,

            adminId
        },

        select: {

            id:
                true,

            name:
                true,

            email:
                true,

            phoneNumber:
                true,

            userPrefix:
                true,

            role:
                true,

            status:
                true,

            companyId:
                true,

            adminId:
                true
        },

        orderBy: {
            name:
                "asc"
        }
    });
}


// =====================================================
// GET EMPLOYEES
// SUPERADMIN
// =====================================================

async function getEmployees({
    companyId,
    managerId
}) {

    if (
        !companyId &&
        !managerId
    ) {
        throw new Error(
            "COMPANY_OR_MANAGER_REQUIRED"
        );
    }


    const where = {

        role:
            "EMPLOYEE",

        status:
            "ACTIVE"
    };


    // =================================================
    // GET BY MANAGER
    // =================================================

    if (managerId) {

        const manager =
            await prisma.user.findUnique({
                where: {
                    id:
                        managerId
                },

                select: {

                    id:
                        true,

                    role:
                        true,

                    status:
                        true,

                    companyId:
                        true
                }
            });


        if (!manager) {
            throw new Error(
                "MANAGER_NOT_FOUND"
            );
        }


        if (
            manager.role !==
            "MANAGER"
        ) {
            throw new Error(
                "INVALID_MANAGER"
            );
        }


        if (
            manager.status !==
            "ACTIVE"
        ) {
            throw new Error(
                "MANAGER_INACTIVE"
            );
        }


        where.managerId =
            managerId;


        if (companyId) {

            if (
                manager.companyId !==
                companyId
            ) {
                throw new Error(
                    "MANAGER_COMPANY_MISMATCH"
                );
            }


            where.companyId =
                companyId;
        }
    }


    // =================================================
    // GET ALL BY COMPANY
    // =================================================

    if (
        companyId &&
        !managerId
    ) {

        const company =
            await prisma.company.findUnique({
                where: {
                    id:
                        companyId
                },

                select: {
                    id:
                        true
                }
            });


        if (!company) {
            throw new Error(
                "COMPANY_NOT_FOUND"
            );
        }


        where.companyId =
            companyId;
    }


    return prisma.user.findMany({

        where,

        select: {

            id:
                true,

            name:
                true,

            email:
                true,

            phoneNumber:
                true,

            userPrefix:
                true,

            role:
                true,

            status:
                true,

            companyId:
                true,

            adminId:
                true,

            managerId:
                true
        },

        orderBy: {
            name:
                "asc"
        }
    });
}


// =====================================================
// GET MY MANAGERS
// ADMIN ONLY
// =====================================================

async function getMyManagers(
    userId
) {

    const user =
        await prisma.user.findUnique({
            where: {
                id:
                    userId
            },

            select: {

                id:
                    true,

                role:
                    true,

                status:
                    true
            }
        });


    if (!user) {
        throw new Error(
            "USER_NOT_FOUND"
        );
    }


    if (
        user.role !==
        "ADMIN"
    ) {
        throw new Error(
            "ONLY_ADMIN_CAN_VIEW_MANAGERS"
        );
    }


    if (
        user.status !==
        "ACTIVE"
    ) {
        throw new Error(
            "USER_NOT_ACTIVE"
        );
    }


    return prisma.user.findMany({

        where: {

            role:
                "MANAGER",

            status:
                "ACTIVE",

            adminId:
                userId
        },

        select: {

            id:
                true,

            name:
                true,

            email:
                true,

            phoneNumber:
                true,

            userPrefix:
                true,

            role:
                true,

            status:
                true,

            companyId:
                true,

            adminId:
                true
        },

        orderBy: {
            name:
                "asc"
        }
    });
}


// =====================================================
// GET MY EMPLOYEES
// ADMIN + MANAGER
// =====================================================

async function getMyEmployees(
    userId,
    role
) {

    const user =
        await prisma.user.findUnique({
            where: {
                id:
                    userId
            },

            select: {

                id:
                    true,

                role:
                    true,

                status:
                    true
            }
        });


    if (!user) {
        throw new Error(
            "USER_NOT_FOUND"
        );
    }


    if (
        user.status !==
        "ACTIVE"
    ) {
        throw new Error(
            "USER_NOT_ACTIVE"
        );
    }


    if (
        ![
            "ADMIN",
            "MANAGER"
        ].includes(role)
    ) {
        throw new Error(
            "INVALID_ROLE"
        );
    }


    if (
        user.role !==
        role
    ) {
        throw new Error(
            "INVALID_USER_ROLE"
        );
    }


    const where = {

        role:
            "EMPLOYEE",

        status:
            "ACTIVE"
    };


    if (
        role === "ADMIN"
    ) {
        where.adminId =
            userId;
    }


    if (
        role === "MANAGER"
    ) {
        where.managerId =
            userId;
    }


    return prisma.user.findMany({

        where,

        select: {

            id:
                true,

            name:
                true,

            email:
                true,

            phoneNumber:
                true,

            userPrefix:
                true,

            role:
                true,

            status:
                true,

            companyId:
                true,

            adminId:
                true,

            managerId:
                true
        },

        orderBy: {
            name:
                "asc"
        }
    });
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

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
};

