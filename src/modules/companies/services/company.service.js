const prisma =
    require("../../../lib/prisma");

async function createCompany(
    data,
    createdByUserId
) {
    const {
        name,
        logoUrl,
        gstNumber,
        cinNumber,
        address
    } = data;

    if (!name || !name.trim()) {
        throw new Error(
            "NAME_REQUIRED"
        );
    }

    const normalizedName =
        name.trim();

    const existingCompany =
        await prisma.company.findUnique({
            where: {
                name: normalizedName
            }
        });

    if (existingCompany) {
        throw new Error(
            "COMPANY_NAME_ALREADY_EXISTS"
        );
    }

    const company =
        await prisma.$transaction(
            async (tx) => {
                const created =
                    await tx.company.create({
                        data: {
                            name: normalizedName,

                            logoUrl:
                                logoUrl?.trim() ||
                                null,

                            gstNumber:
                                gstNumber?.trim() ||
                                null,

                            cinNumber:
                                cinNumber?.trim() ||
                                null,

                            address:
                                address?.trim() ||
                                null,

                            status: "ACTIVE"
                        }
                    });

                await tx.auditLog.create({
                    data: {
                        userId:
                            createdByUserId,

                        action:
                            "COMPANY_CREATED",

                        entity:
                            "Company",

                        entityId:
                            created.id,

                        metadata: {
                            name:
                                created.name
                        }
                    }
                });

                return created;
            }
        );

    return company;
}

async function getCompanies() {
    return prisma.company.findMany({
        orderBy: {
            createdAt: "desc"
        },

        select: {
            id: true,
            name: true,
            logoUrl: true,
            gstNumber: true,
            cinNumber: true,
            address: true,
            status: true,
            createdAt: true,
            updatedAt: true,

            _count: {
                select: {
                    users: true
                }
            }
        }
    });
}

async function getCompanyById(companyId) {
    const company =
        await prisma.company.findUnique({
            where: {
                id: companyId
            },

            select: {
                id: true,
                name: true,
                logoUrl: true,
                gstNumber: true,
                cinNumber: true,
                address: true,
                status: true,
                createdAt: true,
                updatedAt: true,

                _count: {
                    select: {
                        users: true
                    }
                }
            }
        });

    if (!company) {
        throw new Error(
            "COMPANY_NOT_FOUND"
        );
    }

    return company;
}


async function updateCompany(
    companyId,
    data,
    updatedByUserId
) {
    const {
        name,
        logoUrl,
        gstNumber,
        cinNumber,
        address
    } = data;

    const existingCompany =
        await prisma.company.findUnique({
            where: {
                id: companyId
            }
        });

    if (!existingCompany) {
        throw new Error(
            "COMPANY_NOT_FOUND"
        );
    }

    let normalizedName =
        existingCompany.name;

    if (name !== undefined) {
        if (!name.trim()) {
            throw new Error(
                "NAME_REQUIRED"
            );
        }

        normalizedName =
            name.trim();

        const duplicateCompany =
            await prisma.company.findFirst({
                where: {
                    name: normalizedName,
                    NOT: {
                        id: companyId
                    }
                }
            });

        if (duplicateCompany) {
            throw new Error(
                "COMPANY_NAME_ALREADY_EXISTS"
            );
        }
    }

    const company =
        await prisma.$transaction(
            async (tx) => {
                const updated =
                    await tx.company.update({
                        where: {
                            id: companyId
                        },

                        data: {
                            name:
                                normalizedName,

                            logoUrl:
                                logoUrl !== undefined
                                    ? logoUrl?.trim() ||
                                      null
                                    : existingCompany.logoUrl,

                            gstNumber:
                                gstNumber !== undefined
                                    ? gstNumber?.trim() ||
                                      null
                                    : existingCompany.gstNumber,

                            cinNumber:
                                cinNumber !== undefined
                                    ? cinNumber?.trim() ||
                                      null
                                    : existingCompany.cinNumber,

                            address:
                                address !== undefined
                                    ? address?.trim() ||
                                      null
                                    : existingCompany.address
                        }
                    });

                await tx.auditLog.create({
                    data: {
                        userId:
                            updatedByUserId,

                        action:
                            "COMPANY_UPDATED",

                        entity:
                            "Company",

                        entityId:
                            updated.id,

                        metadata: {
                            name:
                                updated.name
                        }
                    }
                });

                return updated;
            }
        );

    return company;
}


async function updateCompanyStatus(
    companyId,
    status,
    updatedByUserId
) {
    if (
        !["ACTIVE", "INACTIVE"].includes(
            status
        )
    ) {
        throw new Error(
            "INVALID_COMPANY_STATUS"
        );
    }

    const existingCompany =
        await prisma.company.findUnique({
            where: {
                id: companyId
            }
        });

    if (!existingCompany) {
        throw new Error(
            "COMPANY_NOT_FOUND"
        );
    }

    if (
        existingCompany.status === status
    ) {
        return existingCompany;
    }

    const company =
        await prisma.$transaction(
            async (tx) => {
                const updated =
                    await tx.company.update({
                        where: {
                            id: companyId
                        },

                        data: {
                            status
                        }
                    });

                await tx.auditLog.create({
                    data: {
                        userId:
                            updatedByUserId,

                        action:
                            status === "ACTIVE"
                                ? "COMPANY_ACTIVATED"
                                : "COMPANY_DEACTIVATED",

                        entity:
                            "Company",

                        entityId:
                            updated.id,

                        metadata: {
                            name:
                                updated.name
                        }
                    }
                });

                return updated;
            }
        );

    return company;
}


module.exports = {
    createCompany,
    getCompanies,
    getCompanyById,
    updateCompany,
    updateCompanyStatus
};
