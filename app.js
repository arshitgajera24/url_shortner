import cookieParser from "cookie-parser";
import express from "express";
import flash from "connect-flash";
import requestIp from "request-ip";
import session from "express-session";

import { authRoute } from "./routes/auth.routes.js";
import { veryfyAuthentication } from "./middleware/verify.middleware.js";
import { shorten_urls_routes } from "./routes/shortner.routes.js"

const app = express();

const PORT = process.env.PORT || 3005;

app.use(express.static("public"));
app.use(express.urlencoded({extended:true}));

app.set("view engine", "ejs");
app.set("views", "./views");

app.use(cookieParser());

app.use(session({
    secret: "my_secret",
    resave:true,
    saveUninitialized: false,
}))
app.use(flash());

app.use(requestIp.mw());

app.use(veryfyAuthentication);

app.use((req, res, next) => {
    res.locals.user = req.user;
    return next();
})

// app.use(router);

app.use(authRoute);
app.use(shorten_urls_routes);

app.listen(PORT, () => {
    console.log(`Server Running at localhost:${PORT}`);
});
