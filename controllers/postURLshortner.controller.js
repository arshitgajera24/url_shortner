import crypto from "crypto";
import { deleteShortCodeById, findShortLinkById, getLinkByShortCode, loadlinks, savelinks, updateShortCode } from "../services/shortner.services.js";
import { shortnerSearchParamsSchema, urlShortnerSchema } from "../validators/shorter.validators.js";
import z from "zod";
// import { getLinkByShortCode, loadlinks, savelinks } from "../models/URLshortner.models.js";

export const getURLshortner = async (req,res) => {
    try
    {
        if(!req.user) return res.redirect("/login");
        // const links = await loadlinks(req.user.id);

        const searchParams = shortnerSearchParamsSchema.parse(req.query);
        const { links, totalCount } = await loadlinks({
            userId: req.user.id,
            limit: 10,
            offset: (searchParams.page - 1) * 10,
        })

        const totalPages = Math.ceil(totalCount / 10);
        
        res.render("index", {
            links,
            host: req.host,
            currentPage: searchParams.page,
            totalPages,
            errors: req.flash("error")
        });
    }
    catch(error)
    {
        console.log(error);
        return res.status(500).send("Internal Server Error !");
    }
};

export const postURLShortner = async (req,res) => {
    try 
    {
        if(!req.user) return res.redirect("/login");
        // const {url, shortcode} = req.body;
        
        const { data, error } = urlShortnerSchema.safeParse(req.body);

        if(error)
        {
            const errors = error.issues[0].message;
            req.flash("error", errors);
            return res.redirect("/");
        }

        const {url, shortcode} = data;

        const finalshortcode = shortcode || crypto.randomBytes(4).toString("hex");
        // const links = await loadlinks();
        const links = await getLinkByShortCode(shortcode);
        if(links)
        {
            req.flash("error", "Short Code is Already Exist, Please Choose Another");
            return res.redirect("/");
            // return res.status(400).send("Short Code is Already Exist, Please Choose Another");
        }
        // links[finalshortcode] = url;
        // await savelinks(links);
        await savelinks({url, finalshortcode, userId: req.user.id});
        return res.redirect("/");
    } 
    catch (error)
    {
        console.log(error);
        return res.status(500).send("Internal Server Error !");
    }
};

export const getshortcodeURL = async (req,res) => {
    try
    {
        const { shortcode } = req.params;
        // const links = await loadlinks();

        // if(!links[shortcode]) 
        // {
        //     return res.status(404).send("404 Error Occured");
        // }

        const link = await getLinkByShortCode(shortcode);
        if(!link) return res.status(404).send("404 Error Occured");
        
        return res.redirect(link.url);
    }
    catch(error)
    {
        console.log(error);
        return res.status(500).send("Internal Server Error !");
    }
};


export const getShortnerEditPage = async (req, res) => {
    if(!req.user) return res.redirect("/login");
    // const id = req.params;
    const { data: id, error } = z.coerce.number().int().safeParse(req.params.id);
    if(error) return res.redirect("/404");

    try 
    {
        const shortLink = await findShortLinkById(id);
        
        if(!shortLink) return res.redirect("/404");

        res.render("edit-shortLink", {
            id: shortLink.id,
            url: shortLink.url,
            shortcode: shortLink.short_code,
            errors: req.flash("error"),
        });
    } 
    catch (error) 
    {
        console.error(error);
        return res.status(500).send("Internal Server Error !!!");
    }
}

export const shortnerEditPage = async (req, res) => {
    if(!req.user) return res.redirect("/login");
    // const id = req.params;
    const { data: id, error } = z.coerce.number().int().safeParse(req.params.id);
    if(error) return res.redirect("/404");

    try 
    {
        const { url, shortcode } = req.body;
        const newUpdatedShortCode = await updateShortCode({id, url, shortcode});
        
        if(!newUpdatedShortCode) return res.redirect("/404");

        return res.redirect("/");
    }
    catch (error) 
    {
        if(error.cause.code == 'ER_DUP_ENTRY')
        {
            req.flash("error", "Short Code is Already Exist, Please Choose Another");
            return res.redirect(`/edit/${id}`);
        }
        console.error(error);
        return res.status(500).send("Internal Server Error !!!");
    }
}


export const deleteShortCode = async (req, res) => {
    if(!req.user) return res.redirect("/login");
    try
    {
        const { data: id, error } = z.coerce.number().int().safeParse(req.params.id);
        if(error) return res.redirect("/404");

        await deleteShortCodeById(id);
        return res.redirect("/");
    }
    catch (error) 
    {
        console.error(error);
        return res.status(500).send("Internal Server Error !!!");
    }
}
