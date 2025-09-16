// import { PrismaClient } from "@prisma/client";
// const prisma = new PrismaClient();

import { count, desc, eq } from "drizzle-orm";
import {db} from "../config/db.js";
import { short_links } from "../drizzle/schema.js";

export const loadlinks = async ({userId, limit=10, offset=0}) => {
    // return await shortnerCollection.find().toArray();

    // const [rows] = await con.execute("select * from short_links");
    // return rows;

    // const allShortLinks = await prisma.short_links.findMany();
    // return allShortLinks;

    const links = await db.select().from(short_links).where(eq(short_links.userId, userId)).orderBy(desc(short_links.createdAt)).limit(limit).offset(offset);
    const [{totalCount}] = await db.select({totalCount: count()}).from(short_links).where(eq(short_links.userId, userId));

    return {links, totalCount};
}

export const savelinks = async ({url, finalshortcode, userId}) => {
    // return await shortnerCollection.insertOne(link);

    // const [result] = await con.execute("insert into short_links (short_code, url) values (?,?)", [shortcode, url])
    // return result;

    // const newShortLink = await prisma.short_links.create({
    //     data: {
    //         short_code: shortcode, 
    //         url,
    //     }
    // })
    // return newShortLink;

    await db.insert(short_links).values({
        short_code: finalshortcode,
        url: url,
        userId: userId,
    })
}

export const getLinkByShortCode = async (shortcode) => {
    // return await shortnerCollection.findOne({shortcode: shortcode});

    // const [result] = await con.execute(`select * from short_links where short_code = ?`,[shortcode]);

    // const shortLink = await prisma.short_links.findUnique({
    //     where: {short_code : shortcode},
    // })
    // return shortLink;

    const [result] = await db.select().from(short_links).where(eq(short_links.short_code, shortcode));
    return result;
}


export const findShortLinkById = async (id) => {
    const [result] = await db.select().from(short_links).where(eq(short_links.id, id));
    return result;
}

export const updateShortCode = async ({id, url, shortcode}) => {
    return await db.update(short_links).set({url, short_code: shortcode}).where(eq(short_links.id, id));
}

export const deleteShortCodeById = async (id) => {
    return await db.delete(short_links).where(eq(short_links.id, id));
}