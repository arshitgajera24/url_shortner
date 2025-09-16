import {Router} from "express";
import { postURLShortner, getURLshortner, getshortcodeURL, getShortnerEditPage, shortnerEditPage, deleteShortCode } from "../controllers/postURLshortner.controller.js";

const router = Router();

router.get("/", getURLshortner);

router.post("/", postURLShortner);

router.get("/:shortcode", getshortcodeURL);

router.route("/edit/:id").get(getShortnerEditPage).post(shortnerEditPage);

router.route("/delete/:id").post(deleteShortCode);

// default export
// export default router;

// named export
export const shorten_urls_routes = router;
