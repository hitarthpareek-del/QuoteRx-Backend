const express = require("express");
const cors = require("cors");

const healthRoutes =
    require("./modules/health/routes/health.routes");

const authRoutes =
    require("./modules/auth/routes/auth.routes");

const passwordSetupRoutes =
    require("./modules/auth/routes/password-setup.routes");

const passwordResetRoutes =
    require("./modules/auth/routes/password-reset.routes");

const userRoutes =
    require("./modules/users/routes/user.routes");

const companyRoutes =
    require("./modules/companies/routes/company.routes");

const app = express();

app.use(cors());
app.use(express.json());

/*
 * Root
 */
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Quotation Backend API is running"
    });
});

/*
 * Health
 */
app.use(
    "/api/health",
    healthRoutes
);

/*
 * Authentication
 */
app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/auth",
    passwordSetupRoutes
);

app.use(
    "/api/auth",
    passwordResetRoutes
);

/*
 * Users
 */
app.use(
    "/api/users",
    userRoutes
);

/*
 * Companies
 */
app.use(
    "/api/companies",
    companyRoutes
);

module.exports = app;