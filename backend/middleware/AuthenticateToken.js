import jwt from 'jsonwebtoken';
import { secretKey } from '../config.js';

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];

    if(!token) {
        return res.status(403).json({ message: 'Access denied. No token provided'});
    }

    jwt.verify(token, secretKey, (error, user) => {
        if(error) {
            return res.status(403).json({ message: 'Invalid Token.'});
        }

        req.user = user;
        next();
    });
};

export default authenticateToken;