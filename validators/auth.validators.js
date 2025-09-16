import z from "zod";

export const nameSchema = z.string({required_error: "Name is Required"}).trim().min(3, {message: "Name is Required With Atleast 3 Characters"}).max(100, {message: "Name Must be no more than 100 Characters"})
export const emailSchema = z.string().trim().min(1, {message: "Email is Required"}).email({message: "Please Enter a Valid Email Address"}).max(100, {message: "Name Must be no more than 100 Characters"});

export const loginUserSchema = z.object({
    email: emailSchema,
    password: z.string().trim().min(6, {message: "Password is Required With Atleast 6 Characters"}).max(100, {message: "Password Must be no more than 100 Characters"}),
})

export const registerUserSchema = loginUserSchema.extend({
    name: nameSchema,
})

export const verifyEmailSchema = z.object({
    token: z.string().trim().length(8),
    email: z.string().trim().email(),
})

export const verifyUserSchema = z.object({
    name: nameSchema,
})

export const verifyPasswordSchema = z.object({
    currentPassword: z.string().min(1, { message: "Current Password is Required" }),
    newPassword: z.string().min(6, {message: "New Password is Required With Atleast 6 Characters"}).max(100, {message: "New Password Must be no more than 100 Characters"}),
    confirmPassword: z.string().min(6, {message: "Confirm Password is Required With Atleast 6 Characters"}).max(100, {message: "Confirm Password Must be no more than 100 Characters"}),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Password don't Match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
    email: emailSchema,
})

const passwordSchema = z.object({
    newPassword: z.string().min(6, {message: "New Password is Required With Atleast 6 Characters"}).max(100, {message: "New Password Must be no more than 100 Characters"}),
    confirmPassword: z.string().min(6, {message: "Confirm Password is Required With Atleast 6 Characters"}).max(100, {message: "Confirm Password Must be no more than 100 Characters"}),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Password don't Match",
    path: ["confirmPassword"],
  });

export const verifyResetPasswordSchema = passwordSchema;
export const setPasswordSchema = passwordSchema;