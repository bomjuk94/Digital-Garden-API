const express = require("express")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const authenticateToken = require("../middleware/auth")

module.exports = (client, collections) => {
    const router = express.Router()
    const { users, profiles, inventory, garden, shop, purchases, plants, upgrades, supplies, seeds, gameSeeds } = collections;

    router.post("/register", async (req, res) => {
        const session = client.startSession();
        session.startTransaction();
        const { username, password } = req.body
        const usernameCaseInsensitive = username.toLowerCase()
        const { validateRegistrationInput } = require("../utils/validateUserInput")
        const { getDefaultSeeds } = require("../services/seedsService")

        // Validate user inputs
        const errors = validateRegistrationInput({ username, password })

        if (errors.length > 0) {
            return res.status(400).json({ errors })
        }

        try {
            // Check if user with username already exists
            const existingUser = await users.findOne({ usernameCaseInsensitive })

            if (existingUser) {
                return res.status(400).json({ error: "Account with username already registered" })
            }
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10)
            const createdAt = new Date().toISOString()
            // Add new user (username, password, createdAt)
            const result = await users.insertOne({
                username: usernameCaseInsensitive,
                password: hashedPassword,
                createdAt,
            })

            // Add new profile to profiles collection

            const newProfile = {
                _id: result.insertedId,
                username: usernameCaseInsensitive,
                mode: 'registered',
                createdAt,
                lastActive: createdAt,
                onboardingComplete: false,
                theme: 'light',
                game: {
                    plantCapacity: 3,
                    calculatedPlantCapacity: 3,
                    usedPlantCapacity: 0,
                },
                balance: 60,
                lastAtShop: createdAt,
            }

            const profile = await profiles.insertOne(newProfile)

            const userId = profile.insertedId

            // Retrieve default seeds
            const defaultSeeds = await getDefaultSeeds(client)

            await Promise.all([
                shop.insertOne({ _id: userId, shop: {} }),
                purchases.insertOne({ _id: userId, purchases: [] }),
                plants.insertOne({ _id: userId, plants: [] }),
                inventory.insertOne({ _id: userId, inventory: {}, inventoryCount: 0 }),
                garden.insertOne({ _id: userId, garden: {} }),
                upgrades.insertOne({ _id: userId, upgrades: [] }),
                supplies.insertOne({ _id: userId, supplies: [] }),
                seeds.insertOne({ _id: userId, seeds: defaultSeeds }),
            ]);

            await session.commitTransaction();

            // Create jwt token
            const token = jwt.sign(
                { userId: result.insertedId, username: usernameCaseInsensitive },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            )

            return res.json({ message: "User registered successfully", token })
        } catch (error) {
            await session.abortTransaction();
            console.error("Registration failed:", error);
            res.status(500).json({ error: "Registration failed", details: error.message });
        } finally {
            session.endSession();
        }
    })

    router.post("/login", async (req, res) => {
        const { username, password } = req.body;
        const { validateLoginInput } = require("../utils/validateUserInput");
        const usernameCaseInsensitive = username.toLowerCase();

        // Validate inputs
        const errors = validateLoginInput({ username, password });
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        try {
            // const authDB = client.db("auth");
            // const usersCollection = authDB.collection("users");

            const user = await users.findOne({ username: usernameCaseInsensitive });
            if (!user) {
                return res.status(401).json({ error: "Invalid Credentials" });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: "Incorrect Credentials" });
            }

            const token = jwt.sign(
                { userId: user._id, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            return res.json({ message: "User logged in successfully", token });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    router.get("/profile", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);

        try {
            // Connect to auth db
            const authDB = client.db('auth')
            // Connect to users collection
            const usersCollection = authDB.collection('users')
            // Connect to userData db
            const userDataDB = client.db('userData')
            // Connect to profiles collection
            const profilesCollection = userDataDB.collection('profiles')
            // Check if user with _id exists in users collection
            const user = await usersCollection.findOne({ _id: userId })

            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }
            // Check if user with _id exists in profiles collection
            const profile = await profilesCollection.findOne({ _id: userId })

            if (!profile) {
                return res.status(401).json({ error: "Profile does not exist" });
            }
            // Return profile data following Profile Type
            return res.json({
                ...profile
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.patch("/profile/balance", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);
        const { balance } = req.body

        try {
            const user = await users.findOne({ _id: new ObjectId(userId) })

            if (!user) {
                return res.status(401).json({ error: 'User does not exist' })
            }

            const profile = await profiles.findOne({ _id: new ObjectId(userId) })

            if (!profile) {
                return res.status(401).json({ error: 'Profile does not exist' })
            }

            const response = await profiles.updateOne(
                { _id: new ObjectId(userId) },
                { $set: { balance } }
            )

            if (response.modifiedCount > 0) {
                return res.status(200).json({ success: true, message: "User balance updated" });
            }
        } catch (error) {
            return res.status(500).json({ error });
        }
    })

    router.get("/seeds", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);

        try {
            // Check if user with _id exists in users collection
            const user = await users.findOne({ _id: userId })

            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }
            // Check if user with _id exists in profiles collection
            const seedsList = await seeds.findOne({ _id: userId })

            if (!seedsList) {
                return res.status(401).json({ error: "Seeds do not exist" });
            }
            // Return profile data following Profile Type
            return res.json({
                ...seedsList
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.get("/inventory", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);

        try {
            // Check if user with _id exists in users collection
            const user = await users.findOne({ _id: userId })

            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }
            // Check if user with _id exists in profiles collection
            const inventoryList = await inventory.findOne({ _id: userId })

            if (!inventoryList) {
                return res.status(401).json({ error: "Inventory does not exist" });
            }
            // Return inventory data
            return res.json({
                ...inventoryList
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.get("/shop", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);

        try {
            // Check if user with _id exists in profiles collection
            const shopDoc = await shop.findOne({ _id: userId })

            if (!shopDoc) {
                return res.status(401).json({ error: "Shop does not exist" });
            }
            // Return inventory data
            return res.json({
                ...shopDoc
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/shop/update", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { updatedShop } = req.body

        try {

            const shopDoc = await shop.findOne({ _id: userId })
            if (!shopDoc) {
                return res.status(401).json({ error: "shop does not exist" });
            }

            const response = await shop.updateOne(
                { _id: userId },
                { $set: { shop: updatedShop } }
            )

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Could not update shop" });
            }

            res.json({ message: "shop updated successfully" });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.get("/purchases", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);

        try {
            // Check if user with _id exists in users collection
            const user = await users.findOne({ _id: userId })

            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }
            // Check if user with _id exists in purchases collection
            const purchasesList = await purchases.findOne({ _id: userId })

            if (!purchasesList) {
                res.status(401).json({ error: "Purchases do not exist" });
            }
            // Return purchases data
            return res.json({ purchases: purchasesList.purchases })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/purchases/update", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { updatedPurchases } = req.body

        try {

            const purchasesDoc = await purchases.findOne({ _id: userId })
            if (!purchasesDoc) {
                return res.status(401).json({ error: "purchases does not exist" });
            }

            const response = await purchases.updateOne(
                { _id: userId },
                { $set: { purchases: updatedPurchases } }
            )

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Could not update purchases" });
            }

            res.json({ message: "purchases updated successfully" });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.get("/plants", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);

        try {
            // Check if user with _id exists in users collection
            const user = await users.findOne({ _id: userId })

            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }
            // Check if user with _id exists in plants collection
            const plantsList = await plants.findOne({ _id: userId })

            if (!plantsList) {
                res.status(401).json({ error: "plants do not exist" });
            }
            // Return plants data
            return res.json({ plants: plantsList.plants })

        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.post("/plants/add", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);
        const { plant } = req.body

        try {
            const user = await users.findOne({ _id: userId })

            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }

            await plants.updateOne(
                { _id: userId },
                { $push: { plants: plant } }
            );

            res.json({ message: "Plant added successfully" });
        } catch (error) {
            console.error("❌ Error adding plant:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.patch("/plants/remove", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);
        const { idToRemove } = req.body

        try {
            // Check if user with _id exists in users collection
            const user = await users.findOne({ _id: userId })

            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }

            const plant = await plants.findOne({ _id: userId })

            if (!plant) {
                return res.status(401).json({ error: "Plant does not exist" });
            }

            await plants.updateOne(
                { _id: userId },
                { $pull: { "plants": { id: idToRemove } } } // append
            );

            res.json({ message: "Plant removed successfully" });
        } catch (error) {
            console.error("❌ Error adding plant:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.patch("/profile/usedPlantCapacity", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const { userId } = req.user;
        try {
            const result = await profiles.updateOne(
                { _id: new ObjectId(userId) },
                { $inc: { "game.usedPlantCapacity": 1 } } // server handles increment
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: "Profile not found" });
            }

            res.json({ message: "Plant capacity incremented successfully" });
        } catch (err) {
            res.status(500).json({ error: "Failed to update capacity" });
        }
    });

    router.patch("/seeds/decrement", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const { userId } = req.user;
        const { name } = req.body

        try {
            const result = await seeds.updateOne(
                { _id: new ObjectId(userId), "seeds.name": name },
                { $inc: { "seeds.$.count": -1 } }
            )
            res.json({ message: "Seed capacity decremented successfully" });
        } catch (error) {
            res.status(500).json({ error: "Failed to update capacity" });
        }
    })

    router.patch("/profile/onboardingStatus", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const { userId } = req.user;
        const { status } = req.body

        try {
            const user = users.findOne({ _id: new ObjectId(userId) })
            if (!user) {
                return res.status(401).json({ error: "User not found" })
            }

            const profile = profiles.findOne({ _id: new ObjectId(userId) })
            if (!profile) {
                return res.status(401).json({ error: "Profile not found" })
            }

            const response = await profiles.updateOne(
                { _id: new ObjectId(userId) },
                { $set: { onboardingComplete: status } },
            )

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Profile not found" });
            }

            res.json({ message: "status updated successfully" });
        } catch (error) {
            res.status(500).json({ error: "Failed to update status" });
        }
    })

    router.put("/profile/update", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { updatedProfile } = req.body
        const { _id, ...profileWithoutId } = updatedProfile

        try {
            const user = await users.findOne({ _id: userId })
            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }

            const profile = await profiles.findOne({ _id: userId })
            if (!profile) {
                return res.status(401).json({ error: "profile does not exist" });
            }

            const response = await profiles.replaceOne(
                { _id: userId },
                { ...profileWithoutId }
            )

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Could not update profile" });
            }

            res.json({ message: "Plant added to profile successfully" });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.get("/upgrades", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);

        try {
            // Check if user with _id exists in users collection
            const user = await users.findOne({ _id: userId })

            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }
            // Check if user with _id exists in profiles collection
            const upgradesList = await upgrades.findOne({ _id: userId })

            if (!upgradesList) {
                return res.status(401).json({ error: "Upgrades does not exist" });
            }
            // Return inventory data
            return res.json({
                ...upgradesList
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.patch("/inventory/count", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { count } = req.body

        try {
            const user = await users.findOne({ _id: userId })

            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }

            const inventoryDoc = await inventory.findOne({ _id: userId })

            if (!inventoryDoc) {
                return res.status(401).json({ error: "Inventory does not exist" });
            }

            const response = await inventory.updateOne(
                { _id: userId },
                { $set: { inventoryCount: count } }
            )

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Could not update inventory" });
            }

            res.json({ message: "inventory count successfully" });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    })

    router.get("/supplies", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)

        try {
            const user = users.findOne({ _id: userId })
            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }

            const response = await supplies.findOne({ _id: userId })
            if (!response) {
                return res.status(401).json({ error: "response does not exist" });
            }
            console.log('response', response.supplies)

            return res.json({ ...response })
        } catch (error) {
            console.error("supplies fetch error:", error)
            res.status(500).json({ error: error.message })
        }
    })

    router.patch("/supplies/add", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { supply } = req.body

        try {
            const user = users.findOne({ _id: userId })
            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }

            const supplyList = supplies.findOne({ _id: userId })
            if (!supplyList) {
                return res.status(401).json({ error: "Supply does not exist" });
            }

            const response = await supplies.updateOne(
                { _id: userId },
                { $push: { supplies: supply } }
            )

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Could not add supply" });
            }
            res.json({ message: "Supply added successfully" });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.patch("/upgrades/add", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { upgrade } = req.body

        try {
            const user = users.findOne({ _id: userId })
            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }

            const upgradesList = upgrades.findOne({ _id: userId })
            if (!upgradesList) {
                return res.status(401).json({ error: "Upgrade does not exist" });
            }

            const response = await upgrades.updateOne(
                { _id: userId },
                { $push: { upgrades: upgrade } }
            )

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Could not add upgrade" });
            }
            res.json({ message: "Upgrade added successfully" });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/plants/buffs", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { updatedPlants } = req.body

        try {
            const user = await users.findOne({ _id: userId })
            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }

            const plantsList = await plants.findOne({ _id: userId })
            if (!plantsList) {
                return res.status(401).json({ error: "Plant does not exist" });
            }

            const response = await plants.updateOne(
                { _id: userId },
                { $set: { plants: updatedPlants } }
            )

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Could not apply buffs to plants" });
            }

            res.json({ message: "buff added successfully" });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/seeds/count", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { name, updatedSeed } = req.body

        try {

            const user = await users.findOne({ _id: userId })
            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }

            const seedsList = await seeds.findOne({ _id: userId })
            if (!seedsList) {
                return res.status(401).json({ error: "Seed does not exist" });
            }

            const response = await seeds.updateOne(
                { _id: userId, "seeds.name": name },
                { $set: { seeds: updatedSeed } }
            )

            res.json({ message: "Seed count updated successfully" });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/seeds/unlock", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { name, updatedSeed } = req.body

        try {

            const user = await users.findOne({ _id: userId })
            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }

            const seedsList = await seeds.findOne({ _id: userId })
            if (!seedsList) {
                return res.status(401).json({ error: "Seed does not exist" });
            }

            const response = await seeds.updateOne(
                { _id: userId, "seeds.name": name },
                { $set: { seeds: updatedSeed } }
            )

            res.json({ message: "Seed unlocked successfully" });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/inventory/update", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson");
        const userId = new ObjectId(req.user.userId);
        const { updatedInventory } = req.body;

        try {
            const newInventoryCount = Object.values(updatedInventory).reduce(
                (acc, plant) => acc + (plant.count || 0),
                0
            );

            const response = await inventory.updateOne(
                { _id: userId },
                { $set: { inventory: updatedInventory, inventoryCount: newInventoryCount } }
            );

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Could not update inventory" });
            }

            res.json({
                message: "Inventory updated successfully",
                inventoryCount: newInventoryCount
            });
        } catch (error) {
            console.error("Inventory update error:", error);
            res.status(500).json({ error: error.message });
        }
    });


    router.put("/plants/update", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { updatedPlants } = req.body

        try {
            const user = await users.findOne({ _id: userId })
            if (!user) {
                return res.status(401).json({ error: "User does not exist" });
            }

            const plantsList = await plants.findOne({ _id: userId })
            if (!plantsList) {
                return res.status(401).json({ error: "plant does not exist" });
            }

            const response = await plants.updateOne(
                { _id: userId },
                { $set: { plants: updatedPlants } }
            )

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Could not update plants" });
            }

            res.json({ message: "plants updated successfully" });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    })

    router.put("/seeds/update", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { updatedSeeds } = req.body

        console.log("REQ BODY:", req.body)

        // ✅ Guard against empty or invalid updatedSeeds
        if (!updatedSeeds || !Array.isArray(updatedSeeds) || updatedSeeds.length === 0) {
            console.error("Invalid update: updatedSeeds must be a non-empty array", req.body)
            return res.status(400).json({ error: "Invalid request: updatedSeeds cannot be empty" })
        }

        try {
            const seedsDoc = await seeds.findOne({ _id: userId })
            if (!seedsDoc) {
                return res.status(404).json({ error: "Seeds not found" })
            }

            const response = await seeds.updateOne(
                { _id: userId },
                { $set: { seeds: updatedSeeds } }
            )

            console.log("UPDATE RESULT:", response)

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Could not update seeds" })
            }

            res.json({ message: "seeds updated successfully" })
        } catch (error) {
            console.error("seeds update error:", error)
            res.status(500).json({ error: error.message })
        }
    })

    router.patch("/supplies/remove", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { supplyId } = req.body

        try {
            console.log('supply id to remove', supplyId)
            const supply = supplies.findOne({ _id: userId })
            if (!supply) {
                return res.status(404).json({ error: "Seeds not found" })
            }

            console.log('removing supply')
            const response = await supplies.updateOne(
                { _id: userId },
                { $pull: { supplies: { id: supplyId } } }
            )
            console.log('supply response', response)

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Could not update seeds" })
            }

            res.json({ message: "Supplies updated successfully" })
        } catch (error) {
            console.error("supplies update error:", error)
            res.status(500).json({ error: error.message })
        }
    })

    router.get("/garden", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId);

        try {
            const gardenDoc = await garden.findOne({ _id: userId })

            if (!gardenDoc) {
                return res.status(401).json({ error: "Garden does not exist" });
            }

            return res.json({
                ...gardenDoc
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: error.message });
        }
    })

    router.put("/garden/update", authenticateToken, async (req, res) => {
        const { ObjectId } = require("bson")
        const userId = new ObjectId(req.user.userId)
        const { updatedGarden } = req.body

        try {
            const gardenDoc = await garden.findOne({ _id: userId })
            if (!gardenDoc) {
                return res.status(404).json({ error: "Garden not found" })
            }

            const response = await garden.updateOne(
                { _id: userId },
                { $set: { garden: updatedGarden } }
            )

            console.log("UPDATE RESULT:", response)

            if (response.matchedCount === 0) {
                return res.status(404).json({ error: "Could not update garden" })
            }

            res.json({ message: "garden updated successfully" })
        } catch (error) {
            console.error("seeds update error:", error)
            res.status(500).json({ error: error.message })
        }
    })

    return router
}