import {readFile,writeFile} from "fs/promises";
import { createServer } from "http";
import crypto from "crypto";
import path from "path";
import express from "express";

const app = express();

const PORT = process.env.PORT || 3005;
const data_file = path.join("data", "links.json");

app.use(express.static("public"));
app.use(express.urlencoded({extended:true}));

const servefile = async (res, filepath, contenttype) => {
    try 
    {
        const data = await readFile(filepath)
        res.writeHead(200,{"Content-Type": contenttype});
        res.end(data);
    } 
    catch (error) 
    {
        res.writeHead(404,{"Content-Type":"text/plain"});
        res.end("404 Page Not Found");
    }
}

const loadlinks = async () => {
    try 
    {
        const data = await readFile(data_file, "utf-8");
        return JSON.parse(data);
    } 
    catch (error) 
    {
        if(error.code === "ENOENT")  // Error NO ENTry // means file is empty
        {
            await writeFile(data_file, JSON.stringify({}))
            return {};
        }
        throw error; 
    }
};

const savelinks = async (links) => {
    await writeFile(data_file, JSON.stringify(links));
};


app.get("/", async (req,res) => {
    try
    {
        const file = await readFile(path.join("views","index.html"));
        const links = await loadlinks();

        const content = file.toString().replaceAll("{{ shorten_urls }}",Object.entries(links).map(([shortcode, url]) => `<li><a href="/${shortcode}" target="_blank">${req.host}/${shortcode}</a> - ${url}</li>`).join(""));
        
        return res.send(content);
    }
    catch(error)
    {
        console.log(error);
        return res.status(500).send("Internal Server Error !");
    }
})

app.post("/", async (req,res) => {
    try 
    {
        const {url, shortcode} = req.body;

        const finalshortcode = shortcode || crypto.randomBytes(4).toString("hex");
        const links = await loadlinks();
        if(links[finalshortcode])
        {
            return res.status(400).send("Short Code is Already Exist, Please Choose Another");
        }
        links[finalshortcode] = url;
        await savelinks(links);
        return res.redirect("/");
    } 
    catch (error)
    {
        console.log(error);
        return res.status(500).send("Internal Server Error !");
    }
})

app.get("/:shortcode", async (req,res) => {
    try
    {
        const { shortcode } = req.params;
        const links = await loadlinks();

        if(!links[shortcode]) 
            return res.status(404).send("404 Error Occured");
        
        return res.redirect(links[shortcode]);
    }
    catch(error)
    {
        console.log(error);
        return res.status(500).send("Internal Server Error !");
    }
})

app.listen(PORT, () => {
    console.log(`Server Running at localhost:${PORT}`);
});

