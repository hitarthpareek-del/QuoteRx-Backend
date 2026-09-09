const companyService =
    require("../services/company.service");


async function createCompany(req, res) {
    try {
        const company =
            await companyService.createCompany(
                req.body,
                req.user.id
            );

        return res.status(201).json({
            success: true,
            message:
                "Company created successfully",
            company
        });
    } catch (error) {
        console.error(
            "Create company error:",
            error
        );

        if (
            error.message ===
            "NAME_REQUIRED"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Company name is required"
            });
        }

        if (
            error.message ===
            "COMPANY_NAME_ALREADY_EXISTS"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "A company with this name already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Could not create company"
        });
    }
}


async function getCompanies(req, res) {
    try {
        const companies =
            await companyService.getCompanies();

        return res.json({
            success: true,
            companies
        });
    } catch (error) {
        console.error(
            "Get companies error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Could not fetch companies"
        });
    }
}


async function getCompanyById(req, res) {
    try {
        const company =
            await companyService.getCompanyById(
                req.params.id
            );

        return res.json({
            success: true,
            company
        });
    } catch (error) {
        console.error(
            "Get company error:",
            error
        );

        if (
            error.message ===
            "COMPANY_NOT_FOUND"
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Company not found"
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Could not fetch company"
        });
    }
}


async function updateCompany(req, res) {
    try {
        const company =
            await companyService.updateCompany(
                req.params.id,
                req.body,
                req.user.id
            );

        return res.json({
            success: true,
            message:
                "Company updated successfully",
            company
        });
    } catch (error) {
        console.error(
            "Update company error:",
            error
        );

        if (
            error.message ===
            "COMPANY_NOT_FOUND"
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Company not found"
            });
        }

        if (
            error.message ===
            "NAME_REQUIRED"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Company name is required"
            });
        }

        if (
            error.message ===
            "COMPANY_NAME_ALREADY_EXISTS"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "A company with this name already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Could not update company"
        });
    }
}


async function updateCompanyStatus(
    req,
    res
) {
    try {
        const company =
            await companyService.updateCompanyStatus(
                req.params.id,
                req.body.status,
                req.user.id
            );

        return res.json({
            success: true,
            message:
                "Company status updated successfully",
            company
        });
    } catch (error) {
        console.error(
            "Update company status error:",
            error
        );

        if (
            error.message ===
            "COMPANY_NOT_FOUND"
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Company not found"
            });
        }

        if (
            error.message ===
            "INVALID_COMPANY_STATUS"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Status must be ACTIVE or INACTIVE"
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Could not update company status"
        });
    }
}


module.exports = {
    createCompany,
    getCompanies,
    getCompanyById,
    updateCompany,
    updateCompanyStatus
};