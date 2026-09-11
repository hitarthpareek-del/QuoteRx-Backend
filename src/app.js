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

const clientRoutes =
    require("./modules/clients/routes/client.routes");

    const quotationRoutes =
    require("./modules/quotations/routes/quotation.routes");


const app = express();


/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

app.use(cors());

app.use(
    express.json({
        limit: "15mb"
    })
);


/*
|--------------------------------------------------------------------------
| Root
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
    res.json({
        success: true,
        message:
            "Quotation Backend API is running"
    });
});


/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

app.use(
    "/api/health",
    healthRoutes
);

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

app.use(
    "/api/users",
    userRoutes
);

app.use(
    "/api/companies",
    companyRoutes
);

app.use(
    "/api/clients",
    clientRoutes
);

app.use(
    "/api/quotations",
    quotationRoutes
);


module.exports = app;