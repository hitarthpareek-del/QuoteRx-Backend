const userService =
    require("../services/user.service");


async function createUser(req, res) {
    try {
        const {
            name,
            email,
            phoneNumber,
            userPrefix,
            role,
            companyId,
            adminId,
            managerId
        } = req.body;

        const user =
            await userService.createUser(
                {
                    name,
                    email,
                    phoneNumber,
                    userPrefix,
                    role,
                    companyId,
                    adminId,
                    managerId
                },
                req.user.id
            );

        return res.status(201).json({
            success: true,
            message:
                "User created successfully",
            user
        });

    } catch (error) {

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message:
                    "A user with this email or user prefix already exists"
            });
        }

        console.error(
            "Create user error:",
            error
        );

        const errors = {

            EMAIL_REQUIRED: [
                400,
                "Email is required"
            ],

            ROLE_REQUIRED: [
                400,
                "User role is required"
            ],

            INVALID_ROLE: [
                400,
                "Invalid user role"
            ],

            EMAIL_ALREADY_EXISTS: [
                409,
                "A user with this email already exists"
            ],

            USER_PREFIX_ALREADY_EXISTS: [
                409,
                "A user with this user prefix already exists"
            ],

            COMPANY_REQUIRED: [
                400,
                "Company is required for this role"
            ],

            COMPANY_NOT_FOUND: [
                404,
                "Company not found"
            ],

            COMPANY_INACTIVE: [
                400,
                "Selected company is inactive"
            ],

            INVALID_ADMIN_HIERARCHY: [
                400,
                "ADMIN cannot have adminId or managerId"
            ],

            ADMIN_REQUIRED: [
                400,
                "Admin is required for this role"
            ],

            INVALID_MANAGER_HIERARCHY: [
                400,
                "MANAGER cannot have managerId"
            ],

            ADMIN_NOT_FOUND: [
                404,
                "Admin not found"
            ],

            INVALID_ADMIN: [
                400,
                "Selected user is not an ADMIN"
            ],

            ADMIN_COMPANY_MISMATCH: [
                400,
                "Admin does not belong to the selected company"
            ],

            ADMIN_INACTIVE: [
                400,
                "Selected admin is inactive"
            ],

            MANAGER_REQUIRED: [
                400,
                "Manager is required for an employee"
            ],

            MANAGER_NOT_FOUND: [
                404,
                "Manager not found"
            ],

            INVALID_MANAGER: [
                400,
                "Selected user is not a MANAGER"
            ],

            MANAGER_COMPANY_MISMATCH: [
                400,
                "Manager does not belong to the selected company"
            ],

            MANAGER_ADMIN_MISMATCH: [
                400,
                "Manager does not belong to the selected admin"
            ],

            MANAGER_INACTIVE: [
                400,
                "Selected manager is inactive"
            ]
        };

        const response =
            errors[error.message];

        if (response) {
            return res.status(response[0]).json({
                success: false,
                message: response[1]
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Could not create user"
        });
    }
}


async function getUsers(req, res) {
    try {
        const {
            role,
            status,
            companyId
        } = req.query;

        const users =
            await userService.getUsers({
                role,
                status,
                companyId
            });

        return res.json({
            success: true,
            users
        });

    } catch (error) {

        console.error(
            "Get users error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Could not fetch users"
        });
    }
}


async function getUserById(req, res) {
    try {
        const user =
            await userService.getUserById(
                req.params.id
            );

        return res.json({
            success: true,
            user
        });

    } catch (error) {

        console.error(
            "Get user error:",
            error
        );

        if (
            error.message ===
            "USER_NOT_FOUND"
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "User not found"
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Could not fetch user"
        });
    }
}


async function updateUser(req, res) {
    try {
        const user =
            await userService.updateUser(
                req.params.id,
                req.body,
                req.user.id
            );

        return res.json({
            success: true,
            message:
                "User updated successfully",
            user
        });

    } catch (error) {

        console.error(
            "Update user error:",
            error
        );

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message:
                    "A user with this email or user prefix already exists"
            });
        }

        const errors = {

            USER_NOT_FOUND: [
                404,
                "User not found"
            ],

            CANNOT_MODIFY_SUPERADMIN: [
                403,
                "SUPERADMIN cannot be modified"
            ],

            INVALID_ROLE: [
                400,
                "Invalid user role"
            ],

            EMAIL_REQUIRED: [
                400,
                "Email cannot be empty"
            ],

            EMAIL_ALREADY_EXISTS: [
                409,
                "A user with this email already exists"
            ],

            USER_PREFIX_ALREADY_EXISTS: [
                409,
                "A user with this user prefix already exists"
            ],

            COMPANY_REQUIRED: [
                400,
                "Company is required for this role"
            ],

            COMPANY_NOT_FOUND: [
                404,
                "Company not found"
            ],

            COMPANY_INACTIVE: [
                400,
                "Selected company is inactive"
            ],

            INVALID_ADMIN_HIERARCHY: [
                400,
                "ADMIN cannot have adminId or managerId"
            ],

            ADMIN_REQUIRED: [
                400,
                "Admin is required for this role"
            ],

            INVALID_MANAGER_HIERARCHY: [
                400,
                "MANAGER cannot have managerId"
            ],

            ADMIN_NOT_FOUND: [
                404,
                "Admin not found"
            ],

            INVALID_ADMIN: [
                400,
                "Selected user is not an ADMIN"
            ],

            ADMIN_COMPANY_MISMATCH: [
                400,
                "Admin does not belong to the selected company"
            ],

            ADMIN_INACTIVE: [
                400,
                "Selected admin is inactive"
            ],

            MANAGER_REQUIRED: [
                400,
                "Manager is required for an employee"
            ],

            MANAGER_NOT_FOUND: [
                404,
                "Manager not found"
            ],

            INVALID_MANAGER: [
                400,
                "Selected user is not a MANAGER"
            ],

            MANAGER_COMPANY_MISMATCH: [
                400,
                "Manager does not belong to the selected company"
            ],

            MANAGER_ADMIN_MISMATCH: [
                400,
                "Manager does not belong to the selected admin"
            ],

            MANAGER_INACTIVE: [
                400,
                "Selected manager is inactive"
            ],

            INVALID_HIERARCHY: [
                400,
                "Invalid user hierarchy"
            ]
        };

        const response =
            errors[error.message];

        if (response) {
            return res.status(response[0]).json({
                success: false,
                message: response[1]
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Could not update user"
        });
    }
}


async function updateUserStatus(req, res) {
    try {
        const {
            status
        } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message:
                    "Status is required"
            });
        }

        const user =
            await userService.updateUserStatus(
                req.params.id,
                status,
                req.user.id
            );

        return res.json({
            success: true,
            message:
                "User status updated successfully",
            user
        });

    } catch (error) {

        console.error(
            "Update user status error:",
            error
        );

        const errors = {

            INVALID_STATUS: [
                400,
                "Invalid user status"
            ],

            USER_NOT_FOUND: [
                404,
                "User not found"
            ],

            CANNOT_MODIFY_SUPERADMIN: [
                403,
                "SUPERADMIN cannot be modified"
            ],

            STATUS_ALREADY_SET: [
                400,
                "User already has this status"
            ]
        };

        const response =
            errors[error.message];

        if (response) {
            return res.status(response[0]).json({
                success: false,
                message: response[1]
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Could not update user status"
        });
    }
}


async function getAdminsByCompany(req, res) {
    try {
        const {
            companyId
        } = req.query;

        const admins =
            await userService.getAdminsByCompany(
                companyId
            );

        return res.json({
            success: true,
            admins
        });

    } catch (error) {

        console.error(
            "Get admins by company error:",
            error
        );

        const errors = {

            COMPANY_REQUIRED: [
                400,
                "Company is required"
            ],

            COMPANY_NOT_FOUND: [
                404,
                "Company not found"
            ]
        };

        const response =
            errors[error.message];

        if (response) {
            return res.status(response[0]).json({
                success: false,
                message: response[1]
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Could not fetch admins"
        });
    }
}


async function getManagersByAdmin(req, res) {
    try {
        const {
            companyId,
            adminId
        } = req.query;

        const managers =
            await userService.getManagersByAdmin(
                companyId,
                adminId
            );

        return res.json({
            success: true,
            managers
        });

    } catch (error) {

        console.error(
            "Get managers by admin error:",
            error
        );

        const errors = {

            COMPANY_REQUIRED: [
                400,
                "Company is required"
            ],

            ADMIN_REQUIRED: [
                400,
                "Admin is required"
            ],

            COMPANY_NOT_FOUND: [
                404,
                "Company not found"
            ],

            ADMIN_NOT_FOUND: [
                404,
                "Admin not found"
            ],

            INVALID_ADMIN: [
                400,
                "Selected user is not an ADMIN"
            ],

            ADMIN_COMPANY_MISMATCH: [
                400,
                "Admin does not belong to the selected company"
            ],

            ADMIN_INACTIVE: [
                400,
                "Selected admin is inactive"
            ]
        };

        const response =
            errors[error.message];

        if (response) {
            return res.status(response[0]).json({
                success: false,
                message: response[1]
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Could not fetch managers"
        });
    }
}


async function getEmployees(req, res) {
    try {
        const {
            companyId,
            managerId
        } = req.query;

        const employees =
            await userService.getEmployees({
                companyId,
                managerId
            });

        return res.json({
            success: true,
            employees
        });

    } catch (error) {

        console.error(
            "Get employees error:",
            error
        );

        const errors = {

            COMPANY_OR_MANAGER_REQUIRED: [
                400,
                "Company or manager is required"
            ],

            COMPANY_NOT_FOUND: [
                404,
                "Company not found"
            ],

            MANAGER_NOT_FOUND: [
                404,
                "Manager not found"
            ],

            INVALID_MANAGER: [
                400,
                "Selected user is not a MANAGER"
            ],

            MANAGER_INACTIVE: [
                400,
                "Selected manager is inactive"
            ],

            MANAGER_COMPANY_MISMATCH: [
                400,
                "Manager does not belong to the selected company"
            ]
        };

        const response =
            errors[error.message];

        if (response) {
            return res.status(response[0]).json({
                success: false,
                message: response[1]
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Could not fetch employees"
        });
    }
}


async function getMyManagers(req, res) {
    try {
        const managers =
            await userService.getMyManagers(
                req.user.id
            );

        return res.json({
            success: true,
            data: managers
        });

    } catch (error) {

        if (
            error.message ===
            "USER_NOT_FOUND"
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "User not found"
            });
        }

        if (
            error.message ===
            "ONLY_ADMIN_CAN_VIEW_MANAGERS"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Only admins can view their managers"
            });
        }

        if (
            error.message ===
            "USER_NOT_ACTIVE"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "User is not active"
            });
        }

        console.error(
            "Get my managers error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch managers"
        });
    }
}


async function getMyEmployees(req, res) {
    try {
        const employees =
            await userService.getMyEmployees(
                req.user.id,
                req.user.role
            );

        return res.json({
            success: true,
            data: employees
        });

    } catch (error) {

        if (
            error.message ===
            "USER_NOT_FOUND"
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "User not found"
            });
        }

        if (
            error.message ===
            "USER_NOT_ACTIVE"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "User is not active"
            });
        }

        if (
            error.message ===
            "INVALID_ROLE"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Only admins and managers can view employees"
            });
        }

        if (
            error.message ===
            "INVALID_USER_ROLE"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "User role does not match authenticated role"
            });
        }

        console.error(
            "Get my employees error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch employees"
        });
    }
}


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

