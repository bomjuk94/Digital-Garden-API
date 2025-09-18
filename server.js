require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
console.log('server is starting');

const allowedOrigins = [
    'http://localhost:5173',
    // ⚠️ Origins include protocol — add https://
    'https://digital-garden-client-75iiekjbp-dennisk94s-projects.vercel.app',
];

app.use(cors({
    origin: (origin, callback) => {
        console.log('🌍 Incoming origin:', origin);
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            console.warn('🚫 Blocked CORS request from:', origin);
            callback(null, false);
        }
    },
    credentials: true,
}));

app.use(express.json());

// === DEV SIMULATION MIDDLEWARE (pick one of the options above) ===
// after app.use(express.json())
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        const ms = Number(req.headers['x-simulate-cold'] || 0);
        if (ms > 0) {
            console.log(`Simulating cold start delay: ${ms}ms`);
            setTimeout(next, ms);
        } else if (req.headers['x-simulate-503']) {
            return res.status(503).json({ error: 'Service Unavailable (simulated)' });
        } else {
            next();
        }
    });
}
// ================================================================

app.get('/api/ping', (req, res) => {
    res.status(200).send('pong');
});

const client = new MongoClient(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

client.connect()
    .then(() => {
        console.log('Connected to MongoDB Atlas');

        const userDataDB = client.db('userData');
        const authDB = client.db('auth');
        const gameDataDB = client.db('gameData');

        const collections = {
            users: authDB.collection('users'),
            profiles: userDataDB.collection('profiles'),
            inventory: userDataDB.collection('inventory'),
            garden: userDataDB.collection('garden'),
            shop: userDataDB.collection('shop'),
            purchases: userDataDB.collection('purchases'),
            seeds: userDataDB.collection('seeds'),
            gameSeeds: gameDataDB.collection('seeds'),
            plants: userDataDB.collection('plants'),
            upgrades: userDataDB.collection('upgrades'),
            supplies: userDataDB.collection('supplies'),
        };

        const authRoutes = require('./routes/auth')(client, collections);
        app.use('/api', authRoutes);

        app.use((err, req, res, next) => {
            console.error('Uncaught error: ', err);
            res.status(500).json({ error: 'Internal server error' });
        });

        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
        console.error('MongoDB connection error: ', err);
        process.exit(1);
    });



// require("dotenv").config()
// const express = require("express")
// const cors = require("cors");
// const { MongoClient } = require("mongodb")

// const app = express()
// console.log('server is starting')

// const allowedOrigins = [
//     "http://localhost:5173",
//     "digital-garden-client-75iiekjbp-dennisk94s-projects.vercel.app",
// ];


// app.use(cors({
//     origin: (origin, callback) => {
//         console.log("🌍 Incoming origin:", origin);

//         if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
//             callback(null, true); // ✅ allow
//         } else {
//             console.warn("🚫 Blocked CORS request from:", origin);
//             callback(null, false); // ✅ silently deny
//         }
//     },
//     credentials: true
// }));

// app.use(express.json())

// app.get('/api/ping', (req, res) => {
//     res.status(200).send('pong');
// });

// const client = new MongoClient(process.env.MONGO_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
// })

// client.connect()
//     .then(() => {
//         console.log('Connected to MongoDB Atlas')

//         const userDataDB = client.db("userData");
//         const authDB = client.db("auth")
//         const gameDataDB = client.db("gameData")

//         const collections = {
//             users: authDB.collection("users"),
//             profiles: userDataDB.collection("profiles"),
//             inventory: userDataDB.collection("inventory"),
//             garden: userDataDB.collection("garden"),
//             shop: userDataDB.collection("shop"),
//             purchases: userDataDB.collection("purchases"),
//             seeds: userDataDB.collection("seeds"),
//             gameSeeds: gameDataDB.collection('seeds'),
//             plants: userDataDB.collection("plants"),
//             upgrades: userDataDB.collection("upgrades"),
//             supplies: userDataDB.collection("supplies"),
//         };

//         const authRoutes = require("./routes/auth")(client, collections)
//         app.use("/api", authRoutes)

//         app.use((err, req, res, next) => {
//             console.error("Uncaught error: ", err)
//             res.status(500).json({ error: "Internal server error" })
//         })
//         const PORT = process.env.PORT || 5000
//         app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
//     })
//     .catch((err) => {
//         console.error("MongoDB connection error: ", err)
//         process.exit(1)
//     })