import { readFile, writeFile } from "fs/promises";
import { createServer } from "http";
import crypto from "crypto";
import path from "path";

const PORT = 3005;
const data_file = path.join("data", "links.json");

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

const server = createServer(async (req,res) => {
    if(req.method === "GET")
    {
        if(req.url === "/")
        {
            servefile(res, path.join("public","index.html"), "text/html");
        }
        else if(req.url === "/style.css")
        {
            servefile(res, path.join("public","style.css"), "text/css");
        }
        else if(req.url === "/links")
        {
            const links = await loadlinks();

            res.writeHead(200, {"Content-Type":"application/json"});
            return res.end(JSON.stringify(links));
        }
        else 
        {
            const links = await loadlinks();
            const shortcode = req.url.slice(1); // removes Slash from first position
            if(links[shortcode])
            {
                res.writeHead(302, {location : links[shortcode]})
                return res.end();
            }

            res.writeHead(404, {"Content-Type" : "text/plain"})
            return res.end("Shorten URL is not Found");
        }
    }

    if(req.method === "POST" && req.url === "/shorten")
    {
        const links = await loadlinks();

        let body = "";
        req.on("data", (chunk) => (body += chunk));

        req.on('end', async () => {
            console.log(body);
            const {url, shortcode} = JSON.parse(body);

            if(!url)
            {
                res.writeHead(400, {"Content-Type" : "text/plain"})
                return res.end("URL is Required");
            }

            const finalshortcode = shortcode || crypto.randomBytes(4).toString("hex");
            if(links[finalshortcode])
            {
                res.writeHead(400, {"Content-Type" : "text/plain"})
                return res.end("Short Code is Already Exist, Please Choose Another");
            }

            links[finalshortcode] = url;
            await savelinks(links);
            res.writeHead(200, {"Content-Type" : "application/json"});
            res.end(JSON.stringify({success:true, shortcode:finalshortcode}));
        });
    }
})

server.listen(PORT, () => {
    console.log(`Server Running at http://localhost:${PORT}`);
})



//git add .
//git commit -m "initial commit"
//git push -u origin main