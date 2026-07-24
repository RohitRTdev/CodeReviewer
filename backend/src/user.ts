import { Router } from "express";
import { getUserDetails } from './utils.js';

const router = Router();

router.get("/getUser", (req, res) => {
    const token = req.cookies?.jwt;
    
    const result = getUserDetails(token);
    if (result.isValid) {
        res.send(result.name);
    }    
    else {
        res.sendStatus(404);
    }
});

export default router;
