// import {readFile,writeFile} from "fs/promises";
// import path from "path";

// const data_file = path.join("data", "links.json");

// export const loadlinks = async () => {
//     try 
//     {
//         const data = await readFile(data_file, "utf-8");
//         return JSON.parse(data);
//     } 
//     catch (error) 
//     {
//         if(error.code === "ENOENT")  // Error NO ENTry // means file is empty
//         {
//             await writeFile(data_file, JSON.stringify({}))
//             return {};
//         }
//         throw error; 
//     }
// };

// export const savelinks = async (links) => {
//     await writeFile(data_file, JSON.stringify(links));
// };

// import {con} from "../config/db-client.js";
// import { client } from "../config/db-client.js";

// const db = client.db("URL_Shortner");
// const shortnerCollection = db.collection("shortners");

export const loadlinks = async () => {
    // return await shortnerCollection.find().toArray();

    const [rows] = await con.execute("select * from short_links");
    return rows;
}

export const savelinks = async ({url, shortcode}) => {
    // return await shortnerCollection.insertOne(link);

    const [result] = await con.execute("insert into short_links (short_code, url) values (?,?)", [shortcode, url])
    return result;
}

export const getLinkByShortCode = async (shortcode) => {
    // return await shortnerCollection.findOne({shortcode: shortcode});
    const [result] = await con.execute(`select * from short_links where short_code = ?`,[shortcode]);
    
    if(result.length > 0)
        return result[0];
    else
        return null;
}