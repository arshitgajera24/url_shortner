import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import {db} from "../config/db.js";
import { oauthAccountsTable, passwordResetTokensTable, sessionsTable, short_links, usersTable, verifyEmailTokenTable } from "../drizzle/schema.js";
// import bcrypt from "bcrypt";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { ACCESS_TOKEN_EXPIRY, MILLISECONDS_PER_SECOND, REFRESH_TOKEN_EXPIRY } from "../config/constant.js";
import path from "path";
import fs from "fs/promises";
import mjml2html from "mjml";
import ejs from "ejs";
import { sendEmail } from "../lib/send-email.js";

export const getUserByEmail = async (email) => {
    const [result] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    return result;
}

export const createUser = async ({name, email, password}) => {
    return await db.insert(usersTable).values({name, email, password}).$returningId();
}

export const hashPassword = async (password) => {
    // return await bcrypt.hash(password, 10);
    return await argon2.hash(password);
}

export const comparePassword = async (password, hash) => {
    // return await bcrypt.compare(password, hash);
    return await argon2.verify(hash, password);
}

// export const generateToken = ({id, name, email}) => {
//     return jwt.sign({id, name, email}, process.env.JWT_SECRET, {
//         expiresIn: "30d",
//     })
// }

export const createSession = async (userId, { ip, userAgent }) => {
    const [session] = await db.insert(sessionsTable).values({userId, ip, userAgent}).$returningId();
    return session;
}

export const createAccessToken = ({id, name, email, sessionId}) => {
    return jwt.sign({id, name, email, sessionId}, process.env.JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY / MILLISECONDS_PER_SECOND,   // 15 min
    })
}

export const createRefreshToken = (sessionId) => {
    return jwt.sign({ sessionId }, process.env.JWT_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRY / MILLISECONDS_PER_SECOND,   // 1 week
    })
}

export const verifyJWTToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
}

export const findSessionById = async (sessionId) => {
    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
    return session;
}

export const findUserById = async (userId) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    return user;
}

export const refreshTokens = async (refreshToken) => {
    try {
        const decodedToken = verifyJWTToken(refreshToken);
        const currentSession = await findSessionById(decodedToken.sessionId);

        if(!currentSession || !currentSession.valid) throw new Error("Invalid Session");

        const user = await findUserById(currentSession.userId);

        if(!user) throw new Error("User not found");

        const userInfo = {
            id: user.id,
            name: user.name,
            email: user.email,
            isEmailValid: user.isEmailValid,
            sessionId: currentSession.id,
        }

        const newAccessToken = createAccessToken(userInfo);
        const newRefreshToken = createRefreshToken(currentSession.id);

        return {
            newAccessToken,
            newRefreshToken,
            user: userInfo,
        }

    } catch (error) {
        console.log(error.message);
    }
}

export const clearSession = async (sessionId) => {
    return await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
}

export const authenticateUser = async ({req, res, user, name, email}) => {

    const session = await createSession(user.id, {
            ip: req.clientIp,
            userAgent: req.headers["user-agent"],
        })
    
        const accessToken = createAccessToken({
            id: user.id,
            name: user.name || name,
            email: user.email || email,
            isEmailValid: false,
            sessionId: session.id,
        })
    
        const refreshToken = createRefreshToken(session.id);
    
        const baseConfig = { httpOnly: true, secure: true };
    
        res.cookie("access_token", accessToken, {
            ...baseConfig,
            maxAge: ACCESS_TOKEN_EXPIRY,
        })
    
        res.cookie("refresh_token", refreshToken, {
            ...baseConfig,
            maxAge: REFRESH_TOKEN_EXPIRY,
        })
        
        return res.redirect("/");
}

export const getAllShortLinks = async (userId) => {
    return await db.select().from(short_links).where(eq(short_links.userId, userId));
}


export const generateRandomToken = (digit = 8) => {
    const min = 10 ** (digit - 1);
    const max = 10 ** digit;

    return crypto.randomInt(min, max).toString();
}

export const insertVerifyEmailToken = async ({userId, token}) => {

    return db.transaction(async (tx) => {
        try
        {
            await tx.delete(verifyEmailTokenTable).where(lt(verifyEmailTokenTable.expiresAt, sql`CURRENT_TIMESTAMP`));
            await tx.delete(verifyEmailTokenTable).where(eq(verifyEmailTokenTable.userId, userId));
            await tx.insert(verifyEmailTokenTable).values({userId, token});
        }
        catch(error)
        {
            console.error("Failed to Insert Verification Token : ", error);
            throw new Error("Unable to Create Verification Token");
        }
    });

}

export const createEmailLink = async ({email, token}) => {
    // const uniEncodedEmail = encodeURIComponent(email);
    // return `${process.env.FRONTEND_URL}/verify-email-token?token=${token}&email=${uniEncodedEmail}`;

    const url = new URL(`${process.env.FRONTEND_URL}/verify-email-token`);

    url.searchParams.append("token", token);
    url.searchParams.append("email", email);

    return url.toString();
}


export const findVerificationEmailToken = async ({token, email}) => {
    return db.select({
        userId: usersTable.id,
        email: usersTable.email,
        token: verifyEmailTokenTable.token,
        expiresAt: verifyEmailTokenTable.expiresAt,
    }).from(verifyEmailTokenTable).where(and(eq(verifyEmailTokenTable.token, token), eq(usersTable.email, email), gte(verifyEmailTokenTable.expiresAt, sql`CURRENT_TIMESTAMP`))).innerJoin(usersTable, eq(verifyEmailTokenTable.userId, usersTable.id));
}

export const verifyUserEmailAndUpdate = async (email) => {
    return db.update(usersTable).set({isEmailValid: true}).where(eq(usersTable.email, email));
}

export const clearVerifyEmailTokens = async (userId) => {    
    return await db.delete(verifyEmailTokenTable).where(eq(verifyEmailTokenTable.userId, userId));
}

export const sendNewVerifyEmailLink = async ({userId, email}) => {
    const randomToken = generateRandomToken();
    
    await insertVerifyEmailToken({userId, token: randomToken});
    
    const verifyEmailLink = await createEmailLink({
        email,
        token: randomToken,
    })
    
    const mjmlTemplate = await fs.readFile(path.join(import.meta.dirname,"..","emails","verify-email.mjml"), "utf-8");

    const filledTemplate = ejs.render(mjmlTemplate, {code: randomToken, link: verifyEmailLink});

    const htmlOutput = mjml2html(filledTemplate).html;

    sendEmail({
        to: email,
        subject: "Verify Your Email",
        html: htmlOutput,
    }).catch(console.error);
}

export const updateUserByName = async ({userId, name, avatarUrl}) => {
    return await db.update(usersTable).set({name, avatarUrl}).where(eq(usersTable.id, userId));
}

export const updateUserPassword = async ({userId, newPassword}) => {
    const newHashPassword = await hashPassword(newPassword);

    return await db.update(usersTable).set({password: newHashPassword}).where(eq(usersTable.id, userId));
}

export const findUserByEmail = async (email) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    return user;
}

export const createResetPasswordLink = async ({userId}) => {
    const randomToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto.createHash("sha256").update(randomToken).digest("hex");

    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, userId));

    await db.insert(passwordResetTokensTable).values({ userId, tokenHash });

    return `${process.env.FRONTEND_URL}/reset-password/${randomToken}`;
}

export const getResetPasswordToken = async (token) => {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const [data] = await db.select().from(passwordResetTokensTable).where(and(eq(passwordResetTokensTable.tokenHash, tokenHash), gte(passwordResetTokensTable.expiresAt, sql`CURRENT_TIMESTAMP`)));
    return data;
}

export const clearResetPasswordToken = async (userId) => {
    return await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, userId));
}

export async function getUserWithOauthId({email, provider})
{
    const [user] = await db.select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        isEmailValid: usersTable.isEmailValid,
        providerAccountId: oauthAccountsTable.providerAccountId,
        provider: oauthAccountsTable.provider,
    }).from(usersTable).where(eq(usersTable.email, email)).leftJoin(oauthAccountsTable, and(eq(oauthAccountsTable.provider, provider), eq(oauthAccountsTable.userId, usersTable.id)));

    return user;
}

export async function linkUserWithOauth({userId, provider, providerAccountId, avatarUrl})
{
    await db.insert(oauthAccountsTable).values({userId, provider, providerAccountId});

    if(avatarUrl)
    {
        await db.update(usersTable).set({avatarUrl}).where(and(eq(usersTable.id, userId), isNull(usersTable.avatarUrl)));
    }
}

export async function createUserWithOauth({name, email, provider, providerAccountId, avatarUrl})
{
    const user = await db.transaction(async (tx) => {
        const [user] = await tx.insert(usersTable).values({email, name, avatarUrl, isEmailValid: true}).$returningId();
        await tx.insert(oauthAccountsTable).values({provider, providerAccountId, userId: user.id});

        return {
            id: user.id,
            name,
            email,
            isEmailValid: true,
            provider,
            providerAccountId,
        }
    })

    return user;
}