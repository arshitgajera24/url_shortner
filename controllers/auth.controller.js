import { email, safeParse } from "zod";
import { ACCESS_TOKEN_EXPIRY, OAUTH_EXCHANGE_EXPIRY, REFRESH_TOKEN_EXPIRY } from "../config/constant.js";
import { authenticateUser, clearResetPasswordToken, clearSession, clearVerifyEmailTokens, comparePassword, createAccessToken, createEmailLink, createRefreshToken, createResetPasswordLink, createSession, createUser, createUserWithOauth, findUserByEmail, findUserById, findVerificationEmailToken, generateRandomToken, getAllShortLinks, getResetPasswordToken, getUserByEmail, getUserWithOauthId, hashPassword, insertVerifyEmailToken, linkUserWithOauth, sendNewVerifyEmailLink, updateUserByName, updateUserPassword, verifyUserEmailAndUpdate } from "../services/auth.services.js";
import { forgotPasswordSchema, loginUserSchema, registerUserSchema, setPasswordSchema, verifyEmailSchema, verifyPasswordSchema, verifyResetPasswordSchema, verifyUserSchema } from "../validators/auth.validators.js";
import { getHtmlFromMjmlTemplate } from "../lib/get-html-from-mjml-template.js";
import { sendEmail } from "../lib/send-email.js";
import { decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { google } from "../lib/oauth/google.js";
import { github } from "../lib/oauth/github.js";


export const getRegisterPage = (req,res) => {
    if(req.user) return res.redirect("/");
    return res.render("auth/register", {errors: req.flash("error")});
}

export const postRegister = async (req, res) => {
    // console.log(req.body);
    if(req.user) return res.redirect("/");

    const { data, error } = registerUserSchema.safeParse(req.body);

    if(error)
    {
        const errors = error.issues[0].message;
        req.flash("error", errors);
        return res.redirect("/register");
    }

    const {name, email, password} = data;

    const userExists = await getUserByEmail(email);
    if(userExists) 
    {
        req.flash("error", "User Already Exists");
        return res.redirect("/register");
    }

    const hashedPassword = await hashPassword(password);

    const [user] = await createUser({name, email, password: hashedPassword});
    // res.redirect("/login");

    await authenticateUser({req, res, user, name, email});
    await sendNewVerifyEmailLink({userId: user.id, email});
}

export const getLoginPage = (req,res) => {
    if(req.user) return res.redirect("/");
    return res.render("auth/login", {errors: req.flash("error")});
}

export const postLogin = async (req,res) => {
    // res.setHeader("Set-Cookie","isLoggedIn=true; path=/;")
    if(req.user) return res.redirect("/");
    
    const { data, error } = loginUserSchema.safeParse(req.body);

    if(error)
    {
        const errors = error.issues[0].message;
        req.flash("error", errors);
        return res.redirect("/login");
    }

    const {email, password} = data;

    const user = await getUserByEmail(email);
    if(!user) 
    {
        req.flash("error", "Invalid Credentials");
        return res.redirect("/login");
    }

    if(!user.password)
    {
        req.flash("error", "You have Created account using social login. Please Login with your social Account");
        return res.redirect("/login");
    }
    
    const isPasswordValid = await comparePassword(password, user.password);

    if(!isPasswordValid) 
    {
        req.flash("error", "Invalid Credentials");
        return res.redirect("/login");
    }

    // res.cookie("isLoggedIn", true);

    // const token = generateToken({
    //     id: user.id,
    //     email: user.email,
    //     name: user.name
    // })

    // res.cookie("access_token", token);

    await authenticateUser({req, res, user});       
}

export const getMe = (req, res) => {
    if(!req.user) return res.send("<h1>Not Logged In</h1>");
    return res.send(`<h1>Hey ${req.user.name} - ${req.user.email}</h1>`);
}

export const logoutUser = async (req, res) => {

    await clearSession(req.user.sessionId);

    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    return res.redirect("/");
}

export const getProfilePage = async (req, res) => {
    if(!req.user) return res.redirect("/login");

    const user = await findUserById(req.user.id);
    if(!user) return res.redirect("/login");

    const userShortLinks = await getAllShortLinks(user.id);
    return res.render("auth/profile", {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            isEmailValid: user.isEmailValid,
            hasPassword: Boolean(user.password),
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
            links: userShortLinks,
        },
    })
}

export const getVerifyEmailPage = async (req, res) => {
    if(!req.user) return res.redirect("/");

    const user = await findUserById(req.user.id);
    if(!user || user.isEmailValid) return res.redirect("/");

    return res.render("auth/verify-email", {
        email: req.user.email,
    });
}

export const resendVerificationLink = async (req,res) => {
    if(!req.user) return res.redirect("/");

    const user = await findUserById(req.user.id);
    if(!user || user.isEmailValid) return res.redirect("/");

    await sendNewVerifyEmailLink({userId: req.user.id, email: req.user.email});

    res.redirect("/verify-email");
}


export const verifyEmailToken = async (req, res) => {
    const { data, error } = verifyEmailSchema.safeParse(req.query);

    if(error) return res.send("Verification Link is Invalid or Expired!!!");

    const [token] = await findVerificationEmailToken(data);
    console.log("🚀 ~ Verify Email Token : ", token);

    if(!token) res.send("Verification Link is Invalid or Expired!");
    
    await verifyUserEmailAndUpdate(token.email);

    clearVerifyEmailTokens(token.userId).catch(console.error);

    return res.redirect("/profile");
}


export const getEditProfilePage = async (req, res) => {
    if(!req.user) return res.redirect("/");

    const user = await findUserById(req.user.id);
    if(!user) return res.status(404).send("User not Found");

    return res.render("auth/edit-profile", {
        name: user.name,
        avatarUrl: user.avatarUrl,
        errors: req.flash("error"),
    })
}

export const postEditProfile = async (req, res) => {
    if(!req.user) return res.redirect("/");

    const {data, error} = verifyUserSchema.safeParse(req.body);

    if(error)
    {
        const errorMsgs = error.issues.map((err) => err.message);
        req.flash("error", errorMsgs);
        return res.redirect("/edit-profile");
    }

    const fileUrl = req.file ? `uploads/avatar/${req.file.filename}` : undefined;

    await updateUserByName({userId: req.user.id, name: data.name, avatarUrl: fileUrl});
    return res.redirect("/profile");
}

export const getChangePasswordPage = (req,res) => {
    if(!req.user) return res.redirect("/");

    return res.render("auth/change-password", {
        errors: req.flash("error"),
    });
}

export const postChangePassword = async (req, res) => {
    const { data, error } = verifyPasswordSchema.safeParse(req.body);

    if(error)
    {
        const errorMsgs = error.issues.map((err) => err.message);
        req.flash("error", errorMsgs);
        return res.redirect("/change-password");
    }

    const { currentPassword, newPassword } = data;

    const user = await findUserById(req.user.id);
    if(!user) return res.status(404).send("User not Found");

    const isPasswordValid = await comparePassword(currentPassword, user.password);
    
    if(!isPasswordValid) 
    {
        req.flash("error", "Current Password that you Entered is Invalid");
        return res.redirect("/change-password");
    }

    await updateUserPassword({userId: user.id, newPassword});

    return res.redirect("/profile");
}

export const getResetPasswordPage = async (req, res) => {
    return res.render("auth/forgot-password", {
        formSubmitted: req.flash("formSubmitted")[0],
        errors: req.flash("error"),
    });
}

export const postForgotPassword = async (req, res) => {
    const { data, error } = await forgotPasswordSchema.safeParse(req.body);

    if(error)
    {
        const errorMsgs = error.issues.map((err) => err.message);
        req.flash("error", errorMsgs[0]);
        return res.redirect("/reset-password");
    }

    const user = await findUserByEmail(data.email);

    if(user) 
    {
        const resetPasswordLink = await createResetPasswordLink({userId: user.id});

        const html = await getHtmlFromMjmlTemplate("reset-password-email", {
            name: user.name,
            link: resetPasswordLink,
        })

        sendEmail({
            to: user.email,
            subject: "Reset Your Password",
            html,
        })

    }
    req.flash("formSubmitted", true);
    return res.redirect("/reset-password");
}

export const getResetPasswordTokenPage = async (req, res) => {
    const {token} = req.params;

    const passwordResetData = await getResetPasswordToken(token);
    if(!passwordResetData) return res.render("auth/wrong-reset-password-token");

    return res.render("auth/reset-password", {
        formSubmitted: req.flash("formSubmitted")[0],
        errors: req.flash("error"),
        token,
    })
}

export const postResetPasswordToken = async (req, res) => {
    const {token} = req.params;

    const passwordResetData = await getResetPasswordToken(token);
    if(!passwordResetData) 
    {   
        req.flash("error", "Password Token is not Matching");
        return res.render("auth/wrong-reset-password-token");
    }

    const {data, error} = verifyResetPasswordSchema.safeParse(req.body);
    if(error)
    {
        const errorMsgs = error.issues.map((err) => err.message);
        req.flash("error", errorMsgs[0]);
        return res.redirect(`/reset-password/${token}`);
    }

    const {newPassword} = data;

    const user = await findUserById(passwordResetData.userId);

    await clearResetPasswordToken(user.id);

    await updateUserPassword({userId: user.id, newPassword});

    return res.redirect("/login");
}

export const getGoogleLoginPage = async (req, res) => {
    if(req.user) return res.redirect("/");
    
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = google.createAuthorizationURL(state, codeVerifier, [
        "openid",
        "profile",
        "email",
    ])

    const cookieConfig = {
        httpOnly: true,
        secure: true,
        maxAge: OAUTH_EXCHANGE_EXPIRY,
        sameSite: "lax",
    }

    res.cookie("google_oauth_state", state, cookieConfig);
    res.cookie("google_code_verifier", codeVerifier, cookieConfig);

    res.redirect(url.toString());
}

export const getGoogleLoginCallback = async (req, res) => {
    const { code, state } = req.query; 

    const { 
        google_oauth_state: storedState,
        google_code_verifier: codeVerifier,
    } = req.cookies;

    function handleFailedLoginGoogle(req, res)
    {
        req.flash("error", "Couldn't Login with Google because of Invalid Login Attempt. Please Try Again!");
        return res.redirect("/login");
    }

    if(!code || !state || !storedState || !codeVerifier || state !== storedState)
    {
        return handleFailedLoginGoogle(req, res);
    }

    let tokens;
    try {
        tokens = await google.validateAuthorizationCode(code, codeVerifier);
    } catch {
        return handleFailedLoginGoogle(req, res);
    }
    // console.log("Token Google : ", tokens);
    
    const claims = decodeIdToken(tokens.idToken());
    const { sub: googleUserId, name, email, picture } = claims;


    let user = await getUserWithOauthId({
        provider: "google",
        email,
    })

    if(user && !user.providerAccountId)
    {
        await linkUserWithOauth({
            userId: user.id,
            provider: "google",
            providerAccountId: googleUserId,
            avatarUrl: picture,
        })
    }

    if(!user)
    {
        user = await createUserWithOauth({
            name, 
            email,
            provider: "google",
            providerAccountId: googleUserId,
            avatarUrl: picture,
        })
    }

    await authenticateUser({ req, res, user, name, email });

    res.redirect("/");
}

export const getGithubLoginPage = async (req, res) => {
    if(req.user) return res.redirect("/");
    
    const state = generateState();
    const url = github.createAuthorizationURL(state, ["user:email"]);

    const cookieConfig = {
        httpOnly: true,
        secure: true,
        maxAge: OAUTH_EXCHANGE_EXPIRY,
        sameSite: "lax",
    }

    res.cookie("github_oauth_state", state, cookieConfig);

    res.redirect(url.toString());
}

export const getGithubLoginCallback = async (req, res) => {

    const { code, state } = req.query; 
    const { github_oauth_state: storedState } = req.cookies;

    function handleFailedLoginGithub(req, res)
    {
        req.flash("error", "Couldn't Login with Github because of Invalid Login Attempt. Please Try Again!");
        return res.redirect("/login");
    }

    if(!code || !state || !storedState || state !== storedState)
    {
        return handleFailedLoginGithub(req, res);
    }

    let tokens;
    try {
        tokens = await github.validateAuthorizationCode(code);
    } catch {
        return handleFailedLoginGithub(req, res);
    }
    // console.log("Token Google : ", tokens);

    const githubUserResponse = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${tokens.accessToken()}`,
        }
    })

    if(!githubUserResponse.ok) return handleFailedLoginGithub(req, res);
    const githubUser = await githubUserResponse.json();    
    const { id: githubUserId, name, avatar_url } = githubUser;


    const githubEmailResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
            Authorization: `Bearer ${tokens.accessToken()}`,
        }
    })
    
    if(!githubEmailResponse.ok) return handleFailedLoginGithub(req, res);
    const emails = await githubEmailResponse.json();
    const email = emails.filter((e) => e.primary)[0].email;    
    if(!email) return handleFailedLoginGithub(req, res);


    let user = await getUserWithOauthId({
        provider: "github",
        email,
    })

    if(user && !user.providerAccountId)
    {
        await linkUserWithOauth({
            userId: user.id,
            provider: "github",
            providerAccountId: githubUserId,
            avatarUrl: avatar_url,
        })
    }

    if(!user)
    {
        user = await createUserWithOauth({
            name, 
            email,
            provider: "github",
            providerAccountId: githubUserId,
            avatarUrl: avatar_url,
        })
    }

    await authenticateUser({ req, res, user, name, email });

    res.redirect("/");
}

export const getSetPasswordPage = async (req, res) => {
    if(!req.user) return res.redirect("/");

    res.render("auth/set-password", {
        errors: req.flash("error"),
    });
}

export const postSetPassword = async (req, res) => {
    if(!req.user) return res.redirect("/");
    const { data, error } = setPasswordSchema.safeParse(req.body);

    if(error)
    {
        const errorMsgs = error.issues.map((err) => err.message);
        req.flash("error", errorMsgs);
        return res.redirect(`/set-password`);
    }

    const { newPassword } = data;

    const user = await findUserById(req.user.id);
    if(user.password)
    {
        req.flash("error", "You Already have Your Password, Instead Change your Password");
        return res.redirect("/set-password");
    }

    await updateUserPassword({userId: req.user.id, newPassword});

    return res.redirect("/profile");
}

export const getAboutPage = async (req, res) => {
    if(!req.user) return res.redirect("/");

    res.render("auth/about");
}

export const getContactPage = async (req, res) => {
    if(!req.user) return res.redirect("/");

    res.render("auth/contact");
}