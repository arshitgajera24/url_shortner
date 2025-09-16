import z from "zod";

export const urlShortnerSchema = z.object({
    url: z.string().trim().url({message: "Please Enter a Valid URL"}).max(1024, { message: "URL cannot be longer than 1024 characters." }),
    shortcode: z.string().trim().min(2, {message: "Short Code Must be Atlease 2 Characters Long"}).max(100, {message: "Short Code Must be no more than 100 Characters"}),
})

export const shortnerSearchParamsSchema = z.object({
    page: z.coerce.number().int().positive().min(1).optional().default(1).catch(1)
})