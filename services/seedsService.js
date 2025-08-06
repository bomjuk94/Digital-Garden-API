const getDefaultSeeds = async (client) => {
    const seedsCollection = client.db("gameData").collection("seeds")
    return await seedsCollection.find({}).toArray()
}

module.exports = { getDefaultSeeds }
