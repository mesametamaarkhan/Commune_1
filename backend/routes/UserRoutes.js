import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/UserModel.js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import authenticateToken from '../middleware/AuthenticateToken.js';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

const envConfig = dotenv.config();
const router = express.Router();

router.use(cookieParser());

//configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, //max file size 5MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            cb(new multer.MulterError('Unexpected field'), false);
        } else {
            cb(null, true);
        }
    }
 });

//register a new user
router.post('/register', async (req, res) => {
    //verify all fields have been filled
    if(!req.body.name || !req.body.username || !req.body.email 
       || !req.body.password || !req.body.phone || !req.body.postalCode
    ) {
        return res.status(400).send({ message: 'Some required fields are missing!!'});
    }

    //extract data
    const { name, username, email, password, phone, postalCode } = req.body;

    try {
        //check if email exists or not
        const existingEmail = await User.findOne({ email });
        if(existingEmail) {
            return res.status(400).send({ message: 'Email already in use.'});
        }

        //check if username exists or not
        const existingUsername = await User.findOne({ username });
        if(existingUsername) {
            return res.status(400).send({ message: 'Username already in use.'});
        }

        //once confirmed uniqueness of email and username
        //Hash the password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        //create new user
        const newUser = new User({
            name,
            username,
            email,
            passwordHash,
            phone,
            postalCode
        });

        //save new user
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully!'});
    }
    catch(error) {
        res.status(500).json({ message: 'Server error', error});
    }
});

//user login
router.post('/login', async (req, res) => {
    if(!req.body.username || !req.body.password) {
        return res.status(400).send({ message: 'Some required fields are missing!!'});
    }

    const { username, password } = req.body;
    try {
        const existingUser = await User.findOne({ username });
        if(!existingUser) {
            return res.status(400).send({ message: 'Username does not exist!!'});
        }

        const isPasswordValid = await bcrypt.compare(password, existingUser.passwordHash);
        if(!isPasswordValid) {
            return res.status(400).send({ message: 'Password invalid!!' });
        }

        const payload = {
            id: existingUser._id,
            username: existingUser.username,
            email: existingUser.email
        };

        const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m'});
        const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '2d'});
        existingUser.refreshToken = refreshToken;
        await existingUser.save();
        res.status(200).json({ message: 'Login Successful', accessToken, refreshToken});
    }
    catch(error) {
        res.status(500).json({ message: 'Server error', error});
    }
});

//user logout
router.post('/logout', async(req, res) => {
    const { refreshToken } = req.body;
    if(!refreshToken) {
        return res.status(401).json({ message: 'Refresh token is required.'});
    }

    try{
        const existingUser = await User.findOneAndUpdate(
            { refreshToken },
            { refreshToken: null}
        );

        if(!existingUser) {
            return res.status(400).json({ messge: 'Invalid refresh token'});
        }

        res.status(200).json({ message: 'Logout Successfully'});
    }
    catch(error) {
        res.status(501).json({ message: 'Server error', error});
    }
})

//upload a profile picture
//currently not using authenticate token
router.post('/upload-profile-picture', authenticateToken, upload.single('profilePicture'), async (req, res) => {
    if(!req.file) {
        return res.status(400).send({ message: 'File not uploaded.'});
    }

    const username = req.body.username;
    const { buffer, mimetype } = req.file;

    try {
        const user = await User.findOneAndUpdate({ username }, { profilePicture: { data: buffer, contentType: mimetype } }, { new: true});
        
        if(!user) {
            return res.status(404).json({ message: 'User not found.', user });
        }
        
        res.status(200).json({ message: 'Profile picture updated successfully.', user });
    }
    catch(error) {
        console.log(error);
        res.status(500).json({ message: 'Server error', error });
    }
});

//route to display user's profile page
router.get('/profile-page/:id', authenticateToken, async (req, res) => {
    try {   
        const { id } = req.params;
        const user = await User.findById(id);
        return res.status(200).json({ user: user});
    }
    catch(error) {
        res.status(500).json({ message: 'Server error!', error });
    }
});

//route for refreshing jwt token
router.post('/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;
    if(!refreshToken) {
        return res.status(401).json({ message: 'Refresh token is required.'});
    }

    try {
        const existingUser = await User.findOne({ refreshToken });
        if(!existingUser) {
            return res.status(403).json({ message: 'Invalid RefreshToken'});
        }

        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (error, payload) => {
            if(error) {
                return res.status(403).json({ message: 'Invalid or expired refresh token.'});
            }

            const newAccessToken = jwt.sign(
                {
                    id: payload.id,
                    username: payload.username,
                    email: payload.email
                },
                process.env.ACCESS_TOKEN_SECRET,
                {
                    expiresIn: '15m'
                }
            );

            res.status(200).json({ accessToken: newAccessToken});
        });
    }
    catch(error) {
        res.status(500).json({ message: 'Server error', error});
    }
});

export default router;