import jwt from "jsonwebtoken";

export interface UserDetails {
    isValid: boolean,
    name?: string
};

export function getUserDetails(token: string | undefined) : UserDetails {
    if (!token) {
        return { isValid: false };
    }
    
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not set!");
    }

    try {
      const payload = jwt.verify(token, secret) as {name: string};
      console.log(`Session for ${payload.name} is active!`);

      return { name: payload.name, isValid: true };
    }
    catch {
      console.log("Not a valid session");
      return { isValid: false };
    }
}