import express from 'express';

const app = express();

//middleware
app.use(express.json());

//handling all cors (alternative is to use custom origins)
app.use(cors()); 

//landing page
app.get('/', (req, res) => {
    console.log('Hello');
    return res.status(234).send('Welcome');
});

//connect database
// mongoose.connect(mongoDBCon)
//     .then(() => {
//         console.log('MongoDB Connected');
//         app.listen(PORT, () => {
//             console.log(`App is listening to port: ${PORT}`);
//         });
//     })
//     .catch((error) => {
//         console.log(error.message);
//     });